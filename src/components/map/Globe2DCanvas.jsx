import { useEffect, useRef } from "react";
import { initWorldWindow } from "../../services/worldwind/wwdInit";
import {
    baseLayerConfigs,
    overlayLayerConfigs,
    createLayer,
} from "../../services/worldwind/layerManager";
import { useUIStore } from "../../store/ui.store";

export default function Globe2DCanvas() {
    const canvasRef = useRef(null);
    const wwdRef = useRef(null);
    const activeBaseRef = useRef(null);
    const activeOverlayRef = useRef(null);

    const cameraEyeKm = useUIStore((s) => s.cameraEyeKm);

    // Init wwd
    useEffect(() => {
        if (!canvasRef.current) return;

        const wwd = initWorldWindow(canvasRef.current.id);
        wwdRef.current = wwd;

        const defaultLayer = createLayer(baseLayerConfigs[0]);
        wwd.addLayer(defaultLayer);
        activeBaseRef.current = defaultLayer;

        wwd.redraw();
    }, []);

    // Update camera
    useEffect(() => {
        const wwd = wwdRef.current;
        if (!wwd) return;

        wwd.navigator.range = cameraEyeKm * 1000; // km → meter
        wwd.redraw();
    }, [cameraEyeKm]);

    // Expose layer change handler (dipanggil dari SettingsPanel)
    Globe2DCanvas.setBaseLayer = (key) => {
        const wwd = wwdRef.current;
        const selected = baseLayerConfigs.find((x) => x.key === key);

        if (activeBaseRef.current) wwd.removeLayer(activeBaseRef.current);

        const newLayer = createLayer(selected);
        wwd.insertLayer(0, newLayer);
        activeBaseRef.current = newLayer;

        wwd.redraw();
    };

    Globe2DCanvas.setOverlayLayer = (key) => {
        const wwd = wwdRef.current;
        const selected = overlayLayerConfigs.find((x) => x.key === key);

        if (activeOverlayRef.current) wwd.removeLayer(activeOverlayRef.current);

        const newLayer = createLayer(selected);
        if (newLayer) {
            wwd.addLayer(newLayer);
            activeOverlayRef.current = newLayer;
        } else {
            activeOverlayRef.current = null;
        }

        wwd.redraw();
    };

    return <canvas ref={canvasRef} id="wwdCanvas" className="w-full h-full block" />;
}
