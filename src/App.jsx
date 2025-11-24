import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, FastForward, Rewind, 
  Settings, Globe, Map as MapIcon, 
  Monitor, Info, Crosshair
} from 'lucide-react';
import WorldWind from "worldwindjs";


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
const Globe2D = ({ isSimulating, onMouseMove }) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const wwdRef = useRef(null);
  const isStableRef = useRef(false); // Ref for stability status
  const targetLatRef = useRef(0); // Ref for target latitude
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [range, setRange] = useState(300000); // 20,000 km
  const [borderStats, setBorderStats] = useState({
    top: null,
    bottom: null,
    left: null,
    right: null
  });

  // Listener to disable vertical pan when stable
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventVerticalPan = () => {
      if (isStableRef.current && wwdRef.current) {
        // Lock latitude to target
        wwdRef.current.navigator.lookAtLocation.latitude = targetLatRef.current;
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

  // 3. Initialize WorldWind
  useEffect(() => {
    if (!canvasRef.current || wwdRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

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

      // Add Layers
      const bmngLayer = new WorldWind.BMNGLayer();
      wwd.addLayer(bmngLayer);
      
      console.log("✅ BMNG Layer added");

      // Add Coordinates Display Layer (Sesuai request)
      const coordinatesLayer = new WorldWind.CoordinatesDisplayLayer(wwd);
      wwd.addLayer(coordinatesLayer);

      // Setup view agar pas di tengah (lookAt 0,0)
      wwd.navigator.lookAtLocation.latitude = 0;
      wwd.navigator.lookAtLocation.longitude = 0;
      wwd.navigator.range = range; // Altitude awal
      
      wwd.redraw();
      
    } catch (error) {
      console.error("Failed to initialize WorldWind:", error);
    }
  }, [dimensions.width, dimensions.height]);

  // 4. Update Redraw saat dimensi berubah
  useEffect(() => {
    if (wwdRef.current) {
      wwdRef.current.redraw();
    }
  }, [dimensions]);

  // Handle Range Change
  useEffect(() => {
    if (wwdRef.current) {
      wwdRef.current.navigator.range = range;
      wwdRef.current.redraw();
    }
  }, [range]);

  // Auto-Adjust Range & Pan to Fit World Vertically (-90 to 90)
  useEffect(() => {
    if (!wwdRef.current || dimensions.height === 0) return;
    const wwd = wwdRef.current;
    const { top, bottom } = borderStats;
    
    // STABILITY THRESHOLD (When to stop)
    // We stop if we see at least 88 degrees. 
    // Going for 90 is risky as it flirts with the background (null).
    const STABILITY_THRESHOLD = 88; 
    
    // CALCULATION TARGET (What to aim for)
    // We aim for 89 degrees to leave a 1 degree buffer from the void.
    const CALC_TARGET = 89;

    // Calculate absolute latitudes
    const absTop = top ? Math.abs(top.lat) : 0;
    const absBottom = bottom ? Math.abs(bottom.lat) : 0;
    const avgLat = (absTop + absBottom) / 2;

    // Check if we are stable
    // Use average to prevent zoom-out when just one side is slightly off during balancing
    const isStable = top && bottom && avgLat >= STABILITY_THRESHOLD;
    
    isStableRef.current = isStable; 

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
    
    // Update Target Lat Ref for the Event Listener
    targetLatRef.current = wwd.navigator.lookAtLocation.latitude;

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded-b border border-slate-500/50 flex flex-col items-center z-10 shadow-lg">
          <div className={`w-2 h-2 rounded-full mb-1 ${borderStats.top ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{borderStats.top ? `${borderStats.top.lat.toFixed(2)}°, ${borderStats.top.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
        </div>
        {/* BOTTOM */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded-t border border-slate-500/50 flex flex-col-reverse items-center z-10 shadow-lg">
          <div className={`w-2 h-2 rounded-full mt-1 ${borderStats.bottom ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span>{borderStats.bottom ? `${borderStats.bottom.lat.toFixed(2)}°, ${borderStats.bottom.lon.toFixed(2)}°` : 'NO SIGNAL'}</span>
        </div>
        {/* LEFT */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 bg-slate-900/90 text-white text-[10px] px-1 py-1 rounded-r border border-slate-500/50 flex flex-row items-center z-10 shadow-lg">
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
        <div className="absolute top-1/2 right-0 -translate-y-1/2 bg-slate-900/90 text-white text-[10px] px-1 py-1 rounded-l border border-slate-500/50 flex flex-row-reverse items-center z-10 shadow-lg">
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
        <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm p-2 rounded border border-white/10 text-xs text-white">
          <div className="font-bold text-blue-400 mb-1">ENGINE STATUS</div>
          <div>Mode: Globe2D</div>
          <div>Layer: BMNG (NASA)</div>
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