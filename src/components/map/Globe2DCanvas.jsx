import { useEffect, useRef } from "react";
import initWorldWind from "../../services/worldwind/wwdInit";

export default function Globe2DCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        initWorldWind(canvasRef.current);
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" id="wwdCanvas" />;
}
