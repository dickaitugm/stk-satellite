import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, FastForward, Rewind, 
  Settings, Globe, Map as MapIcon, 
  Monitor, Info, Crosshair, Satellite
} from 'lucide-react';
import WorldWind from "worldwindjs";
import * as satellite from 'satellite.js';

// TLE Data untuk LAPAN-A2
const LAPAN_A2_TLE = {
  name: 'LAPAN-A2',
  line1: '1 40931U 00000    25329.16366898  .00000000  00000-0 -12415-2 0    04',
  line2: '2 40931   5.9967 190.3873 0012662 345.8950  58.4170 14.79004108  3470'
};


/**
 * KOMPONEN: TopNavbar
 */
const TopNavbar = ({ isSimulating, toggleSimulation, simSpeed, setSimSpeed }) => {
  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 select-none flex-shrink-0 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-wider">
          <Globe className="w-6 h-6" />
          <span>ORBIT<span className="text-white">SIM</span> v2.0 (WW)</span>
        </div>
        <div className="h-6 w-px bg-slate-700 mx-2" />
        <div className="hidden md:flex gap-4 text-sm text-slate-300 font-medium">
          <button className="hover:text-white transition-colors">File</button>
          <button className="hover:text-white transition-colors">Edit</button>
          <button className="hover:text-white transition-colors">View</button>
          <button className="hover:text-white transition-colors">Analysis</button>
        </div>
      </div>

      <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
        <button className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
          <Rewind className="w-4 h-4" />
        </button>
        <button 
          onClick={toggleSimulation}
          className={`p-1.5 mx-1 rounded text-white ${isSimulating ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white">
          <FastForward className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-right hidden sm:block">
          <div className="text-slate-400">UTC Time</div>
          <div className="font-mono text-emerald-400">{new Date().toISOString().split('T')[1].split('.')[0]}</div>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

/**
 * KOMPONEN: BottomNavbar
 */
const BottomNavbar = ({ cursorCoords, activeSatellite }) => {
  return (
    <div className="h-8 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-4 text-xs select-none flex-shrink-0 z-50">
      <div className="flex items-center gap-6 text-slate-400">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeSatellite ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>Status: {activeSatellite ? "ACTIVE" : "READY"}</span>
        </div>
        <div className="hidden sm:block">
          <span>Projection: Equirectangular (2:1)</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4 font-mono text-slate-300">
        <div className="flex items-center gap-1 w-32">
          <Crosshair className="w-3 h-3 text-blue-400" />
          <span>
            Lat: {cursorCoords.lat.toFixed(2)}°
          </span>
        </div>
        <div className="flex items-center gap-1 w-32">
          <Crosshair className="w-3 h-3 text-blue-400" />
          <span>
            Lon: {cursorCoords.lon.toFixed(2)}°
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * KOMPONEN: Globe2D (WorldWind Implementation)
 */
/**
 * Menghitung range yang diperlukan untuk menampilkan full map (-90 to 90 latitude)
 * pada proyeksi Equirectangular berdasarkan tinggi canvas.
 * 
 * Untuk WorldWind 2D Equirectangular, range ~23,200 km untuk full map.
 */
const calculateOptimalRange = (canvasHeight) => {
  if (canvasHeight <= 0) return 23200000; // Default fallback 23,200 km
  
  // Berdasarkan testing empiris, full map tercapai pada ~23,200 km
  const optimalRange = 23200000; // 23,200 km dalam meter
  
  return optimalRange;
};

const Globe2D = ({ isSimulating, onMouseMove }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const wwdRef = useRef(null);
  const isStableRef = useRef(false); // Ref for stability status
  const targetLatRef = useRef(0); // Ref for target latitude
  const latDeltaRef = useRef(45); // Ref for visible latitude delta
  const statsValidRef = useRef(false); // Ref to track if stats correspond to current dimensions
  const autoFitEnabledRef = useRef(true); // Ref to track if auto-fit logic should run
  const baseLayerRef = useRef(null); // Ref for current base layer
  const orbitLayerRef = useRef(null); // Ref for orbit path layer
  const satelliteLayerRef = useRef(null); // Ref for satellite position layer
  const animationFrameRef = useRef(null); // Ref for animation frame
  const satrec = useRef(null); // Ref for satellite record (parsed TLE)
  const coveragePolygonRef = useRef(null); // Ref for coverage polygon (reuse to prevent blinking)
  const satellitePlacemarkRef = useRef(null); // Ref for satellite placemark (reuse to prevent blinking)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(null); // Start with null, will be calculated
  const [selectedLayer, setSelectedLayer] = useState('osm'); // 'bmng' or 'osm'
  const [showLayerDropdown, setShowLayerDropdown] = useState(false);
  const [satellitePosition, setSatellitePosition] = useState({ lat: 0, lon: 0, alt: 0 });
  const [borderStats, setBorderStats] = useState({
    top: null,
    bottom: null,
    left: null,
    right: null
  });

  WorldWind.configuration.baseUrl = "./worldwind/";

  // Layer options
  const layerOptions = [
    { id: 'bmng', name: 'Blue Marble (NASA)', icon: '🌍' },
    { id: 'osm', name: 'OpenStreetMap', icon: '🗺️' }
  ];

  // Curved function for coverage satellite
  const curvedFunction = (height) => {
    const Re = 6371;
    const cosTheta = Re / (Re + height);
    const theta = Math.acos(cosTheta);
    const curvedKm = Re * theta;
    return curvedKm;
  }

  const geodesicCircleCoords = (center, radiusKm, nPoints = 361) => {
      const earthRadius = 6371;
      const angles = Array.from({ length: nPoints }, (_, i) => (i * 360) / (nPoints - 1));
      const circleCoords = [];

      const lat1 = (center.latitude * Math.PI) / 180;
      const lon1 = (center.longitude * Math.PI) / 180;
      const d = radiusKm / earthRadius;

      angles.forEach((bearing) => {
          const bearingRad = (bearing * Math.PI) / 180;
          const lat2 = Math.asin(
              Math.sin(lat1) * Math.cos(d) +
                  Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
          );
          const lon2 =
              lon1 +
              Math.atan2(
                  Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
                  Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
              );
          const latDeg = (lat2 * 180) / Math.PI;
          const lonDeg = (((lon2 * 180) / Math.PI + 540) % 360) - 180;
          circleCoords.push({ longitude: lonDeg, latitude: latDeg });
      });

      return circleCoords;
  }

  // Parse TLE and initialize satellite record
  useEffect(() => {
    try {
      satrec.current = satellite.twoline2satrec(LAPAN_A2_TLE.line1, LAPAN_A2_TLE.line2);
      console.log('✅ TLE parsed successfully for', LAPAN_A2_TLE.name);
    } catch (error) {
      console.error('Failed to parse TLE:', error);
    }
  }, []);

  // Function to get satellite position at a given time
  const getSatellitePosition = (date) => {
    if (!satrec.current) return null;
    
    const positionAndVelocity = satellite.propagate(satrec.current, date);
    if (!positionAndVelocity.position) return null;
    
    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
    
    return {
      lat: satellite.degreesLat(positionGd.latitude),
      lon: satellite.degreesLong(positionGd.longitude),
      alt: positionGd.height // in km
    };
  };

  // Function to generate orbit path points for 1 pass
  const generateOrbitPath = () => {
    if (!satrec.current) return [];
    
    const points = [];
    const now = new Date();
    
    // Mean motion dari TLE adalah 14.79004108 rev/day
    // Periode orbit = 1440 / 14.79004108 = ~97.36 menit
    const orbitPeriodMinutes = 1440 / 14.79004108;
    
    // Generate points setiap 2 menit untuk 1 orbit penuh
    const intervalMinutes = 2;
    const totalPoints = Math.ceil(orbitPeriodMinutes / intervalMinutes);
    
    for (let i = 0; i <= totalPoints; i++) {
      const time = new Date(now.getTime() + i * intervalMinutes * 60 * 1000);
      const pos = getSatellitePosition(time);
      if (pos) {
        points.push({
          ...pos,
          time: time
        });
      }
    }
    
    return points;
  };

  // Create orbit path layer
  const createOrbitLayer = (wwd) => {
    if (orbitLayerRef.current) {
      wwd.removeLayer(orbitLayerRef.current);
    }
    
    const orbitLayer = new WorldWind.RenderableLayer("Orbit Path");
    const orbitPoints = generateOrbitPath();
    
    if (orbitPoints.length > 1) {
      // Create path positions
      const pathPositions = orbitPoints.map(point => 
        new WorldWind.Position(point.lat, point.lon, point.alt * 1000) // Convert km to meters
      );
      
      // Create path with styling
      const pathAttributes = new WorldWind.ShapeAttributes(null);
      pathAttributes.outlineColor = new WorldWind.Color(0, 1, 1, 0.8); // Cyan
      pathAttributes.outlineWidth = 2;
      pathAttributes.drawInterior = false;
      
      const path = new WorldWind.Path(pathPositions, pathAttributes);
      path.altitudeMode = WorldWind.ABSOLUTE;
      // path.followTerrain = false;
      path.extrude = false;
      path.useSurfaceShapeFor2D = true;
      
      orbitLayer.addRenderable(path);
      
    }
    
    orbitLayerRef.current = orbitLayer;
    wwd.addLayer(orbitLayer);
    
    console.log(`✅ Orbit path created with ${orbitPoints.length} points`);
  };

  // Create satellite marker layer
  const createSatelliteLayer = (wwd) => {
    if (satelliteLayerRef.current) {
      wwd.removeLayer(satelliteLayerRef.current);
    }
    
    // Reset refs when creating new layer
    coveragePolygonRef.current = null;
    satellitePlacemarkRef.current = null;
    
    const satLayer = new WorldWind.RenderableLayer("Satellite");
    satelliteLayerRef.current = satLayer;
    wwd.addLayer(satLayer);
  };

  // Update satellite position with animation
  const updateSatelliteMarker = () => {
    if (!wwdRef.current || !satelliteLayerRef.current || !satrec.current) return;
    
    const now = new Date();
    const pos = getSatellitePosition(now);
    
    if (pos) {
      setSatellitePosition(pos);
      
      // === COVERAGE CIRCLE ===
      // Calculate coverage radius using curved function
      const radiusKm = curvedFunction(pos.alt);
      const center = { latitude: pos.lat, longitude: pos.lon };
      const circleCoords = geodesicCircleCoords(center, radiusKm);
      
      // Create boundary locations for the coverage polygon
      const boundaryLocations = circleCoords.map(
        (coord) => new WorldWind.Location(coord.latitude, coord.longitude)
      );
      
      // Reuse or create coverage polygon (prevents blinking)
      if (!coveragePolygonRef.current) {
        const polygonAttributes = new WorldWind.ShapeAttributes(null);
        polygonAttributes.interiorColor = new WorldWind.Color(0, 1, 0, 0.2); // Green with transparency
        polygonAttributes.outlineColor = new WorldWind.Color(0, 1, 0, 0.8); // Green outline
        polygonAttributes.outlineWidth = 1.5;
        
        coveragePolygonRef.current = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
        satelliteLayerRef.current.addRenderable(coveragePolygonRef.current);
      } else {
        // Update existing polygon boundaries
        coveragePolygonRef.current.boundaries = boundaryLocations;
      }
      
      // === SATELLITE PLACEMARK ===
      // Reuse or create satellite placemark (prevents blinking)
      if (!satellitePlacemarkRef.current) {
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
        
        satellitePlacemarkRef.current = new WorldWind.Placemark(
          new WorldWind.Position(pos.lat, pos.lon, 0),
          false,
          placemarkAttributes
        );
        satellitePlacemarkRef.current.altitudeMode = WorldWind.CLAMP_TO_GROUND;
        satelliteLayerRef.current.addRenderable(satellitePlacemarkRef.current);
      } else {
        // Update existing placemark position
        satellitePlacemarkRef.current.position = new WorldWind.Position(pos.lat, pos.lon, 0);
      }
      
      // Update label
      satellitePlacemarkRef.current.label = `${LAPAN_A2_TLE.name}\n${pos.alt.toFixed(1)} km`;
      
      wwdRef.current.redraw();
    }
    
    // Continue animation
    animationFrameRef.current = requestAnimationFrame(updateSatelliteMarker);
  };

  // Start satellite animation when WorldWind is ready
  useEffect(() => {
    if (wwdRef.current && satrec.current && !isLoading) {
      // Create layers
      createOrbitLayer(wwdRef.current);
      createSatelliteLayer(wwdRef.current);
      
      // Start animation
      updateSatelliteMarker();
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isLoading]);

  // Listener to disable vertical pan when stable
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventVerticalPan = () => {
      if (!wwdRef.current) return;

      if (isStableRef.current) {
        // Lock latitude to target when stable (Full View)
        wwdRef.current.navigator.lookAtLocation.latitude = targetLatRef.current;
      } else {
        // Clamp latitude when zoomed in (Manual Pan)
        // Prevent panning beyond STABILITY_THRESHOLD (88 degrees)
        const STABILITY_THRESHOLD = 89;
        const currentLat = wwdRef.current.navigator.lookAtLocation.latitude;
        const delta = latDeltaRef.current;
        
        // Calculate safe bounds based on current zoom level (delta)
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
  
  // 1. Load WorldWindJS
  // const isScriptLoaded = useWorldWindScript("https://files.worldwind.arc.nasa.gov/artifactory/web/0.9.0/worldwind.min.js");

  // 2. Resize Logic (Memaksa rasio 2:1)
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const parent = containerRef.current;
      const availableWidth = parent.clientWidth;
      const availableHeight = parent.clientHeight;
      
      const targetRatio = 2 / 1;
      let newWidth = availableWidth;
      let newHeight = availableWidth / targetRatio;
      
      if (newHeight > availableHeight) {
        newHeight = availableHeight;
        newWidth = availableHeight * targetRatio;
      }
      
      setDimensions({ width: newWidth, height: newHeight });
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);

  // 3. Initialize WorldWind - Now depends on dimensions being ready
  useEffect(() => {
    if (!canvasRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    // Calculate optimal range based on canvas height
    const optimalRange = calculateOptimalRange(dimensions.height);

    // If WorldWind already exists, just update the range
    if (wwdRef.current) {
      wwdRef.current.navigator.range = optimalRange;
      wwdRef.current.navigator.lookAtLocation.latitude = 0;
      wwdRef.current.navigator.lookAtLocation.longitude = 50;
      setRange(optimalRange);
      setIsLoading(true);
      statsValidRef.current = false; // Invalidate stats
      autoFitEnabledRef.current = true; // Re-enable auto-fit on resize
      wwdRef.current.redraw();
      return;
    }

    try {
      // Create WorldWind instance
      const wwd = new WorldWind.WorldWindow(canvasRef.current);
      wwdRef.current = wwd;
      
      console.log("✅ WorldWindow created successfully");

      // Create Globe2D with equirectangular projection
      const flat = new WorldWind.Globe2D();
      flat.projection = new WorldWind.ProjectionEquirectangular();
      wwd.globe = flat;
      
      console.log("✅ Globe2D with Equirectangular projection set");

      // Add base layer based on selection
      let baseLayer;
      if (selectedLayer === 'bmng') {
        baseLayer = new WorldWind.BMNGLayer();
      } else {
        baseLayer = new WorldWind.OpenStreetMapImageLayer("osm");
      }
      baseLayerRef.current = baseLayer;
      wwd.addLayer(baseLayer);

      // Add Coordinates Display Layer
      const coordinatesLayer = new WorldWind.CoordinatesDisplayLayer(wwd);
      wwd.addLayer(coordinatesLayer);

      // Setup view agar pas di tengah (lookAt 0,0) dengan range yang dihitung
      wwd.navigator.lookAtLocation.latitude = 0;
      wwd.navigator.lookAtLocation.longitude = 50;
      wwd.navigator.range = optimalRange;
      setRange(optimalRange);
      
      console.log(`✅ Initial range set to: ${(optimalRange / 1000).toFixed(0)} km`);
      
      wwd.redraw();
      
      // Loading state will be handled by the Auto-Adjust logic once stable
      
    } catch (error) {
      console.error("Failed to initialize WorldWind:", error);
    }
  }, [dimensions.width, dimensions.height]);

  // 4. Handle manual Range Change from UI input
  useEffect(() => {
    if (wwdRef.current && range !== null) {
      wwdRef.current.navigator.range = range;
      wwdRef.current.redraw();
    }
  }, [range]);

  // 5. Handle Layer Change
  useEffect(() => {
    if (!wwdRef.current || !baseLayerRef.current) return;
    const wwd = wwdRef.current;
    
    // Remove current base layer
    wwd.removeLayer(baseLayerRef.current);
    
    // Create new base layer based on selection
    let newBaseLayer;
    if (selectedLayer === 'bmng') {
      newBaseLayer = new WorldWind.BMNGLayer();
    } else {
      newBaseLayer = new WorldWind.OpenStreetMapImageLayer("osm");
    }
    
    // Insert at index 0 (bottom of layer stack)
    wwd.insertLayer(0, newBaseLayer);
    baseLayerRef.current = newBaseLayer;
    
    console.log(`✅ Layer changed to: ${selectedLayer}`);
    
    // Trigger auto-fit to readjust full map
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

  // Auto-Adjust Range & Pan to Fit World Vertically (-90 to 90)
  useEffect(() => {
    if (!wwdRef.current || dimensions.height === 0) return;
    const wwd = wwdRef.current;
    const { top, bottom } = borderStats;
    
    // STABILITY THRESHOLD (When to stop)
    // We stop if we see at least 88 degrees. 
    // Going for 90 is risky as it flirts with the background (null).
    const STABILITY_THRESHOLD = 89; 
    
    // CALCULATION TARGET (What to aim for)
    // We aim for 89 degrees to leave a 1 degree buffer from the void.
    const CALC_TARGET = 89;

    // Calculate absolute latitudes
    const absTop = top ? Math.abs(top.lat) : 0;
    const absBottom = bottom ? Math.abs(bottom.lat) : 0;
    const avgLat = (absTop + absBottom) / 2;

    // Check if we are stable
    // Use average to prevent zoom-out when just one side is slightly off during balancing
    // Also check if stats are valid (correspond to current dimensions)
    const isStable = statsValidRef.current && top && bottom && avgLat >= STABILITY_THRESHOLD;
    
    isStableRef.current = isStable; 

    // RE-TRIGGER AUTO-FIT IF ZOOMED OUT TOO FAR (User Request)
    if (!autoFitEnabledRef.current && statsValidRef.current && (!top || !bottom)) {
        setIsLoading(true);
        autoFitEnabledRef.current = true;
        // Sync state with actual range to ensure smooth zoom-in
        setRange(wwd.navigator.range);
    }

    // Only run Auto-Adjust logic if enabled (Init or Resize) AND stats are valid
    if (autoFitEnabledRef.current && statsValidRef.current) {
        
        // Turn off loading and disable auto-fit once the map is stable
        if (isStable) {
          setIsLoading(false);
          autoFitEnabledRef.current = false;
        } 

        // --- PAN CORRECTION (Balancing) ---
        // User Request: If abs(top) > abs(bottom), shift down.
        if (top && bottom) {
            const diff = absTop - absBottom;
            
            // Threshold for balancing (increased to 0.1 to reduce jitter)
            if (Math.abs(diff) > 0.1) {
                // Proportional correction (10% of difference), capped at 0.5 degree
                // This prevents oscillation compared to a fixed 0.1 step
                const correction = Math.sign(diff) * Math.min(Math.abs(diff) * 0.1, 0.5);
                wwd.navigator.lookAtLocation.latitude -= correction;
            }
        } else {
            // If we lost a sensor, re-center to find it
            wwd.navigator.lookAtLocation.latitude = 0;
        }
        
        if (!isStable) {
           if (!top || !bottom) {
              // Case 1: Hit Background (Too far out)
              // Action: Zoom In gently to recover. 
              // 0.95 is safe. 0.6 was too aggressive and caused looping.
              setRange(prev => prev * 0.95);
           } else {
              // Case 2: Map Visible but cropped (Too close)
              const currentLat = Math.abs(top.lat);
              
              // Only adjust if we are significantly off
              if (currentLat < STABILITY_THRESHOLD && currentLat > 0.1) {
                 // Calculate ratio to reach CALC_TARGET
                 let ratio = CALC_TARGET / currentLat;
                 // Clamp ratio to avoid wild jumps
                 ratio = Math.min(ratio, 2.0); 
                 setRange(prev => prev * ratio);
              }
           }
        }
    }
    
    // Update Target Lat Ref for the Event Listener
    targetLatRef.current = wwd.navigator.lookAtLocation.latitude;
  }, [borderStats, dimensions.height]);

  // Border Sensors (Detect Lat/Lon at canvas edges)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!wwdRef.current || !canvasRef.current) return;
      const wwd = wwdRef.current;
      const { width, height } = dimensions;
      if (width <= 0 || height <= 0) return;

      // NOTE: Removed Range Sync to prevent conflict with Auto-Adjust logic
      
      const getPick = (x, y) => {
        // pickTerrain requires WorldWind.Vec2
        const pickList = wwd.pickTerrain(new WorldWind.Vec2(x, y));
        if (pickList.objects.length > 0 && pickList.objects[0].position) {
          return {
            lat: pickList.objects[0].position.latitude,
            lon: pickList.objects[0].position.longitude
          };
        }
        return null;
      };

      // Use a small buffer from edges to ensure we pick inside the canvas
      const top = getPick(width / 2, 5);
      const bottom = getPick(width / 2, height - 5);
      const left = getPick(5, height / 2);
      const right = getPick(width - 5, height / 2);

      statsValidRef.current = true; // Mark stats as valid for current dimensions

      if (top && bottom) {
        latDeltaRef.current = Math.abs(top.lat - bottom.lat) / 2;
      }

      setBorderStats({
        top: top,
        bottom: bottom,
        left: left,
        right: right
      });

    }, 100); // Faster updates (100ms) for smoother calibration

    return () => clearInterval(interval);
  }, [dimensions]);

  // 5. Mouse Handler (Menggunakan Math 2D sederhana yang lebih cepat dari Picking WorldWind untuk UI status)
  const handleMouseMoveInternal = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Karena projection Equirectangular adalah pemetaan linear sederhana:
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
          {/* Loading Overlay */}
          <div className={`absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center transition-opacity ease-out ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
              <Globe className="w-16 h-16 text-blue-500 animate-spin relative z-10" style={{ animationDuration: '2s' }} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-blue-400 font-mono text-sm tracking-[0.3em] font-bold animate-pulse">SYSTEM INITIALIZATION</span>
              <div className="flex items-center gap-2 text-slate-500 text-[10px] tracking-widest">
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            onMouseMove={handleMouseMoveInternal}
            className="w-full h-full cursor-crosshair block"
          >
            Your browser does not support HTML5 Canvas.
          </canvas>

        {/* Border Sensors Labels */}
        {/* TOP */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded-b border border-slate-500/50 flex flex-col items-center z-10 shadow-lg transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`w-2 h-2 rounded-full mb-1 ${borderStats.top ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{borderStats.top ? `${borderStats.top.lat.toFixed(2)}°, ${borderStats.top.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
        </div>
        {/* BOTTOM */}
        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded-t border border-slate-500/50 flex flex-col-reverse items-center z-10 shadow-lg transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`w-2 h-2 rounded-full mt-1 ${borderStats.bottom ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{borderStats.bottom ? `${borderStats.bottom.lat.toFixed(2)}°, ${borderStats.bottom.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
        </div>
        {/* LEFT */}
        <div className={`absolute top-1/2 left-0 -translate-y-1/2 bg-slate-900/90 text-white text-[10px] px-1 py-1 rounded-r border border-slate-500/50 flex flex-row items-center z-10 shadow-lg transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`w-2 h-2 rounded-full mr-1 ${borderStats.left ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div className="flex flex-col">
            {borderStats.left ? (
              <>
                <span>{borderStats.left.lat.toFixed(2)}°</span>
                <span>{borderStats.left.lon.toFixed(2)}°</span>
              </>
            ) : <span>NO SIGNAL</span>}
          </div>
        </div>
        {/* RIGHT */}
        <div className={`absolute top-1/2 right-0 -translate-y-1/2 bg-slate-900/90 text-white text-[10px] px-1 py-1 rounded-l border border-slate-500/50 flex flex-row-reverse items-center z-10 shadow-lg transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`w-2 h-2 rounded-full ml-1 ${borderStats.right ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div className="flex flex-col text-right">
            {borderStats.right ? (
              <>
                <span>{borderStats.right.lat.toFixed(2)}°</span>
                <span>{borderStats.right.lon.toFixed(2)}°</span>
              </>
            ) : <span>NO SIGNAL</span>}
          </div>
        </div>

        {/* Overlay UI (Info Box) */}
        <div className={`absolute top-2 left-2 bg-black/50 backdrop-blur-sm p-2 rounded border border-white/10 text-xs text-white transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className="font-bold text-blue-400 mb-1">ENGINE STATUS</div>
          <div>Mode: Globe2D</div>
          <div>Layer: {layerOptions.find(l => l.id === selectedLayer)?.name}</div>
          <div className="mt-2 border-t border-white/10 pt-1">
            <div>Canvas: {Math.round(dimensions.width)} x {Math.round(dimensions.height)}</div>
          </div>
          <div className="mt-2 border-t border-white/10 pt-1 pointer-events-auto">
             <label className="block mb-1 text-gray-400">Eye Range (km)</label>
             <input 
               type="number" 
               min="1000"
               step="100"
               value={range / 1000}
               onChange={(e) => setRange(Number(e.target.value) * 1000)}
               className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:border-blue-500 outline-none"
             />
          </div>
          {/* Layer Selector */}
          <div className="mt-2 border-t border-white/10 pt-1 pointer-events-auto relative">
             <label className="block mb-1 text-gray-400">Base Layer</label>
             <button 
               onClick={() => setShowLayerDropdown(!showLayerDropdown)}
               className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs text-left flex items-center justify-between hover:border-blue-500 transition-colors"
             >
               <span className="flex items-center gap-2">
                 <span>{layerOptions.find(l => l.id === selectedLayer)?.icon}</span>
                 <span>{layerOptions.find(l => l.id === selectedLayer)?.name}</span>
               </span>
               <span className={`transition-transform ${showLayerDropdown ? 'rotate-180' : ''}`}>▼</span>
             </button>
             {showLayerDropdown && (
               <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg z-50 overflow-hidden">
                 {layerOptions.map((layer) => (
                   <button
                     key={layer.id}
                     onClick={() => {
                       setSelectedLayer(layer.id);
                       setShowLayerDropdown(false);
                     }}
                     className={`w-full px-2 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${selectedLayer === layer.id ? 'bg-blue-600/30 text-blue-300' : 'text-white'}`}
                   >
                     <span>{layer.icon}</span>
                     <span>{layer.name}</span>
                     {selectedLayer === layer.id && <span className="ml-auto">✓</span>}
                   </button>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Satellite Info Panel */}
        <div className={`absolute top-2 right-2 bg-black/50 backdrop-blur-sm p-2 rounded border border-white/10 text-xs text-white transition-opacity duration-1000 ${!isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className="font-bold text-cyan-400 mb-1 flex items-center gap-2">
            <Satellite className="w-4 h-4" />
            {LAPAN_A2_TLE.name}
          </div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Latitude:</span>
              <span className="text-green-400">{satellitePosition.lat.toFixed(4)}°</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Longitude:</span>
              <span className="text-green-400">{satellitePosition.lon.toFixed(4)}°</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Altitude:</span>
              <span className="text-yellow-400">{satellitePosition.alt.toFixed(2)} km</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Coverage:</span>
              <span className="text-green-300">{curvedFunction(satellitePosition.alt).toFixed(1)} km</span>
            </div>
          </div>
          <div className="mt-2 pt-1 border-t border-white/10 text-[10px] text-gray-500">
            <div>NORAD ID: 40931</div>
            <div>Period: ~97.4 min</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * KOMPONEN: Main App
 */
export default function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lon: 0 });

  const toggleSimulation = () => setIsSimulating(!isSimulating);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* TOP MENU */}
      <TopNavbar 
        isSimulating={isSimulating} 
        toggleSimulation={toggleSimulation}
      />

      {/* MAIN CONTENT / MAP AREA */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Toolbar Floating */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Select">
            <Monitor className="w-5 h-5" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Layers">
            <MapIcon className="w-5 h-5" />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-white shadow-lg" title="Info">
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* WorldWind Component */}
        <Globe2D 
          isSimulating={isSimulating}
          onMouseMove={setCursorCoords}
        />
      </div>

      {/* BOTTOM MENU */}
      <BottomNavbar 
        cursorCoords={cursorCoords}
        activeSatellite={isSimulating}
      />
    </div>
  );
}