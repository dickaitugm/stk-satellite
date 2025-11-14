import { useEffect, useRef, useState } from "react";
import initWorldWind from "../../services/worldwind/wwdInit";

export default function Globe2DCanvas() {
    const canvasRef = useRef(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initializeCanvas = async () => {
            try {
                if (canvasRef.current) {
                    console.log("Initializing WorldWind canvas...");
                    const wwd = initWorldWind(canvasRef.current);
                    if (wwd) {
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
        </>
    );
}
