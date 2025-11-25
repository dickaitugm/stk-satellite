/**
 * Globe2D Component
 * Main WorldWind 2D globe with satellite tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import WorldWind from "worldwindjs";

// Hooks
import { useResizeObserver, useSatellite } from '../../hooks';

// Utils
import { 
  LAPAN_A2_TLE, 
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

const Globe2D = ({ isSimulating, onMouseMove }) => {
  // Custom hooks
  const { containerRef, dimensions } = useResizeObserver();
  const { 
    satrec, 
    position: satellitePosition, 
    isReady: isSatelliteReady,
    getSatellitePosition,
    generateOrbitPath 
  } = useSatellite(LAPAN_A2_TLE);

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

  // Create orbit path layer
  const createOrbitLayer = (wwd) => {
    if (orbitLayerRef.current) {
      wwd.removeLayer(orbitLayerRef.current);
    }
    
    const orbitLayer = new WorldWind.RenderableLayer("Orbit Path");
    const orbitPoints = generateOrbitPath();
    
    if (orbitPoints.length > 1) {
      const pathPositions = orbitPoints.map(point => 
        new WorldWind.Position(point.lat, point.lon, point.alt * 1000)
      );
      
      const pathAttributes = new WorldWind.ShapeAttributes(null);
      pathAttributes.outlineColor = new WorldWind.Color(0, 1, 1, 0.8);
      pathAttributes.outlineWidth = 2;
      pathAttributes.drawInterior = false;
      
      const path = new WorldWind.Path(pathPositions, pathAttributes);
      path.altitudeMode = WorldWind.ABSOLUTE;
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
    
    coveragePolygonRef.current = null;
    satellitePlacemarkRef.current = null;
    
    const satLayer = new WorldWind.RenderableLayer("Satellite");
    satelliteLayerRef.current = satLayer;
    wwd.addLayer(satLayer);
  };

  // Update satellite position with animation
  const updateSatelliteMarker = () => {
    if (!wwdRef.current || !satelliteLayerRef.current || !satrec) return;
    
    const now = new Date();
    const pos = getSatellitePosition(now);
    
    if (pos) {
      setCurrentSatellitePosition(pos);
      
      // Coverage circle
      const radiusKm = calculateCoverageRadius(pos.alt);
      const center = { latitude: pos.lat, longitude: pos.lon };
      const circleCoords = geodesicCircleCoords(center, radiusKm);
      
      const boundaryLocations = circleCoords.map(
        (coord) => new WorldWind.Location(coord.latitude, coord.longitude)
      );
      
      if (!coveragePolygonRef.current) {
        const polygonAttributes = new WorldWind.ShapeAttributes(null);
        polygonAttributes.interiorColor = new WorldWind.Color(0, 1, 0, 0.2);
        polygonAttributes.outlineColor = new WorldWind.Color(0, 1, 0, 0.8);
        polygonAttributes.outlineWidth = 1.5;
        
        coveragePolygonRef.current = new WorldWind.SurfacePolygon(boundaryLocations, polygonAttributes);
        satelliteLayerRef.current.addRenderable(coveragePolygonRef.current);
      } else {
        coveragePolygonRef.current.boundaries = boundaryLocations;
      }
      
      // Satellite placemark
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
        satellitePlacemarkRef.current.position = new WorldWind.Position(pos.lat, pos.lon, 0);
      }
      
      satellitePlacemarkRef.current.label = `${LAPAN_A2_TLE.name}\n${pos.alt.toFixed(1)} km`;
      
      wwdRef.current.redraw();
    }
    
    animationFrameRef.current = requestAnimationFrame(updateSatelliteMarker);
  };

  // Start satellite animation when WorldWind is ready
  useEffect(() => {
    if (wwdRef.current && isSatelliteReady && !isLoading) {
      createOrbitLayer(wwdRef.current);
      createSatelliteLayer(wwdRef.current);
      updateSatelliteMarker();
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isLoading, isSatelliteReady]);

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

  // Initialize WorldWind
  useEffect(() => {
    if (!canvasRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const optimalRange = calculateOptimalRange(dimensions.height);

    if (wwdRef.current) {
      wwdRef.current.navigator.range = optimalRange;
      wwdRef.current.navigator.lookAtLocation.latitude = 0;
      wwdRef.current.navigator.lookAtLocation.longitude = 50;
      setRange(optimalRange);
      setIsLoading(true);
      statsValidRef.current = false;
      autoFitEnabledRef.current = true;
      wwdRef.current.redraw();
      return;
    }

    try {
      const wwd = new WorldWind.WorldWindow(canvasRef.current);
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

      wwd.navigator.lookAtLocation.latitude = 0;
      wwd.navigator.lookAtLocation.longitude = 50;
      wwd.navigator.range = optimalRange;
      setRange(optimalRange);
      
      console.log(`✅ Initial range set to: ${(optimalRange / 1000).toFixed(0)} km`);
      
      wwd.redraw();
      
    } catch (error) {
      console.error("Failed to initialize WorldWind:", error);
    }
  }, [dimensions.width, dimensions.height]);

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
          satelliteName={LAPAN_A2_TLE.name}
          satellitePosition={currentSatellitePosition}
          noradId="40931"
          period="~97.4 min"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default Globe2D;
