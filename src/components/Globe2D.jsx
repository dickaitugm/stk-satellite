import { useEffect, useRef, useState, useCallback } from "react";
import WorldWind from "worldwindjs";

export default function Globe2DGridSearchExplorer() {
    const wwdRef = useRef(null);
    const canvasRef = useRef(null);
    const sidebarRef = useRef(null);

    // === GRID SEARCH STATES ===
    const [range, setRange] = useState(24200000); // meters (15,000 km)
    const [canvasWidth, setCanvasWidth] = useState(1220);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [coverageData, setCoverageData] = useState(null);
    const [formulaData, setFormulaData] = useState(null);
    const [consoleLog, setConsoleLog] = useState([]);
    
    // === SIDEBAR STATES ===
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isDragging, setIsDragging] = useState(false);

    // === Add message to console log ===
    const addToLog = useCallback((message) => {
        const timestamp = new Date().toLocaleTimeString();
        setConsoleLog(prev => [...prev.slice(-20), `[${timestamp}] ${message}`]);
    }, []);

    // === COVERAGE ANALYSIS FUNCTION ===
    const analyzeCoverage = useCallback(() => {
        const canvas = canvasRef.current;
        const wwd = wwdRef.current;
        if (!canvas || !wwd) return;

        const WORLD_WIDTH_DEGREES = 360;   // -180° to +180°
        const WORLD_HEIGHT_DEGREES = 180;  // -90° to +90°
        const EARTH_RADIUS_KM = 6378;

        // Test points at canvas edges and corners
        const testPoints = {
            "TOP-LEFT":     { x: 0, y: 0 },
            "TOP-CENTER":   { x: canvasWidth / 2, y: 0 },
            "TOP-RIGHT":    { x: canvasWidth, y: 0 },
            "MIDDLE-LEFT":  { x: 0, y: canvasHeight / 2 },
            "CENTER":       { x: canvasWidth / 2, y: canvasHeight / 2 },
            "MIDDLE-RIGHT": { x: canvasWidth, y: canvasHeight / 2 },
            "BOTTOM-LEFT":  { x: 0, y: canvasHeight },
            "BOTTOM-CENTER":{ x: canvasWidth / 2, y: canvasHeight },
            "BOTTOM-RIGHT": { x: canvasWidth, y: canvasHeight }
        };

        let minLat = 999, maxLat = -999;
        let minLon = 999, maxLon = -999;
        let nullCount = 0;
        const pickResults = {};

        // Test each point
        Object.entries(testPoints).forEach(([name, pt]) => {
            const pick = wwd.pickTerrain(new WorldWind.Vec2(pt.x, pt.y));
            if (pick.objects.length > 0 && pick.objects[0].position) {
                const pos = pick.objects[0].position;
                const lat = pos.latitude;
                const lon = pos.longitude;
                
                pickResults[name] = { lat, lon };
                
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLon = Math.min(minLon, lon);
                maxLon = Math.max(maxLon, lon);
            } else {
                pickResults[name] = { lat: null, lon: null };
                nullCount++;
            }
        });

        // Calculate coverage metrics
        const latCoverage = nullCount > 0 ? 0 : (maxLat - minLat);
        const lonCoverage = nullCount > 0 ? 0 : (maxLon - minLon);
        
        // Calculate formula components
        const canvasRatio = canvasWidth / canvasHeight;
        const worldRatio = WORLD_WIDTH_DEGREES / WORLD_HEIGHT_DEGREES; // 2.0
        const degreesPerPixelW = WORLD_WIDTH_DEGREES / canvasWidth;
        const degreesPerPixelH = WORLD_HEIGHT_DEGREES / canvasHeight;
        const rangeKm = range / 1000;
        
        // Formula calculations
        const scaleFactor = rangeKm / Math.max(canvasWidth, canvasHeight);
        const rangeToWidthRatio = rangeKm / canvasWidth;
        const rangeToHeightRatio = rangeKm / canvasHeight;
        const rangeToAreaRatio = rangeKm / Math.sqrt(canvasWidth * canvasHeight);

        // Coverage quality
        let quality = "🔴 POOR";
        let isPerfect = false;
        
        if (nullCount === 0) {
            if (latCoverage >= 178 && lonCoverage >= 358) {
                quality = "🟢 PERFECT";
                isPerfect = true;
            } else if (latCoverage >= 160 && lonCoverage >= 340) {
                quality = "🟡 GOOD";
            } else if (latCoverage >= 120 && lonCoverage >= 240) {
                quality = "🟠 FAIR";
            }
        } else {
            quality = `🔴 NULL POINTS (${nullCount})`;
        }

        const coverage = {
            quality,
            isPerfect,
            nullCount,
            latCoverage: latCoverage || 0,
            lonCoverage: lonCoverage || 0,
            minLat,
            maxLat,
            minLon,
            maxLon,
            pickResults
        };

        const formula = {
            canvasRatio,
            worldRatio,
            degreesPerPixelW,
            degreesPerPixelH,
            rangeKm,
            scaleFactor,
            rangeToWidthRatio,
            rangeToHeightRatio,
            rangeToAreaRatio,
            
            // Theoretical perfect range calculations
            perfectRangeFromWidth: (degreesPerPixelW * canvasWidth * EARTH_RADIUS_KM * Math.PI) / 360,
            perfectRangeFromHeight: (degreesPerPixelH * canvasHeight * EARTH_RADIUS_KM * Math.PI) / 180
        };

        setCoverageData(coverage);
        setFormulaData(formula);

        // UI logging with canvas verification
        const canvasElement = canvasRef.current;
        const actualWidth = canvasElement?.width || 'unknown';
        const actualHeight = canvasElement?.height || 'unknown';
        const displayWidth = canvasElement?.clientWidth || 'unknown';
        const displayHeight = canvasElement?.clientHeight || 'unknown';

        addToLog(`=== ANALYSIS COMPLETE ===`);
        addToLog(`📊 Target: ${canvasWidth}×${canvasHeight} | Actual: ${actualWidth}×${actualHeight} | Display: ${displayWidth}×${displayHeight}`);
        addToLog(`🎯 Coverage: ${quality} | Lat: ${latCoverage.toFixed(1)}° | Lon: ${lonCoverage.toFixed(1)}°`);
        addToLog(`🧮 Scale Factor: ${scaleFactor.toFixed(3)} | R/W: ${rangeToWidthRatio.toFixed(1)} | R/H: ${rangeToHeightRatio.toFixed(1)}`);
        
        if (isPerfect) {
            addToLog(`🎉 PERFECT FORMULA FOUND!`);
            addToLog(`✨ Formula: Range = ${scaleFactor.toFixed(2)} × max(W,H)`);
        }

        // Canvas sync check
        if (actualWidth !== canvasWidth || actualHeight !== canvasHeight) {
            addToLog(`⚠️ Canvas size mismatch detected! Forcing sync...`);
            setTimeout(() => {
                canvasElement.width = canvasWidth;
                canvasElement.height = canvasHeight;
                const wwd = wwdRef.current;
                if (wwd) {
                    wwd.drawFrame();
                    addToLog(`🔧 Canvas size synchronized`);
                }
            }, 50);
        }
    }, [canvasWidth, canvasHeight, range, addToLog]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            addToLog("❌ Canvas not found during initialization");
            return;
        }

        addToLog("🚀 Initializing WorldWind...");

        try {
            // Create WorldWind instance
            const wwd = new WorldWind.WorldWindow(canvas);
            wwdRef.current = wwd;
            
            addToLog("✅ WorldWindow created successfully");

            // Create Globe2D with equirectangular projection
            const flat = new WorldWind.Globe2D();
            flat.projection = new WorldWind.ProjectionEquirectangular();
            wwd.globe = flat;
            
            addToLog("✅ Globe2D with Equirectangular projection set");

            // Add Blue Marble layer
            const bmngLayer = new WorldWind.BMNGLayer();
            wwd.addLayer(bmngLayer);
            
            addToLog("✅ BMNG Layer added");

            // Set initial navigator position
            const nav = wwd.navigator;
            nav.lookAtLocation.latitude = 0;   // Equator
            nav.lookAtLocation.longitude = 0;  // Prime Meridian
            nav.range = range;
            
            addToLog("✅ Navigator position set");

            // Initial canvas setup
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';
            
            // Set viewport
            if (wwd.viewport) {
                wwd.viewport.width = canvasWidth;
                wwd.viewport.height = canvasHeight;
            }
            
            addToLog(`✅ Canvas initialized: ${canvasWidth}×${canvasHeight}`);

            // Force initial render
            setTimeout(() => {
                try {
                    wwd.drawFrame();
                    addToLog("✅ Initial render completed");
                    
                    // Analyze coverage after successful render
                    setTimeout(() => {
                        analyzeCoverage();
                    }, 200);
                } catch (renderError) {
                    addToLog(`❌ Render error: ${renderError.message}`);
                }
            }, 100);

        } catch (error) {
            addToLog(`❌ WorldWind initialization error: ${error.message}`);
            console.error("WorldWind initialization failed:", error);
        }
    }, []);




    // === Handle Canvas Size Changes ===
    useEffect(() => {
        const canvas = canvasRef.current;
        const wwd = wwdRef.current;
        
        // Skip if not properly initialized
        if (!canvas || !wwd) {
            addToLog("⏳ Skipping canvas update - not initialized yet");
            return;
        }

        addToLog(`🔄 Canvas size changed to ${canvasWidth}×${canvasHeight}`);
        
        try {
            // Set canvas buffer size (actual rendering resolution)
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            
            // Set CSS display size
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';

            // Update WorldWind's viewport
            if (wwd.viewport) {
                wwd.viewport.width = canvasWidth;
                wwd.viewport.height = canvasHeight;
                addToLog(`📐 Viewport updated: ${canvasWidth}×${canvasHeight}`);
            }

            // Multiple render attempts for reliability
            let renderAttempts = 0;
            const maxAttempts = 3;
            
            const attemptRender = () => {
                renderAttempts++;
                try {
                    wwd.drawFrame();
                    addToLog(`✅ Canvas redraw completed (attempt ${renderAttempts})`);
                    
                    // Verify render success and analyze
                    setTimeout(() => {
                        analyzeCoverage();
                    }, 100);
                    
                } catch (renderError) {
                    addToLog(`❌ Render attempt ${renderAttempts} failed: ${renderError.message}`);
                    
                    if (renderAttempts < maxAttempts) {
                        addToLog(`🔄 Retrying render (${renderAttempts}/${maxAttempts})...`);
                        setTimeout(attemptRender, 200);
                    } else {
                        addToLog(`❌ All render attempts failed`);
                    }
                }
            };

            // Start render attempts
            requestAnimationFrame(attemptRender);

        } catch (error) {
            addToLog(`❌ Canvas update error: ${error.message}`);
        }

    }, [canvasWidth, canvasHeight, analyzeCoverage, addToLog]);

    // === Handle Range Changes ===
    useEffect(() => {
        const wwd = wwdRef.current;
        if (!wwd) {
            addToLog("⏳ Skipping range update - WorldWind not initialized");
            return;
        }

        addToLog(`📏 Range changed to ${(range/1000).toFixed(0)}km`);
        
        try {
            const nav = wwd.navigator;
            if (!nav) {
                addToLog("❌ Navigator not available");
                return;
            }
            
            nav.range = range;
            addToLog(`✅ Navigator range updated`);
            
            // Reliable redraw with error handling
            setTimeout(() => {
                try {
                    wwd.drawFrame();
                    addToLog(`✅ Range redraw completed`);
                    
                    // Analyze after successful redraw
                    setTimeout(analyzeCoverage, 100);
                } catch (error) {
                    addToLog(`❌ Range redraw failed: ${error.message}`);
                }
            }, 50);

        } catch (error) {
            addToLog(`❌ Range update error: ${error.message}`);
        }

    }, [range, analyzeCoverage, addToLog]);



    // === AUTO-CALCULATE PERFECT RANGE ===
    function calculatePerfectRange() {
        const EARTH_RADIUS_KM = 6378;
        const degreesPerPixelW = 360 / canvasWidth;
        const degreesPerPixelH = 180 / canvasHeight;
        const degreesPerPixel = Math.max(degreesPerPixelW, degreesPerPixelH);
        
        // Calculate perfect range
        const perfectRange = (degreesPerPixel * Math.max(canvasWidth, canvasHeight) * EARTH_RADIUS_KM * Math.PI) / 360;
        
        setRange(Math.round(perfectRange * 1000)); // Convert to meters
        addToLog(`🎯 Auto-calculated perfect range: ${Math.round(perfectRange)} km`);
    }

    // === DEBUG: Check WorldWind Status ===
    function checkWorldWindStatus() {
        const canvas = canvasRef.current;
        const wwd = wwdRef.current;
        
        addToLog("=== WORLDWIND STATUS CHECK ===");
        
        if (!canvas) {
            addToLog("❌ Canvas: Not found");
            return;
        }
        
        addToLog(`✅ Canvas: ${canvas.width}×${canvas.height} (${canvas.clientWidth}×${canvas.clientHeight})`);
        
        if (!wwd) {
            addToLog("❌ WorldWind: Not initialized");
            return;
        }
        
        addToLog(`✅ WorldWind: Initialized`);
        addToLog(`📐 Viewport: ${wwd.viewport?.width}×${wwd.viewport?.height}`);
        addToLog(`🌍 Globe: ${wwd.globe ? 'Ready' : 'Not set'}`);
        addToLog(`🧭 Navigator: ${wwd.navigator ? 'Ready' : 'Not set'}`);
        addToLog(`📏 Current Range: ${wwd.navigator?.range ? (wwd.navigator.range/1000).toFixed(0) + 'km' : 'Not set'}`);
        addToLog(`🎨 Layers: ${wwd.layers ? wwd.layers.length : 0}`);
        
        // Force a redraw and check
        try {
            wwd.drawFrame();
            addToLog(`✅ Test redraw: Success`);
        } catch (error) {
            addToLog(`❌ Test redraw: Failed - ${error.message}`);
        }
    }

    // === SIDEBAR DRAG HANDLERS ===
    const handleMouseDown = (e) => {
        setIsDragging(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const newWidth = e.clientX;
            if (newWidth >= 300 && newWidth <= 600) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div className="flex h-screen bg-gray-900">
            {/* === CONTROL PANEL === */}
            <div 
                ref={sidebarRef}
                className={`bg-gray-800 text-white transition-all duration-300 ${
                    sidebarCollapsed ? 'w-12' : 'overflow-y-auto'
                }`}
                style={{ 
                    width: sidebarCollapsed ? '48px' : `${sidebarWidth}px` 
                }}
            >
                {/* Collapse Button */}
                <div className="flex justify-between items-center p-2 border-b border-gray-700">
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-2 hover:bg-gray-700 rounded"
                        title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {sidebarCollapsed ? '📊' : '◀️'}
                    </button>
                    {!sidebarCollapsed && (
                        <h2 className="text-lg font-bold">🔬 Grid Search</h2>
                    )}
                </div>

                {!sidebarCollapsed && (
                    <div className="p-4">
                <h2 className="text-xl font-bold mb-4">🔬 Full World Grid Search</h2>
                
                {/* Range Slider */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">
                        📏 Navigator Range: {(range / 1000).toLocaleString()} km
                    </label>
                    <input
                        type="range"
                        min={5_000_000}
                        max={30_000_000}
                        step={250_000}
                        value={range}
                        onChange={(e) => setRange(+e.target.value)}
                        className="w-full"
                    />
                </div>

                {/* Canvas Dimensions */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">📐 Canvas Dimensions</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">Width (px)</label>
                            <input
                                type="number"
                                min={400}
                                max={2000}
                                value={canvasWidth}
                                onChange={(e) => setCanvasWidth(+e.target.value)}
                                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-300 mb-1">Height (px)</label>
                            <input
                                type="number"
                                min={300}
                                max={1500}
                                value={canvasHeight}
                                onChange={(e) => setCanvasHeight(+e.target.value)}
                                className="w-full px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Canvas Ratio */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">📊 Canvas Ratio</label>
                    <div className="bg-gray-700 p-2 rounded text-center">
                        {(canvasWidth / canvasHeight).toFixed(3)} (W/H)
                    </div>
                </div>

                {/* Control Buttons */}
                <div className="mb-4 space-y-2">
                    <button
                        onClick={calculatePerfectRange}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
                    >
                        🎯 Auto-Calculate Perfect Range
                    </button>
                    <button
                        onClick={checkWorldWindStatus}
                        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold"
                    >
                        🔍 Debug WorldWind Status
                    </button>
                    <button
                        onClick={() => {
                            const wwd = wwdRef.current;
                            if (wwd) {
                                wwd.drawFrame();
                                addToLog("🔄 Manual redraw triggered");
                            } else {
                                addToLog("❌ Cannot redraw - WorldWind not initialized");
                            }
                        }}
                        className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded font-semibold"
                    >
                        🎨 Force Redraw
                    </button>
                </div>

                {/* Coverage Status */}
                {coverageData && (
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2">🎯 Coverage Status</label>
                        <div className="bg-gray-700 p-3 rounded">
                            <div className="text-center mb-2">{coverageData.quality}</div>
                            <div className="text-xs">
                                <div>Latitude: {coverageData.latCoverage.toFixed(1)}° coverage</div>
                                <div>Longitude: {coverageData.lonCoverage.toFixed(1)}° coverage</div>
                                <div>Null Points: {coverageData.nullCount}/9</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Formula Analysis */}
                {formulaData && (
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2">🧮 Formula Analysis</label>
                        <div className="bg-gray-700 p-3 rounded text-xs space-y-1">
                            <div>Degrees/Px (W): {formulaData.degreesPerPixelW.toFixed(6)}</div>
                            <div>Degrees/Px (H): {formulaData.degreesPerPixelH.toFixed(6)}</div>
                            <div>Scale Factor: {formulaData.scaleFactor.toFixed(3)}</div>
                            <div>Range/Width: {formulaData.rangeToWidthRatio.toFixed(1)}</div>
                            <div>Range/Height: {formulaData.rangeToHeightRatio.toFixed(1)}</div>
                            <div>Range/Area√: {formulaData.rangeToAreaRatio.toFixed(3)}</div>
                        </div>
                    </div>
                )}

                {/* Perfect Formula (when found) */}
                {formulaData && coverageData?.isPerfect && (
                    <div className="mb-6">
                        <label className="block text-sm font-semibold mb-2">✅ Perfect Formula</label>
                        <div className="bg-green-800 p-3 rounded text-xs">
                            <div className="font-semibold mb-1">🎉 PERFECT COVERAGE FOUND!</div>
                            <div>Range = {formulaData.scaleFactor.toFixed(2)} × max(W,H)</div>
                            <div>Or: Range = {formulaData.rangeToAreaRatio.toFixed(2)} × √(W×H)</div>
                            <div className="mt-2 text-green-200">
                                Canvas: {canvasWidth}×{canvasHeight}<br/>
                                Range: {formulaData.rangeKm.toFixed(0)} km<br/>
                                Ratio: {formulaData.canvasRatio.toFixed(3)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Test Presets */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">🧪 Test Presets</label>
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                setCanvasWidth(1920);
                                setCanvasHeight(1080);
                            }}
                            className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                        >
                            1920×1080 (16:9)
                        </button>
                        <button
                            onClick={() => {
                                setCanvasWidth(1600);
                                setCanvasHeight(800);
                            }}
                            className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                        >
                            1600×800 (2:1 - World Ratio)
                        </button>
                        <button
                            onClick={() => {
                                setCanvasWidth(800);
                                setCanvasHeight(600);
                            }}
                            className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
                        >
                            800×600 (4:3)
                        </button>
                    </div>
                </div>

                {/* Console Log */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold mb-2">📝 Console Log</label>
                    <div className="bg-black p-2 rounded text-xs font-mono h-40 overflow-y-auto">
                        {consoleLog.length === 0 ? (
                            <div className="text-gray-500">No logs yet...</div>
                        ) : (
                            consoleLog.map((log, index) => (
                                <div key={index} className="text-green-400 mb-1">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                    <button
                        onClick={() => setConsoleLog([])}
                        className="mt-2 w-full px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                        Clear Log
                    </button>
                </div>
                </div>
            )}
            
            {/* Resize Handle */}
            {!sidebarCollapsed && (
                <div
                    className="w-1 bg-gray-600 cursor-col-resize hover:bg-blue-500 transition-colors"
                    onMouseDown={handleMouseDown}
                    title="Drag to resize sidebar"
                />
            )}
        </div>

            {/* === MAIN VIEW === */}
            <div className="flex-1 flex flex-col">
                {/* Status Bar */}
                <div className="bg-black text-white p-2 text-sm font-mono flex justify-between">
                    <div>
                        🌍 Target: Full World (-180° to +180°, -90° to +90°)
                    </div>
                    <div>
                        {coverageData ? coverageData.quality : "🔄 Analyzing..."}
                    </div>
                </div>
                
                {/* Canvas Container */}
                <div className="flex-1 flex items-center justify-center bg-gray-900 p-4">
                    <div className="border-2 border-gray-600 rounded">
                        <canvas
                            ref={canvasRef}
                            id="globeCanvas"
                            className="bg-black"
                            style={{
                                width: canvasWidth + 'px',
                                height: canvasHeight + 'px'
                            }}
                        />
                    </div>
                </div>

                {/* Info Panel */}
                <div className="bg-gray-800 text-gray-300 p-2 text-xs">
                    <div className="flex justify-between">
                        <span>
                            Canvas: {canvasWidth}×{canvasHeight} | 
                            Ratio: {(canvasWidth/canvasHeight).toFixed(3)} | 
                            Range: {(range/1000).toFixed(0)}km
                        </span>
                        <span>
                            🎯 Adjust sliders to find perfect full world coverage
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
