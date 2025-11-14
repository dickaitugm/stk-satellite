import { baseLayerConfigs, overlayLayerConfigs } from "../../services/worldwind/layerManager";
import Globe2DCanvas from "../map/Globe2DCanvas";
import { useUIStore } from "../../store/ui.store";

export default function SettingsPanel() {
    const cameraEye = useUIStore((s) => s.cameraEyeKm);
    const setCameraEye = useUIStore((s) => s.setCameraEye);

    return (
        <div className="absolute top-5 left-5 z-[1000] flex flex-col gap-3">
            {/* Base Layer */}
            <div>
                <label className="text-white text-xs">Base Layer: </label>
                <select
                    onChange={(e) => Globe2DCanvas.setBaseLayer(e.target.value)}
                    className="p-2 bg-white text-black rounded"
                >
                    {baseLayerConfigs.map((l) => (
                        <option key={l.key} value={l.key}>
                            {l.displayName}
                        </option>
                    ))}
                </select>
            </div>

            {/* Overlay */}
            <div>
                <label className="text-white text-xs">Overlay: </label>
                <select
                    onChange={(e) => Globe2DCanvas.setOverlayLayer(e.target.value)}
                    className="p-2 bg-white text-black rounded"
                >
                    {overlayLayerConfigs.map((l) => (
                        <option key={l.key} value={l.key}>
                            {l.displayName}
                        </option>
                    ))}
                </select>
            </div>

            {/* Camera Slider */}
            <div>
                <label className="text-white text-xs">
                    Camera Distance: {cameraEye.toLocaleString()} km
                </label>

                <input
                    type="range"
                    min="1000"
                    max="500000"
                    value={cameraEye}
                    onChange={(e) => setCameraEye(parseFloat(e.target.value))}
                />
            </div>
        </div>
    );
}
