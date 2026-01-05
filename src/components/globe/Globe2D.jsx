/**
 * Globe2D Component
 * Main WorldWind 2D globe with satellite tracking
 *
 * Performance Optimized:
 * - Direct SGP4 calculation every frame (satrec is cached by store)
 * - Coverage circles cached and throttled (5 Hz update)
 * - Orbit paths updated every 10 seconds
 * - Store updates throttled (10 Hz)
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import WorldWind from "worldwindjs";
import { Plus, Minus, Home } from "lucide-react";

// Hooks
import { useResizeObserver } from "../../hooks";

// Stores
import { useSatelliteStore, useGroundStationStore, useTimeStore, useScenarioStore } from "../../stores";

// Utils
import { LAYER_OPTIONS, STABILITY_THRESHOLD, CALC_TARGET, BORDER_SENSOR_INTERVAL_MS } from "../../utils/constants";
import { calculateOptimalRange } from "../../utils/rangeCalculator";
import { calculateCoverageRadius, geodesicCircleCoords, generateSwathCoords } from "../../utils/geodesic";

// Sub-components
import BorderSensors from "./BorderSensors";
import EngineStatusPanel from "./EngineStatusPanel";
// import SatelliteInfoPanel from "./SatelliteInfoPanel";
import LoadingOverlay from "./LoadingOverlay";

// Configure WorldWind base URL
WorldWind.configuration.baseUrl = "./worldwind/";

// Performance configuration
const PERF_CONFIG = {
  POSITION_UPDATE_INTERVAL: 50, // IPC call frequency (ms) - 20 Hz
  COVERAGE_UPDATE_INTERVAL: 200, // Coverage circle update (ms) - 5 Hz
  ORBIT_UPDATE_INTERVAL: 10000, // Orbit path refresh (ms) - 0.1 Hz
  STORE_UPDATE_INTERVAL: 100, // Zustand store update (ms) - 10 Hz
  COVERAGE_CIRCLE_POINTS: 72, // Fewer points = faster (was 361)
  ORBIT_PATH_POINTS: 100, // Points per orbit
  POSITION_CHANGE_THRESHOLD: 0.01, // Degrees - skip update if unchanged
};

const Globe2D = ({ onMouseMove }) => {
  // Custom hooks
  const { containerRef, dimensions, isReady } = useResizeObserver();

  // Zustand stores
  const satellites = useSatelliteStore((state) => state.satellites);
  const getSelectedSatellite = useSatelliteStore((state) => state.getSelectedSatellite);
  const calculatePosition = useSatelliteStore((state) => state.calculatePosition);
  const getSatrecForTime = useSatelliteStore((state) => state.getSatrecForTime);

  const groundStations = useGroundStationStore((state) => state.groundStations);
  const getVisibleStations = useGroundStationStore((state) => state.getVisibleStations);

  const mode = useTimeStore((state) => state.mode); // Track mode changes

  const _layers = useScenarioStore((state) => state.layers);

  // Refs for WorldWind
  const canvasRef = useRef(null);
  const wwdRef = useRef(null);
  const isStableRef = useRef(false);
  const targetLatRef = useRef(0);
  const latDeltaRef = useRef(45);
  const statsValidRef = useRef(false);
  const autoFitEnabledRef = useRef(true);
  const baseLayerRef = useRef(null);
  const orbitLayerRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const coveragePolygonRef = useRef(null);
  const satellitePlacemarkRef = useRef(null);
  const groundStationLayerRef = useRef(null);
  const passTrajectoryLayerRef = useRef(null); // Layer for pass ground tracks
  const satelliteRenderablesRef = useRef({}); // Store renderables per satellite
  const orbitPathDataRef = useRef({}); // Store orbit path data per satellite {points, endTime, pathRenderable}

  // Coverage circle caching
  const coverageCacheRef = useRef({}); // Cached coverage circles {[id]: {coords, lastLat, lastLon, lastAlt}}

  // Throttling refs for performance optimization
  const lastStoreUpdateRef = useRef(0); // Last time we updated Zustand store
  const lastCoverageUpdateRef = useRef({}); // Last coverage update time per satellite
  const lastOrbitUpdateRef = useRef({}); // Last orbit update time per satellite

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState("bmng");
  const [currentSatellitePosition, setCurrentSatellitePosition] = useState({
    lat: 0,
    lon: 0,
    alt: 0,
  });
  const [borderStats, setBorderStats] = useState({
    top: null,
    bottom: null,
    left: null,
    right: null,
  });

  // Generate orbit path for a satellite - returns array of {time, lat, lon, alt}
  // Uses getSatrecForTime to automatically select best TLE for backdated propagation
  const generateOrbitPath = useCallback(
    (satelliteId, startTime) => {
      // Use getSatrecForTime to automatically select best TLE for the start time
      const satrec = getSatrecForTime(satelliteId, startTime);
      if (!satrec) return [];

      const points = [];
      const periodMinutes = 100; // Approximate orbital period
      const step = 1; // minutes

      for (let i = 0; i < periodMinutes; i += step) {
        const time = new Date(startTime.getTime() + i * 60 * 1000);
        const pos = calculatePosition(satelliteId, time);
        if (pos) {
          points.push({
            time: time,
            lat: pos.lat,
            lon: pos.lon,
            alt: pos.alt,
          });
        }
      }

      return points;
    },
    [getSatrecForTime, calculatePosition]
  );

  // Check if orbit path needs update
  // - When satellite is near end of current path
  // - When simulation time jumps outside current path range (backdated simulation)
  const checkOrbitPathUpdate = useCallback((satelliteId, currentTime) => {
    const orbitData = orbitPathDataRef.current[satelliteId];
    if (!orbitData || !orbitData.points || orbitData.points.length === 0) {
      return true; // Need to create initial path
    }

    const points = orbitData.points;
    const currentTimeMs = currentTime.getTime();
    const startTimeMs = points[0].time.getTime();
    const endTimeMs = points[points.length - 1].time.getTime();

    // Check if current time is outside the path range (backdated/forward simulation)
    // Give 5 minute buffer
    const bufferMs = 5 * 60 * 1000;
    if (currentTimeMs < startTimeMs - bufferMs || currentTimeMs > endTimeMs - bufferMs) {
      return true; // Time is outside path range, need new path
    }

    // Check if we're within 5 minutes of the end
    const thresholdMs = 5 * 60 * 1000; // 5 minutes before end
    return currentTimeMs >= endTimeMs - thresholdMs;
  }, []);

  // Update orbit path for a satellite
  const updateOrbitPath = useCallback(
    (wwd, satelliteId, satellite, startTime) => {
      const points = generateOrbitPath(satelliteId, startTime);

      if (points.length > 1) {
        // Remove old path renderable if exists
        if (orbitPathDataRef.current[satelliteId]?.pathRenderable && orbitLayerRef.current) {
          orbitLayerRef.current.removeRenderable(orbitPathDataRef.current[satelliteId].pathRenderable);
        }

        const pathPositions = points.map((point) => new WorldWind.Position(point.lat, point.lon, point.alt * 1000));

        const pathAttributes = new WorldWind.ShapeAttributes(null);
        pathAttributes.outlineColor = new WorldWind.Color(satellite.color?.r || 0, satellite.color?.g || 1, satellite.color?.b || 1, satellite.color?.a || 0.8);
        pathAttributes.outlineWidth = 2;
        pathAttributes.drawInterior = false;

        const path = new WorldWind.Path(pathPositions, pathAttributes);
        path.altitudeMode = WorldWind.ABSOLUTE;
        path.extrude = false;
        path.useSurfaceShapeFor2D = true;

        if (!orbitLayerRef.current) {
          orbitLayerRef.current = new WorldWind.RenderableLayer("Orbit Path");
          wwd.addLayer(orbitLayerRef.current);
        }

        orbitLayerRef.current.addRenderable(path);

        // Store orbit data
        orbitPathDataRef.current[satelliteId] = {
          points: points,
          endTime: points[points.length - 1].time,
          pathRenderable: path,
        };
      }
    },
    [generateOrbitPath]
  );

  // Create orbit path layer (initial setup)
  const createOrbitLayer = useCallback(
    (wwd) => {
      if (orbitLayerRef.current) {
        wwd.removeLayer(orbitLayerRef.current);
      }

      const orbitLayer = new WorldWind.RenderableLayer("Orbit Path");
      orbitLayerRef.current = orbitLayer;
      wwd.addLayer(orbitLayer);

      // Clear existing orbit data
      orbitPathDataRef.current = {};

      // Create initial orbit paths for all visible satellites
      const currentTime = useTimeStore.getState().currentTime;
      satellites
        .filter((s) => s.isVisible)
        .forEach((sat) => {
          updateOrbitPath(wwd, sat.id, sat, currentTime);
        });

      console.log(`✅ Orbit paths created for ${satellites.filter((s) => s.isVisible).length} satellites`);
    },
    [satellites, updateOrbitPath]
  );

  // Create satellite marker layer
  const createSatelliteLayer = useCallback((wwd) => {
    if (satelliteLayerRef.current) {
      wwd.removeLayer(satelliteLayerRef.current);
    }

    coveragePolygonRef.current = null;
    satellitePlacemarkRef.current = null;
    satelliteRenderablesRef.current = {};

    const satLayer = new WorldWind.RenderableLayer("Satellites");
    satelliteLayerRef.current = satLayer;
    wwd.addLayer(satLayer);
  }, []);

  // Create ground station layer
  const createGroundStationLayer = useCallback(
    (wwd) => {
      if (groundStationLayerRef.current) {
        wwd.removeLayer(groundStationLayerRef.current);
      }

      const gsLayer = new WorldWind.RenderableLayer("Ground Stations");

      getVisibleStations().forEach((gs) => {
        // Ground station placemark
        const placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
        placemarkAttributes.imageSource = WorldWind.configuration.baseUrl + "images/antenna.png";
        placemarkAttributes.imageScale = 0.8;
        placemarkAttributes.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.3, WorldWind.OFFSET_FRACTION, 0.0);
        placemarkAttributes.labelAttributes.color = WorldWind.Color.YELLOW;
        placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 1.5);

        const placemark = new WorldWind.Placemark(new WorldWind.Position(gs.location.lat, gs.location.lon, 0), false, placemarkAttributes);
        placemark.label = gs.name;
        placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;

        gsLayer.addRenderable(placemark);

        // Multi-coverage support
        const coverages = gs.coverages || [];

        // If no coverages array but has legacy antenna config, use that
        if (coverages.length === 0 && gs.showCoverage !== false && gs.antenna?.maxRange) {
          const coverageCoords = geodesicCircleCoords({ latitude: gs.location.lat, longitude: gs.location.lon }, gs.antenna.maxRange);

          const boundaryLocations = coverageCoords.map((coord) => new WorldWind.Location(coord.latitude, coord.longitude));

          const polygonAttributes = new WorldWind.ShapeAttributes(null);
          polygonAttributes.interiorColor = new WorldWind.Color(gs.color?.r || 1, gs.color?.g || 0.5, gs.color?.b || 0, 0.1);
          polygonAttributes.outlineColor = new WorldWind.Color(gs.color?.r || 1, gs.color?.g || 0.5, gs.color?.b || 0, 0.6);
          polygonAttributes.outlineWidth = 1;

          const coveragePolygon = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
          gsLayer.addRenderable(coveragePolygon);
        } else {
          // Render each coverage area
          coverages.forEach((coverage) => {
            if (!coverage.isVisible) return;

            let maxRange = coverage.maxRange || 2500;
            let coverageColor = coverage.color;

            // If satellite tracking, calculate range based on satellite altitude
            // and use satellite's color
            if (coverage.type === "satellite" && coverage.satelliteId) {
              const satState = useSatelliteStore.getState();
              const satPosition = satState.positions[coverage.satelliteId];
              const trackedSatellite = satState.satellites.find((s) => s.id === coverage.satelliteId);

              console.log(`🎯 Coverage "${coverage.name}" tracking satellite:`, {
                satelliteId: coverage.satelliteId,
                trackedSatellite: trackedSatellite?.name,
                satColor: trackedSatellite?.color,
                coverageColor: coverage.color,
              });

              // Use satellite's color for tracking coverage
              if (trackedSatellite?.color) {
                coverageColor = trackedSatellite.color;
              }

              if (satPosition?.alt) {
                // Calculate coverage radius based on satellite altitude and min elevation
                maxRange = calculateCoverageRadius(satPosition.alt, coverage.minElevation ?? 0);
              }
            }

            const coverageCoords = geodesicCircleCoords({ latitude: gs.location.lat, longitude: gs.location.lon }, maxRange);

            const boundaryLocations = coverageCoords.map((coord) => new WorldWind.Location(coord.latitude, coord.longitude));

            // Use coverage color, satellite color (for tracking), or fallback to gs color
            const finalColor = coverageColor || gs.color || { r: 1, g: 0.5, b: 0 };

            console.log(`🎨 Final color for coverage "${coverage.name}":`, finalColor);

            const polygonAttributes = new WorldWind.ShapeAttributes(null);
            polygonAttributes.interiorColor = new WorldWind.Color(finalColor.r ?? 1, finalColor.g ?? 0.5, finalColor.b ?? 0, 0.1);
            polygonAttributes.outlineColor = new WorldWind.Color(finalColor.r ?? 1, finalColor.g ?? 0.5, finalColor.b ?? 0, 0.6);
            polygonAttributes.outlineWidth = 1;

            const coveragePolygon = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
            gsLayer.addRenderable(coveragePolygon);

            // Only show label if enabled (default true)
            if (coverage.showLabel ?? true) {
              // Build label text with coverage info (compact with newline)
              let labelText = `${Math.round(maxRange)} km`;
              if (coverage.type === "satellite" && coverage.satelliteId) {
                const satState = useSatelliteStore.getState();
                const trackedSat = satState.satellites.find((s) => s.id === coverage.satelliteId);
                const satName = trackedSat?.name || "Sat";
                // Truncate satellite name if too long
                const shortName = satName.length > 12 ? satName.substring(0, 10) + ".." : satName;
                labelText = `${shortName}\nEl≥${coverage.minElevation ?? 0}° ${Math.round(maxRange)}km`;
              } else {
                const shortName = coverage.name.length > 12 ? coverage.name.substring(0, 10) + ".." : coverage.name;
                labelText = `${shortName}\nEl≥${coverage.minElevation ?? 0}° ${Math.round(maxRange)}km`;
              }

              // Add range label at the edge of the circle (north point)
              const labelPosition = new WorldWind.Position(
                gs.location.lat + maxRange / 111, // Approximate degrees latitude
                gs.location.lon,
                0
              );

              const labelSize = coverage.labelSize ?? 10;
              const labelAttributes = new WorldWind.PlacemarkAttributes(null);
              labelAttributes.imageSource = WorldWind.configuration.baseUrl + "images/white-dot.png";
              labelAttributes.imageScale = 0.03;
              labelAttributes.labelAttributes.color = new WorldWind.Color(finalColor.r ?? 1, finalColor.g ?? 0.5, finalColor.b ?? 0, 1);
              labelAttributes.labelAttributes.font = new WorldWind.Font(labelSize);
              labelAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0);

              const rangeLabel = new WorldWind.Placemark(labelPosition, false, labelAttributes);
              rangeLabel.label = labelText;
              rangeLabel.altitudeMode = WorldWind.CLAMP_TO_GROUND;
              gsLayer.addRenderable(rangeLabel);
            }
          });
        }
      });

      groundStationLayerRef.current = gsLayer;
      wwd.addLayer(gsLayer);

      console.log(`✅ Ground stations layer created with ${getVisibleStations().length} stations`);
    },
    [getVisibleStations]
  );

  // Create pass trajectory layer (for Access Analysis results)
  const createPassTrajectoryLayer = useCallback((wwd) => {
    if (passTrajectoryLayerRef.current) {
      wwd.removeLayer(passTrajectoryLayerRef.current);
    }

    const passLayer = new WorldWind.RenderableLayer("Pass Trajectories");

    // Get all visible passes from all ground stations
    const allPasses = useGroundStationStore.getState().getVisiblePasses();

    allPasses.forEach((pass) => {
      if (!pass.path || pass.path.length < 2) return;

      // Create path positions from pass trajectory
      const pathPositions = pass.path.map(
        (point) => new WorldWind.Position(point.lat, point.lon, point.alt * 1000) // Convert km to m
      );

      // Use pass color or satellite color or default purple
      const color = pass.color || { r: 0.7, g: 0.3, b: 0.9, a: 1 };

      const pathAttributes = new WorldWind.ShapeAttributes(null);
      pathAttributes.outlineColor = new WorldWind.Color(color.r ?? 0.7, color.g ?? 0.3, color.b ?? 0.9, color.a ?? 0.9);
      pathAttributes.outlineWidth = 3;
      pathAttributes.drawInterior = false;

      const passPath = new WorldWind.Path(pathPositions, pathAttributes);
      passPath.altitudeMode = WorldWind.ABSOLUTE;
      passPath.extrude = false;
      passPath.useSurfaceShapeFor2D = true;
      passPath.followTerrain = false;

      passLayer.addRenderable(passPath);

      // Add AOS marker
      if (pass.path.length > 0) {
        const aosPoint = pass.path[0];
        const aosAttrs = new WorldWind.PlacemarkAttributes(null);
        aosAttrs.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/castshadow-green.png";
        aosAttrs.imageScale = 0.5;
        aosAttrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.3, WorldWind.OFFSET_FRACTION, 0.0);
        aosAttrs.labelAttributes.color = new WorldWind.Color(0.2, 1, 0.2, 1);
        aosAttrs.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 1.5);

        const aosMarker = new WorldWind.Placemark(new WorldWind.Position(aosPoint.lat, aosPoint.lon, 0), false, aosAttrs);
        aosMarker.label = `AOS`;
        aosMarker.altitudeMode = WorldWind.ABSOLUTE;
        passLayer.addRenderable(aosMarker);
      }

      // Add LOS marker
      if (pass.path.length > 1) {
        const losPoint = pass.path[pass.path.length - 1];
        const losAttrs = new WorldWind.PlacemarkAttributes(null);
        losAttrs.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/castshadow-red.png";
        losAttrs.imageScale = 0.5;
        losAttrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.3, WorldWind.OFFSET_FRACTION, 0.0);
        losAttrs.labelAttributes.color = new WorldWind.Color(1, 0.3, 0.3, 1);
        losAttrs.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 1.5);

        const losMarker = new WorldWind.Placemark(new WorldWind.Position(losPoint.lat, losPoint.lon, 0), false, losAttrs);
        losMarker.label = `LOS`;
        losMarker.altitudeMode = WorldWind.ABSOLUTE;
        passLayer.addRenderable(losMarker);
      }

      // Add Max Elevation marker (middle of path approximately)
      if (pass.maxElevation?.elevation && pass.path.length > 2) {
        // Find the point closest to max elevation time
        const maxElTime = pass.maxElevation.time;
        let maxElPoint = pass.path[Math.floor(pass.path.length / 2)];

        // Try to find exact point by time
        for (const point of pass.path) {
          if (Math.abs(point.time - maxElTime) < 30000) {
            // Within 30 seconds
            maxElPoint = point;
            break;
          }
        }

        const maxAttrs = new WorldWind.PlacemarkAttributes(null);
        maxAttrs.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/castshadow-blue.png";
        maxAttrs.imageScale = 0.5;
        maxAttrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.3, WorldWind.OFFSET_FRACTION, 0.0);
        maxAttrs.labelAttributes.color = new WorldWind.Color(0.3, 0.6, 1, 1);
        maxAttrs.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 1.5);

        const maxMarker = new WorldWind.Placemark(new WorldWind.Position(maxElPoint.lat, maxElPoint.lon, 0), false, maxAttrs);
        maxMarker.label = `Max ${pass.maxElevation.elevation.toFixed(0)}°`;
        maxMarker.altitudeMode = WorldWind.ABSOLUTE;
        passLayer.addRenderable(maxMarker);
      }
    });

    passTrajectoryLayerRef.current = passLayer;
    wwd.addLayer(passLayer);

    console.log(`✅ Pass trajectory layer created with ${allPasses.length} passes`);
  }, []);

  // Check and update coverage circle (throttled)
  // Now uses coverage object from satellite.objects if available
  const updateCoverageIfNeeded = useCallback((satelliteId, pos, coverageObject = null) => {
    const now = Date.now();
    const lastUpdate = lastCoverageUpdateRef.current[satelliteId] || 0;
    const cached = coverageCacheRef.current[satelliteId];

    // Check if update needed based on time or position change
    const timeElapsed = now - lastUpdate >= PERF_CONFIG.COVERAGE_UPDATE_INTERVAL;
    const positionChanged =
      !cached ||
      Math.abs(pos.lat - (cached.lastLat || 0)) > PERF_CONFIG.POSITION_CHANGE_THRESHOLD ||
      Math.abs(pos.lon - (cached.lastLon || 0)) > PERF_CONFIG.POSITION_CHANGE_THRESHOLD;

    if (!timeElapsed && !positionChanged && cached?.coords) {
      return cached.coords;
    }

    // Calculate radius based on coverage mode
    let radiusKm;
    if (coverageObject && coverageObject.coverageMode === "manual") {
      // Manual mode: use fixed radius
      radiusKm = coverageObject.manualRadius || 500;
    } else {
      // Auto mode: calculate from altitude and elevation angle
      const minElevation = coverageObject?.minElevationAngle ?? 0;
      radiusKm = calculateCoverageRadius(pos.alt, minElevation);
    }

    const center = { latitude: pos.lat, longitude: pos.lon };
    const circleCoords = geodesicCircleCoords(center, radiusKm, PERF_CONFIG.COVERAGE_CIRCLE_POINTS);

    // Cache the result
    coverageCacheRef.current[satelliteId] = {
      coords: circleCoords,
      radius: radiusKm,
      lastLat: pos.lat,
      lastLon: pos.lon,
      lastAlt: pos.alt,
    };
    lastCoverageUpdateRef.current[satelliteId] = now;

    return circleCoords;
  }, []);

  // Update satellite position with smooth animation
  // OPTIMIZED: Uses IPC-based positions from worker threads
  // Direct SGP4 calculation removed - positions come from satellitePositionService
  // Only throttle: store updates, orbit path updates, coverage circle updates
  const updateSatelliteMarker = useCallback(() => {
    if (!wwdRef.current || !satelliteLayerRef.current) return;

    const now = Date.now();

    // Use optimized tick - updates internal time every frame, state at 10Hz
    const { internalTime, shouldUpdateUI } = useTimeStore.getState().tickOptimized();
    const time = new Date(internalTime);

    // Read satellites from store (no re-render)
    const { satellites, selectedSatelliteId, updatePosition, calculatePosition: calcPos } = useSatelliteStore.getState();

    // Determine if we should update Zustand store (throttled)
    const shouldUpdateStore = shouldUpdateUI || now - lastStoreUpdateRef.current >= PERF_CONFIG.STORE_UPDATE_INTERVAL;
    if (shouldUpdateStore) {
      lastStoreUpdateRef.current = now;
    }

    // Update all visible satellites
    satellites
      .filter((s) => s.isVisible)
      .forEach((sat) => {
        // Calculate position directly using satelliteStore's calculatePosition
        // This uses cached satrec and is already optimized
        const pos = calcPos(sat.id, time);

        if (pos) {
          // Update position in Zustand store - THROTTLED
          if (shouldUpdateStore) {
            updatePosition(sat.id, pos);
          }

          // Update info panel - THROTTLED
          if (sat.id === selectedSatelliteId && shouldUpdateStore) {
            setCurrentSatellitePosition(pos);
          }

          // Check orbit path update - with cooldown
          const lastOrbitUpdate = lastOrbitUpdateRef.current[sat.id] || 0;
          if (now - lastOrbitUpdate >= PERF_CONFIG.ORBIT_UPDATE_INTERVAL) {
            if (checkOrbitPathUpdate(sat.id, time) && wwdRef.current) {
              updateOrbitPath(wwdRef.current, sat.id, sat, time);
              lastOrbitUpdateRef.current[sat.id] = now;
            }
          }

          // Get satellite objects (sensor/payload configurations)
          const satObjects = sat.objects || [];

          // Find the default coverage object
          const coverageObject = satObjects.find((obj) => obj.isDefaultCoverage);

          // Coverage circle - THROTTLED with caching
          // Pass coverage object to use its settings (auto/manual mode, elevation angle, etc.)
          const circleCoords = updateCoverageIfNeeded(sat.id, pos, coverageObject);
          const boundaryLocations = circleCoords.map((coord) => new WorldWind.Location(coord.latitude, coord.longitude));

          // Get coverage visibility and colors from coverage object
          const showCoverage = coverageObject ? coverageObject.isVisible !== false : sat.showCoverage !== false;
          const coverageColor = coverageObject?.color || sat.color || { r: 0, g: 1, b: 0 };
          const fillOpacity = coverageObject?.fillOpacity ?? 0.15;
          const outlineOpacity = coverageObject?.outlineOpacity ?? 0.6;
          const outlineWidth = coverageObject?.outlineWidth ?? 1;

          // Get or create renderables for this satellite
          if (!satelliteRenderablesRef.current[sat.id]) {
            // Create main coverage polygon (satellite footprint)
            const polygonAttributes = new WorldWind.ShapeAttributes(null);
            polygonAttributes.interiorColor = new WorldWind.Color(coverageColor.r ?? 0, coverageColor.g ?? 1, coverageColor.b ?? 0, fillOpacity);
            polygonAttributes.outlineColor = new WorldWind.Color(coverageColor.r ?? 0, coverageColor.g ?? 1, coverageColor.b ?? 0, outlineOpacity);
            polygonAttributes.outlineWidth = outlineWidth;

            const coveragePolygon = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
            coveragePolygon.enabled = showCoverage;
            satelliteLayerRef.current.addRenderable(coveragePolygon);

            // Create placemark
            const placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
            placemarkAttributes.imageSource = `${WorldWind.configuration.baseUrl}images/LAPAN-A3.png`;
            placemarkAttributes.imageScale = 0.8;
            placemarkAttributes.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.5);
            placemarkAttributes.labelAttributes.color = WorldWind.Color.WHITE;
            placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 1.2);

            const placemark = new WorldWind.Placemark(new WorldWind.Position(pos.lat, pos.lon, 0), false, placemarkAttributes);
            placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
            satelliteLayerRef.current.addRenderable(placemark);

            // Calculate satellite heading from velocity or track angle
            // Use track angle if available, otherwise use a default
            const satHeading = pos.heading || pos.track || 0;

            // Create swath polygons for each sensor object (skip coverage object - it's rendered separately)
            const objectSwaths = {};
            const objectLabels = {};
            satObjects.forEach((obj) => {
              // Skip default coverage object - it's handled by the main coverage polygon
              if (obj.isDefaultCoverage) return;

              if (obj.isVisible !== false && obj.showSwath !== false && (obj.scanWidth > 0 || obj.swathWidth > 0)) {
                // Use generateSwathCoords for shape-aware swath generation
                const swathCoords = generateSwathCoords({ latitude: pos.lat, longitude: pos.lon }, obj, satHeading);
                const swathLocations = swathCoords.map((coord) => new WorldWind.Location(coord.latitude, coord.longitude));

                const swathAttributes = new WorldWind.ShapeAttributes(null);
                const objColor = obj.color || sat.color || { r: 0, g: 1, b: 0 };
                swathAttributes.interiorColor = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 0.25);
                swathAttributes.outlineColor = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 0.9);
                swathAttributes.outlineWidth = 2;

                const swathPolygon = new WorldWind.SurfacePolygon(swathLocations, swathAttributes);
                satelliteLayerRef.current.addRenderable(swathPolygon);
                objectSwaths[obj.id] = swathPolygon;

                // Create label for sensor object if showLabel is enabled
                if (obj.showLabel) {
                  const labelAttributes = new WorldWind.PlacemarkAttributes(null);
                  labelAttributes.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/plain-white.png";
                  labelAttributes.imageScale = 0;
                  labelAttributes.labelAttributes.color = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 1);
                  labelAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.5);

                  const labelPlacemark = new WorldWind.Placemark(new WorldWind.Position(pos.lat, pos.lon, 0), false, labelAttributes);
                  labelPlacemark.label = obj.name;
                  labelPlacemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                  satelliteLayerRef.current.addRenderable(labelPlacemark);
                  objectLabels[obj.id] = labelPlacemark;
                }
              }
            });

            satelliteRenderablesRef.current[sat.id] = {
              coveragePolygon,
              placemark,
              objectSwaths,
              objectLabels,
            };
          } else {
            // Update existing renderables - EVERY FRAME for smooth visual
            satelliteRenderablesRef.current[sat.id].coveragePolygon.boundaries = boundaryLocations;
            satelliteRenderablesRef.current[sat.id].coveragePolygon.enabled = showCoverage;
            satelliteRenderablesRef.current[sat.id].placemark.position = new WorldWind.Position(pos.lat, pos.lon, 0);

            // Calculate satellite heading for swath orientation
            const satHeading = pos.heading || pos.track || 0;

            // Update sensor object swaths and labels
            const existingSwaths = satelliteRenderablesRef.current[sat.id].objectSwaths || {};
            const existingLabels = satelliteRenderablesRef.current[sat.id].objectLabels || {};

            satObjects.forEach((obj) => {
              // Skip default coverage object
              if (obj.isDefaultCoverage) return;

              const objColor = obj.color || sat.color || { r: 0, g: 1, b: 0 };

              if (obj.isVisible !== false && obj.showSwath !== false && (obj.scanWidth > 0 || obj.swathWidth > 0)) {
                // Use generateSwathCoords for shape-aware swath generation
                const swathCoords = generateSwathCoords({ latitude: pos.lat, longitude: pos.lon }, obj, satHeading);
                const swathLocations = swathCoords.map((coord) => new WorldWind.Location(coord.latitude, coord.longitude));

                if (existingSwaths[obj.id]) {
                  // Update existing swath
                  existingSwaths[obj.id].boundaries = swathLocations;
                  existingSwaths[obj.id].enabled = true;
                } else {
                  // Create new swath for this object
                  const swathAttributes = new WorldWind.ShapeAttributes(null);
                  swathAttributes.interiorColor = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 0.25);
                  swathAttributes.outlineColor = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 0.9);
                  swathAttributes.outlineWidth = 2;

                  const swathPolygon = new WorldWind.SurfacePolygon(swathLocations, swathAttributes);
                  satelliteLayerRef.current.addRenderable(swathPolygon);
                  existingSwaths[obj.id] = swathPolygon;
                }

                // Handle label for sensor object
                if (obj.showLabel) {
                  if (existingLabels[obj.id]) {
                    // Update existing label position
                    existingLabels[obj.id].position = new WorldWind.Position(pos.lat, pos.lon, 0);
                    existingLabels[obj.id].enabled = true;
                  } else {
                    // Create new label
                    const labelAttributes = new WorldWind.PlacemarkAttributes(null);
                    labelAttributes.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/plain-white.png";
                    labelAttributes.imageScale = 0;
                    labelAttributes.labelAttributes.color = new WorldWind.Color(objColor.r ?? 0, objColor.g ?? 1, objColor.b ?? 0, 1);
                    labelAttributes.labelAttributes.offset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.5);

                    const labelPlacemark = new WorldWind.Placemark(new WorldWind.Position(pos.lat, pos.lon, 0), false, labelAttributes);
                    labelPlacemark.label = obj.name;
                    labelPlacemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                    satelliteLayerRef.current.addRenderable(labelPlacemark);
                    existingLabels[obj.id] = labelPlacemark;
                  }
                } else if (existingLabels[obj.id]) {
                  // Hide label if showLabel is false
                  existingLabels[obj.id].enabled = false;
                }
              } else {
                // Hide swath if object is not visible or showSwath is false
                if (existingSwaths[obj.id]) {
                  existingSwaths[obj.id].enabled = false;
                }
                // Also hide label
                if (existingLabels[obj.id]) {
                  existingLabels[obj.id].enabled = false;
                }
              }
            });

            // Hide swaths and labels for removed objects
            Object.keys(existingSwaths).forEach((objId) => {
              if (!satObjects.find((o) => o.id === objId)) {
                existingSwaths[objId].enabled = false;
              }
            });
            Object.keys(existingLabels).forEach((objId) => {
              if (!satObjects.find((o) => o.id === objId)) {
                existingLabels[objId].enabled = false;
              }
            });

            satelliteRenderablesRef.current[sat.id].objectSwaths = existingSwaths;
            satelliteRenderablesRef.current[sat.id].objectLabels = existingLabels;
          }

          // Update label - THROTTLED
          if (shouldUpdateStore && satelliteRenderablesRef.current[sat.id]) {
            satelliteRenderablesRef.current[sat.id].placemark.label = `${sat.name}\n${pos.alt.toFixed(1)} km`;
          }
        }
      });

    // OPTIMIZED: Only redraw when renderables were updated
    // WorldWind will handle its own animation frame scheduling for smooth rendering
    // We still call redraw but at a controlled rate
    if (satellites.filter((s) => s.isVisible).length > 0) {
      wwdRef.current.redraw();
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateSatelliteMarker);
  }, [checkOrbitPathUpdate, updateOrbitPath, updateCoverageIfNeeded]);

  // Setup layers when satellites are loaded
  useEffect(() => {
    if (wwdRef.current && !isLoading) {
      if (satellites.length > 0) {
        createOrbitLayer(wwdRef.current);
        createSatelliteLayer(wwdRef.current);
        createGroundStationLayer(wwdRef.current);
      } else {
        // Clear layers when no satellites
        if (orbitLayerRef.current) {
          wwdRef.current.removeLayer(orbitLayerRef.current);
          orbitLayerRef.current = null;
        }
        if (satelliteLayerRef.current) {
          wwdRef.current.removeLayer(satelliteLayerRef.current);
          satelliteLayerRef.current = null;
        }
        // Clear cached renderables
        satelliteRenderablesRef.current = {};
        orbitPathDataRef.current = {};
        coverageCacheRef.current = {};
        lastCoverageUpdateRef.current = {};
        lastOrbitUpdateRef.current = {};

        // Still update ground stations (they may exist without satellites)
        createGroundStationLayer(wwdRef.current);

        wwdRef.current.redraw();
      }
    }
  }, [isLoading, satellites.length, createOrbitLayer, createSatelliteLayer, createGroundStationLayer]);

  // Start animation loop - runs continuously, reads state from stores
  // Re-trigger when satellites change (e.g., after restore)
  useEffect(() => {
    if (wwdRef.current && !isLoading) {
      // Cancel any existing animation frame before starting new one
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Start the animation loop
      updateSatelliteMarker();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }
  }, [isLoading, updateSatelliteMarker, satellites.length]);

  // Detect changes in satellite objects and refresh renderables
  useEffect(() => {
    if (wwdRef.current && satelliteLayerRef.current && !isLoading) {
      // Create a hash of satellite objects to detect changes
      const _objectsHash = satellites.map((s) => ({
        id: s.id,
        objectsCount: s.objects?.length || 0,
        objectsData: JSON.stringify(s.objects || []),
        color: JSON.stringify(s.color),
        showCoverage: s.showCoverage,
      }));

      // Check if any satellite's objects have changed
      satellites.forEach((sat) => {
        const existing = satelliteRenderablesRef.current[sat.id];
        if (existing) {
          const currentObjectIds = Object.keys(existing.objectSwaths || {});
          const newObjectIds = (sat.objects || []).filter((o) => o.isVisible !== false && o.showSwath !== false).map((o) => o.id);

          // If objects changed significantly, clear the cached renderables to force recreation
          const objectsChanged =
            currentObjectIds.length !== newObjectIds.length ||
            !currentObjectIds.every((id) => newObjectIds.includes(id)) ||
            !newObjectIds.every((id) => currentObjectIds.includes(id));

          if (objectsChanged) {
            console.log(`🔄 Satellite ${sat.name} objects changed, refreshing renderables...`);

            // Remove old swaths from layer
            if (existing.objectSwaths) {
              Object.values(existing.objectSwaths).forEach((swath) => {
                satelliteLayerRef.current.removeRenderable(swath);
              });
            }

            // Clear cache to force recreation
            existing.objectSwaths = {};
          }
        }
      });

      wwdRef.current?.redraw();
    }
  }, [satellites, isLoading]);

  // Refresh orbit paths when mode changes (simulation <-> realtime)
  useEffect(() => {
    if (wwdRef.current && !isLoading && satellites.length > 0) {
      console.log(`🔄 Mode changed to ${mode}, refreshing orbit paths...`);

      // Clear orbit update timestamps to force refresh
      lastOrbitUpdateRef.current = {};

      // Get current time and refresh all orbit paths
      const currentTime = useTimeStore.getState().currentTime;
      satellites
        .filter((s) => s.isVisible)
        .forEach((sat) => {
          updateOrbitPath(wwdRef.current, sat.id, sat, currentTime);
        });

      wwdRef.current.redraw();
    }
  }, [mode, isLoading, satellites, updateOrbitPath]);

  // Update ground stations when they change (also when satellites change for tracking coverage colors)
  useEffect(() => {
    if (wwdRef.current && !isLoading) {
      createGroundStationLayer(wwdRef.current);
    }
  }, [groundStations, satellites, createGroundStationLayer, isLoading]);

  // Update pass trajectory layer when ground stations change (specifically passes)
  useEffect(() => {
    if (wwdRef.current && !isLoading) {
      createPassTrajectoryLayer(wwdRef.current);
      wwdRef.current.redraw();
    }
  }, [groundStations, createPassTrajectoryLayer, isLoading]);

  // Listener to disable vertical pan when stable
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventVerticalPan = () => {
      if (!wwdRef.current) return;

      if (isStableRef.current) {
        wwdRef.current.navigator.lookAtLocation.latitude = targetLatRef.current;
      } else {
        const currentLat = wwdRef.current.navigator.lookAtLocation.latitude;
        const delta = latDeltaRef.current;

        const maxLat = STABILITY_THRESHOLD - delta;
        const minLat = -STABILITY_THRESHOLD + delta;

        if (maxLat > minLat) {
          if (currentLat > maxLat) wwdRef.current.navigator.lookAtLocation.latitude = maxLat;
          if (currentLat < minLat) wwdRef.current.navigator.lookAtLocation.latitude = minLat;
        }
      }
    };

    canvas.addEventListener("mousemove", preventVerticalPan);
    canvas.addEventListener("touchmove", preventVerticalPan);
    canvas.addEventListener("wheel", preventVerticalPan);

    return () => {
      canvas.removeEventListener("mousemove", preventVerticalPan);
      canvas.removeEventListener("touchmove", preventVerticalPan);
      canvas.removeEventListener("wheel", preventVerticalPan);
    };
  }, []);

  // Initialize WorldWind - ONLY when canvas is ready with valid dimensions
  useEffect(() => {
    // Guard: Don't initialize until ResizeObserver says we're ready
    if (!isReady) {
      console.log("⏳ Waiting for canvas to be ready...");
      return;
    }

    if (!canvasRef.current) {
      console.log("⏳ Canvas ref not available yet...");
      return;
    }

    const canvas = canvasRef.current;

    // Ensure canvas attributes match container dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Double-check canvas has real dimensions
    if (dimensions.width < 200 || dimensions.height < 200) {
      console.log(`⚠️ Dimensions too small: ${dimensions.width} x ${dimensions.height}`);
      return;
    }

    const optimalRange = calculateOptimalRange(dimensions.height);

    console.log(`🚀 Initializing WorldWind with dimensions: ${dimensions.width} x ${dimensions.height}`);

    // If WorldWind already exists, recreate it for resize
    // WorldWind doesn't handle resize well, so we need to recreate
    if (wwdRef.current) {
      console.log(`🔄 Recreating WorldWind for new dimensions...`);
      // Clear existing layers and reset
      wwdRef.current = null;
      orbitLayerRef.current = null;
      satelliteLayerRef.current = null;
      groundStationLayerRef.current = null;
      baseLayerRef.current = null;
      coveragePolygonRef.current = null;
      satellitePlacemarkRef.current = null;
      satelliteRenderablesRef.current = {};
    }

    // Initialize WorldWind with a small delay to ensure canvas is rendered
    const initTimeout = setTimeout(() => {
      try {
        // Verify canvas dimensions one more time
        console.log(`📏 Canvas actual size: ${canvas.width} x ${canvas.height}`);
        console.log(`📏 Canvas client size: ${canvas.clientWidth} x ${canvas.clientHeight}`);

        const wwd = new WorldWind.WorldWindow(canvas);
        wwdRef.current = wwd;

        console.log("✅ WorldWindow created successfully");

        const flat = new WorldWind.Globe2D();
        flat.projection = new WorldWind.ProjectionEquirectangular();
        wwd.globe = flat;

        console.log("✅ Globe2D with Equirectangular projection set");

        let baseLayer;
        if (selectedLayer === "bmng") {
          baseLayer = new WorldWind.BMNGLayer();
        } else {
          baseLayer = new WorldWind.OpenStreetMapImageLayer("osm");
        }
        baseLayerRef.current = baseLayer;
        wwd.addLayer(baseLayer);

        const coordinatesLayer = new WorldWind.CoordinatesDisplayLayer(wwd);
        wwd.addLayer(coordinatesLayer);

        // Set navigator
        wwd.navigator.lookAtLocation.latitude = 0;
        wwd.navigator.lookAtLocation.longitude = 117;
        wwd.navigator.range = optimalRange;
        setRange(optimalRange);

        console.log(`✅ Initial range: ${(optimalRange / 1000).toFixed(0)} km`);
        console.log(`✅ Canvas dimensions: ${canvas.width} x ${canvas.height}`);

        // Force redraw
        wwd.redraw();

        // Reset loading state after WorldWind has time to render
        setTimeout(() => {
          setIsLoading(true); // Will be set to false by auto-fit logic
          statsValidRef.current = false;
          autoFitEnabledRef.current = true;
        }, 100);
      } catch (error) {
        console.error("❌ Failed to initialize WorldWind:", error);
      }
    }, 50);

    return () => clearTimeout(initTimeout);
  }, [isReady, dimensions.width, dimensions.height, selectedLayer]);

  // Handle manual Range Change from UI input
  useEffect(() => {
    if (wwdRef.current && range !== null) {
      wwdRef.current.navigator.range = range;
      wwdRef.current.redraw();
    }
  }, [range]);

  // Handle Layer Change
  useEffect(() => {
    if (!wwdRef.current || !baseLayerRef.current) return;
    const wwd = wwdRef.current;

    wwd.removeLayer(baseLayerRef.current);

    let newBaseLayer;
    if (selectedLayer === "bmng") {
      newBaseLayer = new WorldWind.BMNGLayer();
    } else {
      newBaseLayer = new WorldWind.OpenStreetMapImageLayer("osm");
    }

    wwd.insertLayer(0, newBaseLayer);
    baseLayerRef.current = newBaseLayer;

    console.log(`✅ Layer changed to: ${selectedLayer}`);

    const optimalRange = calculateOptimalRange(dimensions.height);
    wwd.navigator.range = optimalRange;
    wwd.navigator.lookAtLocation.latitude = 0;
    wwd.navigator.lookAtLocation.longitude = 50;
    setRange(optimalRange);
    setIsLoading(true);
    statsValidRef.current = false;
    autoFitEnabledRef.current = true;

    wwd.redraw();
  }, [selectedLayer, dimensions.height]);

  // Auto-Adjust Range & Pan to Fit World Vertically
  useEffect(() => {
    if (!wwdRef.current || dimensions.height === 0) return;
    const wwd = wwdRef.current;
    const { top, bottom } = borderStats;

    const absTop = top ? Math.abs(top.lat) : 0;
    const absBottom = bottom ? Math.abs(bottom.lat) : 0;
    const avgLat = (absTop + absBottom) / 2;

    const isStable = statsValidRef.current && top && bottom && avgLat >= STABILITY_THRESHOLD;

    isStableRef.current = isStable;

    if (!autoFitEnabledRef.current && statsValidRef.current && (!top || !bottom)) {
      setIsLoading(true);
      autoFitEnabledRef.current = true;
      setRange(wwd.navigator.range);
    }

    if (autoFitEnabledRef.current && statsValidRef.current) {
      if (isStable) {
        setIsLoading(false);
        autoFitEnabledRef.current = false;
      }

      if (top && bottom) {
        const diff = absTop - absBottom;

        if (Math.abs(diff) > 0.1) {
          const correction = Math.sign(diff) * Math.min(Math.abs(diff) * 0.1, 0.5);
          wwd.navigator.lookAtLocation.latitude -= correction;
        }
      } else {
        wwd.navigator.lookAtLocation.latitude = 0;
      }

      if (!isStable) {
        if (!top || !bottom) {
          setRange((prev) => prev * 0.95);
        } else {
          const currentLat = Math.abs(top.lat);

          if (currentLat < STABILITY_THRESHOLD && currentLat > 0.1) {
            let ratio = CALC_TARGET / currentLat;
            ratio = Math.min(ratio, 2.0);
            setRange((prev) => prev * ratio);
          }
        }
      }
    }

    targetLatRef.current = wwd.navigator.lookAtLocation.latitude;
  }, [borderStats, dimensions.height]);

  // Border Sensors
  useEffect(() => {
    const interval = setInterval(() => {
      if (!wwdRef.current || !canvasRef.current) return;
      const wwd = wwdRef.current;
      const { width, height } = dimensions;
      if (width <= 0 || height <= 0) return;

      const getPick = (x, y) => {
        const pickList = wwd.pickTerrain(new WorldWind.Vec2(x, y));
        if (pickList.objects.length > 0 && pickList.objects[0].position) {
          return {
            lat: pickList.objects[0].position.latitude,
            lon: pickList.objects[0].position.longitude,
          };
        }
        return null;
      };

      const top = getPick(width / 2, 5);
      const bottom = getPick(width / 2, height - 5);
      const left = getPick(5, height / 2);
      const right = getPick(width - 5, height / 2);

      statsValidRef.current = true;

      if (top && bottom) {
        latDeltaRef.current = Math.abs(top.lat - bottom.lat) / 2;
      }

      setBorderStats({ top, bottom, left, right });
    }, BORDER_SENSOR_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [dimensions]);

  // Mouse Handler
  const handleMouseMoveInternal = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lon = (x / dimensions.width) * 360 - 180;
    const lat = 90 - (y / dimensions.height) * 180;

    onMouseMove({ lat, lon });
  };

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (!wwdRef.current) return;
    const newRange = wwdRef.current.navigator.range * 0.7;
    wwdRef.current.navigator.range = Math.max(newRange, 500); // Min 500m
    setRange(wwdRef.current.navigator.range);
    wwdRef.current.redraw();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!wwdRef.current) return;
    const newRange = wwdRef.current.navigator.range * 1.4;
    wwdRef.current.navigator.range = Math.min(newRange, 30000000); // Max 30,000km
    setRange(wwdRef.current.navigator.range);
    wwdRef.current.redraw();
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!wwdRef.current) return;
    const optimalRange = calculateOptimalRange(dimensions.height);
    wwdRef.current.navigator.range = optimalRange;
    wwdRef.current.navigator.lookAtLocation.latitude = 0;
    wwdRef.current.navigator.lookAtLocation.longitude = 117;
    setRange(optimalRange);
    wwdRef.current.redraw();
  }, [dimensions.height]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-slate-950 relative overflow-hidden">
      <div
        style={{
          width: dimensions.width,
          height: dimensions.height,
          transition: "width 0.1s, height 0.1s",
        }}
        className="relative shadow-2xl border border-slate-700 bg-black"
      >
        <LoadingOverlay isLoading={isLoading} />

        <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} onMouseMove={handleMouseMoveInternal} className="w-full h-full cursor-crosshair block">
          Your browser does not support HTML5 Canvas.
        </canvas>

        <BorderSensors borderStats={borderStats} isLoading={isLoading} />

        <EngineStatusPanel
          dimensions={dimensions}
          range={range}
          setRange={setRange}
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          layerOptions={LAYER_OPTIONS}
          isLoading={isLoading}
        />

        {/* <SatelliteInfoPanel
          satelliteName={getSelectedSatellite()?.name || "No Satellite"}
          satellitePosition={currentSatellitePosition}
          noradId={getSelectedSatellite()?.noradId || "-"}
          period="~97.4 min"
          satellite={getSelectedSatellite()}
          isLoading={isLoading}
        /> */}

        {/* Floating Zoom Controls */}
        {!isLoading && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-30">
            <button
              onClick={handleZoomIn}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center text-slate-200 hover:text-white transition-colors shadow-lg backdrop-blur-sm"
              title="Zoom In"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomReset}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center text-slate-200 hover:text-white transition-colors shadow-lg backdrop-blur-sm"
              title="Reset View"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center text-slate-200 hover:text-white transition-colors shadow-lg backdrop-blur-sm"
              title="Zoom Out"
            >
              <Minus className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Globe2D;
