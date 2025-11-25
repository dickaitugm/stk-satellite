/**
 * Globe2D Component
 * Main WorldWind 2D globe with satellite tracking
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldWind from "worldwindjs";

// Hooks
import { useResizeObserver } from '../../hooks';

// Stores
import { 
  useSatelliteStore, 
  useGroundStationStore, 
  useTimeStore,
  useScenarioStore 
} from '../../stores';

// Utils
import { 
  LAYER_OPTIONS, 
  STABILITY_THRESHOLD, 
  CALC_TARGET,
  BORDER_SENSOR_INTERVAL_MS 
} from '../../utils/constants';
import { calculateOptimalRange } from '../../utils/rangeCalculator';
import { calculateCoverageRadius, geodesicCircleCoords } from '../../utils/geodesic';

// Sub-components
import BorderSensors from './BorderSensors';
import EngineStatusPanel from './EngineStatusPanel';
import SatelliteInfoPanel from './SatelliteInfoPanel';
import LoadingOverlay from './LoadingOverlay';

// Configure WorldWind base URL
WorldWind.configuration.baseUrl = "./worldwind/";

const Globe2D = ({ onMouseMove }) => {
  // Custom hooks
  const { containerRef, dimensions, isReady } = useResizeObserver();
  
  // Zustand stores
  const satellites = useSatelliteStore(state => state.satellites);
  const selectedSatelliteId = useSatelliteStore(state => state.selectedSatelliteId);
  const getSelectedSatellite = useSatelliteStore(state => state.getSelectedSatellite);
  const calculatePosition = useSatelliteStore(state => state.calculatePosition);
  const updatePosition = useSatelliteStore(state => state.updatePosition);
  const getSatrec = useSatelliteStore(state => state.getSatrec);
  
  const groundStations = useGroundStationStore(state => state.groundStations);
  const getVisibleStations = useGroundStationStore(state => state.getVisibleStations);
  
  const currentTime = useTimeStore(state => state.currentTime);
  const isPlaying = useTimeStore(state => state.isPlaying);
  const tick = useTimeStore(state => state.tick);
  
  const scenarioLayers = useScenarioStore(state => state.layers);

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
  const satelliteRenderablesRef = useRef({}); // Store renderables per satellite

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState('osm');
  const [currentSatellitePosition, setCurrentSatellitePosition] = useState({ lat: 0, lon: 0, alt: 0 });
  const [borderStats, setBorderStats] = useState({
    top: null,
    bottom: null,
    left: null,
    right: null
  });

  // Generate orbit path for a satellite
  const generateOrbitPath = useCallback((satelliteId) => {
    const satrec = getSatrec(satelliteId);
    if (!satrec) return [];
    
    const points = [];
    const now = currentTime;
    const periodMinutes = 100; // Approximate orbital period
    const step = 1; // minutes
    
    for (let i = 0; i < periodMinutes; i += step) {
      const time = new Date(now.getTime() + i * 60 * 1000);
      const pos = calculatePosition(satelliteId, time);
      if (pos) {
        points.push(pos);
      }
    }
    
    return points;
  }, [getSatrec, calculatePosition, currentTime]);

  // Create orbit path layer
  const createOrbitLayer = useCallback((wwd) => {
    if (orbitLayerRef.current) {
      wwd.removeLayer(orbitLayerRef.current);
    }
    
    const orbitLayer = new WorldWind.RenderableLayer("Orbit Path");
    
    // Create orbit paths for all visible satellites
    satellites.filter(s => s.isVisible).forEach(sat => {
      const orbitPoints = generateOrbitPath(sat.id);
      
      if (orbitPoints.length > 1) {
        const pathPositions = orbitPoints.map(point => 
          new WorldWind.Position(point.lat, point.lon, point.alt * 1000)
        );
        
        const pathAttributes = new WorldWind.ShapeAttributes(null);
        pathAttributes.outlineColor = new WorldWind.Color(
          sat.color?.r || 0, 
          sat.color?.g || 1, 
          sat.color?.b || 1, 
          sat.color?.a || 0.8
        );
        pathAttributes.outlineWidth = 2;
        pathAttributes.drawInterior = false;
        
        const path = new WorldWind.Path(pathPositions, pathAttributes);
        path.altitudeMode = WorldWind.ABSOLUTE;
        path.extrude = false;
        path.useSurfaceShapeFor2D = true;
        
        orbitLayer.addRenderable(path);
      }
    });
    
    orbitLayerRef.current = orbitLayer;
    wwd.addLayer(orbitLayer);
    
    console.log(`✅ Orbit paths created for ${satellites.filter(s => s.isVisible).length} satellites`);
  }, [satellites, generateOrbitPath]);

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
  const createGroundStationLayer = useCallback((wwd) => {
    if (groundStationLayerRef.current) {
      wwd.removeLayer(groundStationLayerRef.current);
    }
    
    const gsLayer = new WorldWind.RenderableLayer("Ground Stations");
    
    getVisibleStations().forEach(gs => {
      // Ground station placemark
      const placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
      placemarkAttributes.imageSource = WorldWind.configuration.baseUrl + "images/pushpins/plain-red.png";
      placemarkAttributes.imageScale = 0.8;
      placemarkAttributes.imageOffset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.3,
        WorldWind.OFFSET_FRACTION, 0.0
      );
      placemarkAttributes.labelAttributes.color = WorldWind.Color.YELLOW;
      placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(
        WorldWind.OFFSET_FRACTION, 0.5,
        WorldWind.OFFSET_FRACTION, 1.5
      );
      
      const placemark = new WorldWind.Placemark(
        new WorldWind.Position(gs.location.lat, gs.location.lon, 0),
        false,
        placemarkAttributes
      );
      placemark.label = gs.name;
      placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
      
      gsLayer.addRenderable(placemark);
      
      // Optional: Ground station coverage circle
      if (gs.antenna?.maxRange) {
        const coverageCoords = geodesicCircleCoords(
          { latitude: gs.location.lat, longitude: gs.location.lon },
          gs.antenna.maxRange
        );
        
        const boundaryLocations = coverageCoords.map(
          (coord) => new WorldWind.Location(coord.latitude, coord.longitude)
        );
        
        const polygonAttributes = new WorldWind.ShapeAttributes(null);
        polygonAttributes.interiorColor = new WorldWind.Color(
          gs.color?.r || 1, 
          gs.color?.g || 0.5, 
          gs.color?.b || 0, 
          0.1
        );
        polygonAttributes.outlineColor = new WorldWind.Color(
          gs.color?.r || 1, 
          gs.color?.g || 0.5, 
          gs.color?.b || 0, 
          0.6
        );
        polygonAttributes.outlineWidth = 1;
        
        const coveragePolygon = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
        gsLayer.addRenderable(coveragePolygon);
      }
    });
    
    groundStationLayerRef.current = gsLayer;
    wwd.addLayer(gsLayer);
    
    console.log(`✅ Ground stations layer created with ${getVisibleStations().length} stations`);
  }, [groundStations, getVisibleStations]);

  // Update satellite position with animation
  const updateSatelliteMarker = useCallback(() => {
    if (!wwdRef.current || !satelliteLayerRef.current) return;
    
    const time = currentTime;
    
    // Update all visible satellites
    satellites.filter(s => s.isVisible).forEach(sat => {
      const pos = calculatePosition(sat.id, time);
      
      if (pos) {
        // Update position in store
        updatePosition(sat.id, pos);
        
        // Update current satellite position for info panel (selected satellite)
        if (sat.id === selectedSatelliteId) {
          setCurrentSatellitePosition(pos);
        }
        
        // Coverage circle
        const radiusKm = calculateCoverageRadius(pos.alt);
        const center = { latitude: pos.lat, longitude: pos.lon };
        const circleCoords = geodesicCircleCoords(center, radiusKm);
        
        const boundaryLocations = circleCoords.map(
          (coord) => new WorldWind.Location(coord.latitude, coord.longitude)
        );
        
        // Get or create renderables for this satellite
        if (!satelliteRenderablesRef.current[sat.id]) {
          // Create coverage polygon
          const polygonAttributes = new WorldWind.ShapeAttributes(null);
          polygonAttributes.interiorColor = new WorldWind.Color(
            sat.color?.r || 0, 
            sat.color?.g || 1, 
            sat.color?.b || 0, 
            0.2
          );
          polygonAttributes.outlineColor = new WorldWind.Color(
            sat.color?.r || 0, 
            sat.color?.g || 1, 
            sat.color?.b || 0, 
            0.8
          );
          polygonAttributes.outlineWidth = 1.5;
          
          const coveragePolygon = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
          satelliteLayerRef.current.addRenderable(coveragePolygon);
          
          // Create placemark
          const placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
          placemarkAttributes.imageSource = `${WorldWind.configuration.baseUrl}images/LAPAN-A3.png`;
          placemarkAttributes.imageScale = 0.8;
          placemarkAttributes.imageOffset = new WorldWind.Offset(
            WorldWind.OFFSET_FRACTION, 0.5,
            WorldWind.OFFSET_FRACTION, 0.5
          );
          placemarkAttributes.labelAttributes.color = WorldWind.Color.WHITE;
          placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(
            WorldWind.OFFSET_FRACTION, 0.5,
            WorldWind.OFFSET_FRACTION, 2.0
          );
          
          const placemark = new WorldWind.Placemark(
            new WorldWind.Position(pos.lat, pos.lon, 0),
            false,
            placemarkAttributes
          );
          placemark.altitudeMode = WorldWind.CLAMP_TO_GROUND;
          satelliteLayerRef.current.addRenderable(placemark);
          
          satelliteRenderablesRef.current[sat.id] = {
            coveragePolygon,
            placemark
          };
        } else {
          // Update existing renderables
          satelliteRenderablesRef.current[sat.id].coveragePolygon.boundaries = boundaryLocations;
          satelliteRenderablesRef.current[sat.id].placemark.position = new WorldWind.Position(pos.lat, pos.lon, 0);
        }
        
        // Update label
        satelliteRenderablesRef.current[sat.id].placemark.label = `${sat.name}\n${pos.alt.toFixed(1)} km`;
      }
    });
    
    wwdRef.current.redraw();
    
    // Continue animation
    if (isPlaying) {
      tick();
    }
    animationFrameRef.current = requestAnimationFrame(updateSatelliteMarker);
  }, [satellites, selectedSatelliteId, currentTime, isPlaying, calculatePosition, updatePosition, tick]);

  // Start satellite animation when WorldWind is ready
  useEffect(() => {
    if (wwdRef.current && satellites.length > 0 && !isLoading) {
      createOrbitLayer(wwdRef.current);
      createSatelliteLayer(wwdRef.current);
      createGroundStationLayer(wwdRef.current);
      updateSatelliteMarker();
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isLoading, satellites.length, createOrbitLayer, createSatelliteLayer, createGroundStationLayer]);

  // Update ground stations when they change
  useEffect(() => {
    if (wwdRef.current && !isLoading) {
      createGroundStationLayer(wwdRef.current);
    }
  }, [groundStations, createGroundStationLayer, isLoading]);

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

    canvas.addEventListener('mousemove', preventVerticalPan);
    canvas.addEventListener('touchmove', preventVerticalPan);
    canvas.addEventListener('wheel', preventVerticalPan);

    return () => {
      canvas.removeEventListener('mousemove', preventVerticalPan);
      canvas.removeEventListener('touchmove', preventVerticalPan);
      canvas.removeEventListener('wheel', preventVerticalPan);
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
        if (selectedLayer === 'bmng') {
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
  }, [isReady, dimensions.width, dimensions.height]);

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
    if (selectedLayer === 'bmng') {
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
  }, [selectedLayer]);

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
          setRange(prev => prev * 0.95);
        } else {
          const currentLat = Math.abs(top.lat);
          
          if (currentLat < STABILITY_THRESHOLD && currentLat > 0.1) {
            let ratio = CALC_TARGET / currentLat;
            ratio = Math.min(ratio, 2.0); 
            setRange(prev => prev * ratio);
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
            lon: pickList.objects[0].position.longitude
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

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center bg-slate-950 relative overflow-hidden"
    >
      <div 
        style={{ 
          width: dimensions.width, 
          height: dimensions.height,
          transition: 'width 0.1s, height 0.1s'
        }}
        className="relative shadow-2xl border border-slate-700 bg-black"
      >
        <LoadingOverlay isLoading={isLoading} />

        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMoveInternal}
          className="w-full h-full cursor-crosshair block"
        >
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

        <SatelliteInfoPanel 
          satelliteName={getSelectedSatellite()?.name || 'No Satellite'}
          satellitePosition={currentSatellitePosition}
          noradId={getSelectedSatellite()?.noradId || '-'}
          period="~97.4 min"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default Globe2D;
