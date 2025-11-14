import { useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import initWorldWind from "../../services/worldwind/wwdInit";
import { useUIStore } from "../../store/ui.store";

export default function Globe2DCanvas() {
    const canvasRef = useRef(null);
    const wwdRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);

    const eyeDistance = useUIStore((state) => state.cameraEyeDistance);
    const setCameraEyeDistance = useUIStore((state) => state.setCameraEyeDistance);

    // ------------------------------------------------------------
    // FUNCTION: GET TOP BORDER LATITUDE
    // ------------------------------------------------------------
    const getTopBorderLatitude = (wwd) => {
        const canvas = wwd.canvas;

        const midX = canvas.width / 2;
        const y = 1; // almost the top border

        const pickList = wwd.pickTerrain(new WorldWind.Vec2(midX, y));

        if (pickList.objects.length > 0) {
            return pickList.objects[0].position.latitude;
        }
        return null;
    };

    // ------------------------------------------------------------
    // FUNCTION: CREATE TOP BORDER LINE LAYER
    // ------------------------------------------------------------
    const createTopBorderLine = (wwd) => {
        const layer = new WorldWind.RenderableLayer("TopBorder");
        wwd.addLayer(layer);

        const updateLine = () => {
            const lat = getTopBorderLatitude(wwd);
            if (lat === null) return;

            layer.removeAllRenderables();

            const path = new WorldWind.Path([
                new WorldWind.Position(lat, -180, 0),
                new WorldWind.Position(lat, 180, 0),
            ]);

            path.altitudeMode = WorldWind.CLAMP_TO_GROUND;
            path.attributes = new WorldWind.ShapeAttributes({
                outlineColor: WorldWind.Color.RED,
                outlineWidth: 3,
            });

            layer.addRenderable(path);
        };

        // update every redraw
        wwd.addEventListener("redraw", updateLine);
    };

    // ------------------------------------------------------------
    // ADAPTIVE DRAG BEHAVIOR
    // ------------------------------------------------------------
    const enableAdaptiveDrag = (wwd) => {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        const handleMouseDown = (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            const nav = wwd.navigator;
            const currentRange = nav.range;

            // Free drag
            if (currentRange < 14000000) {
                const newLon = nav.lookAtLocation.longitude - deltaX * 0.1;
                const newLat = nav.lookAtLocation.latitude + deltaY * 0.1;

                nav.lookAtLocation.latitude = Math.max(-85, Math.min(85, newLat));
                nav.lookAtLocation.longitude = newLon;
            } else {
                // Horizontal only
                nav.lookAtLocation.latitude = 0;
                nav.lookAtLocation.longitude -= deltaX * 0.1;
            }

            wwd.redraw();
        };

        const handleMouseUp = () => {
            isDragging = false;
        };

        const canvas = wwd.canvas;

        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseup", handleMouseUp);
        canvas.addEventListener("mouseleave", handleMouseUp);
    };

    // ------------------------------------------------------------
    // INITIALIZE WORLDWIND
    // ------------------------------------------------------------
    useEffect(() => {
        const initializeCanvas = async () => {
            try {
                if (canvasRef.current) {
                    const wwd = initWorldWind(canvasRef.current, eyeDistance);
                    if (!wwd) throw new Error("Failed to initialize WorldWind");

                    wwd.navigator.fieldOfView = 45;
                    wwd.navigator.lookAtLocation.latitude = 0;

                    enableAdaptiveDrag(wwd);

                    // ---------------------------
                    // Mouse coordinate logger
                    // ---------------------------
                    const canvas = wwd.canvas;
                    // canvas.addEventListener("mousemove", (event) => {
                    //     const rect = canvas.getBoundingClientRect();
                    //     const x = event.clientX - rect.left;
                    //     const y = event.clientY - rect.top;

                    //     const pickList = wwd.pickTerrain(new WorldWind.Vec2(x, y));

                    //     if (pickList.objects.length > 0) {
                    //         const pos = pickList.objects[0].position;
                    //         // console.log(
                    //         //     "Lat:",
                    //         //     pos.latitude.toFixed(6),
                    //         //     "Lon:",
                    //         //     pos.longitude.toFixed(6)
                    //         // );
                    //     }
                    // });

                    // ---------------------------
                    // ADD TOP BORDER LATITUDE LOGGER
                    // ---------------------------
                    wwd.addEventListener("redraw", () => {
                        const topLat = getTopBorderLatitude(wwd);
                        if (topLat !== null) {
                            console.log("Top Border Latitude:", topLat.toFixed(4));
                        }
                    });

                    // ---------------------------
                    // DRAW TOP BORDER LINE
                    // ---------------------------
                    createTopBorderLine(wwd);

                    wwdRef.current = wwd;
                    setIsInitialized(true);
                }
            } catch (err) {
                console.error("Globe2DCanvas initialization error:", err);
                setError(err.message);
            }
        };

        const timer = setTimeout(initializeCanvas, 150);
        return () => clearTimeout(timer);
    }, []);

    // ------------------------------------------------------------
    // UPDATE CAMERA RANGE
    // ------------------------------------------------------------
    useEffect(() => {
        if (isInitialized && wwdRef.current) {
            const wwd = wwdRef.current;
            const nav = wwd.navigator;

            nav.range = eyeDistance;
            nav.lookAtLocation.latitude = 0;

            wwd.redraw();
        }
    }, [eyeDistance, isInitialized]);

    // ------------------------------------------------------------
    // ZOOM BUTTONS
    // ------------------------------------------------------------
    const zoomIn = () => {
        if (eyeDistance > 1_000_000) {
            setCameraEyeDistance(eyeDistance * 0.8);
        }
    };

    const zoomOut = () => {
        if (eyeDistance < 14000000) {
            setCameraEyeDistance(eyeDistance * 1.25);
        }
    };

    // ------------------------------------------------------------
    // ERROR SCREEN
    // ------------------------------------------------------------
    if (error) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <div className="text-red-400 mb-2">Globe initialization failed</div>
                    <div className="text-sm text-gray-400">{error}</div>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------
    return (
        <>
            <canvas
                ref={canvasRef}
                id="wwdCanvas"
                className="absolute inset-0 w-full h-full"
                style={{ display: "block" }}
            />

            {!isInitialized && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                    <div className="loading loading-spinner loading-lg mb-2"></div>
                    <div className="text-sm">Loading Globe...</div>
                </div>
            )}

            {isInitialized && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                    <button
                        onClick={zoomIn}
                        className="btn btn-circle btn-sm bg-base-300 border border-base-content/20"
                    >
                        <Plus size={16} />
                    </button>

                    <button
                        onClick={zoomOut}
                        className="btn btn-circle btn-sm bg-base-300 border border-base-content/20"
                    >
                        <Minus size={16} />
                    </button>

                    <div className="text-xs text-center text-white bg-black/50 px-2 py-1 rounded">
                        {Math.round(eyeDistance / 1000)} km
                    </div>

                    <div className="text-xs text-center text-orange-400 bg-black/50 px-2 py-1 rounded">
                        {eyeDistance >= 14000000 ? "🔒 Lat: 0°" : "🔓 Free Drag"}
                    </div>
                </div>
            )}
        </>
    );
}
