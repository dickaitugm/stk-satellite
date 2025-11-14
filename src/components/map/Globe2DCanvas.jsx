import { useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import initWorldWind from "../../services/worldwind/wwdInit";
import { useUIStore } from "../../store/ui.store";

export default function Globe2DCanvas() {
    const canvasRef = useRef(null);
    const wwdRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);

    // Use Zustand store for camera eye distance
    const eyeDistance = useUIStore((state) => state.cameraEyeDistance);
    const setCameraEyeDistance = useUIStore((state) => state.setCameraEyeDistance);

    useEffect(() => {
        const initializeCanvas = async () => {
            try {
                if (canvasRef.current) {
                    console.log("Initializing WorldWind canvas...");
                    const wwd = initWorldWind(canvasRef.current, eyeDistance);
                    if (wwd) {
                        wwdRef.current = wwd;
                        setIsInitialized(true);
                        console.log("WorldWind initialized successfully");
                    } else {
                        throw new Error("Failed to initialize WorldWind");
                    }
                }
            } catch (err) {
                console.error("Globe2DCanvas initialization error:", err);
                setError(err.message);
            }
        };

        // Add small delay to ensure DOM is ready
        const timer = setTimeout(initializeCanvas, 100);
        return () => clearTimeout(timer);
    }, []);

    // Sync eyeDistance from store to WorldWind
    useEffect(() => {
        if (isInitialized && wwdRef.current) {
            updateCameraDistance(eyeDistance);
        }
    }, [eyeDistance, isInitialized]);

    const zoomIn = () => {
        if (wwdRef.current && eyeDistance > 1000000) {
            // Min 1000 km
            const newDistance = eyeDistance * 0.8; // Zoom in = reduce distance
            setCameraEyeDistance(newDistance);
            updateCameraDistance(newDistance);
        }
    };

    const zoomOut = () => {
        if (wwdRef.current && eyeDistance < 100000000) {
            // Max 100000 km
            const newDistance = eyeDistance * 1.25; // Zoom out = increase distance
            setCameraEyeDistance(newDistance);
            updateCameraDistance(newDistance);
        }
    };

    const updateCameraDistance = (distance) => {
        if (wwdRef.current) {
            const wwd = wwdRef.current;
            const currentLookAt = wwd.navigator.lookAtLocation;

            // Keep latitude within bounds (-90 to 90)
            const latitude = Math.max(-90, Math.min(90, currentLookAt.latitude));
            const longitude = currentLookAt.longitude;

            // Update navigator range instead of lookAtLocation altitude
            wwd.navigator.range = distance;
            wwd.navigator.lookAtLocation = new window.WorldWind.Position(latitude, longitude, 0);
            wwd.redraw();

            console.log(
                `Camera updated - Distance: ${Math.round(
                    distance / 1000
                )}km, Lat: ${latitude.toFixed(2)}, Lng: ${longitude.toFixed(2)}`
            );
        }
    };

    if (error) {
        return (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <div className="text-red-400 mb-2">Globe initialization failed</div>
                    <div className="text-sm text-gray-400">{error}</div>
                </div>
            </div>
        );
    }

    return (
        <>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                id="wwdCanvas"
                style={{ display: "block" }}
            />
            {!isInitialized && (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                        <div className="loading loading-spinner loading-lg mb-2"></div>
                        <div className="text-sm">Loading Globe...</div>
                    </div>
                </div>
            )}

            {/* Zoom Controls */}
            {isInitialized && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                    <button
                        onClick={zoomIn}
                        className="btn btn-circle btn-sm bg-base-300 hover:bg-base-200 border border-base-content/20 shadow-lg"
                        title="Zoom In"
                        disabled={eyeDistance <= 1000000}
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={zoomOut}
                        className="btn btn-circle btn-sm bg-base-300 hover:bg-base-200 border border-base-content/20 shadow-lg"
                        title="Zoom Out"
                        disabled={eyeDistance >= 100000000}
                    >
                        <Minus size={16} />
                    </button>
                    <div className="text-xs text-center text-white bg-black/50 px-2 py-1 rounded">
                        {Math.round(eyeDistance / 1000)} km
                    </div>
                </div>
            )}
        </>
    );
}
