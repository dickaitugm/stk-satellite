import React, { useEffect, useRef, useState } from "react";
import WorldWind from "worldwindjs"; // Asumsi Anda import, atau 'window.WorldWind' jika dari CDN

// --- Konfigurasi Layer ---
// BMNGOneImageLayer dan BingAerialLayer telah dihapus.

const baseLayerConfigs = [
    {
        key: "bmngTiled", // Bawaan WorldWind
        displayName: "Blue Marble (Tiled, Bawaan)",
        type: "BUILTIN",
        constructor: (WW) => new WW.BMNGLayer(),
    },
    {
        key: "bmngWMS", // Dari daftar WMS Anda
        displayName: "NASA Blue Marble (WMS)",
        type: "WMS",
        service: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        layerNames: "BlueMarble_NextGeneration",
    },
    {
        key: "mundialis", // Dari daftar WMS Anda
        displayName: "Mundialis Topo/OSM (WMS)",
        type: "WMS",
        service: "https://ows.mundialis.de/services/service?",
        layerNames: "TOPO-WMS,OSM-Overlay-WMS",
    },
    {
        key: "opentopo", // Dari daftar WMS Anda
        displayName: "OpenTopoMap (WMS)",
        type: "WMS",
        service: "https://ows.terrestris.de/osm/service?",
        layerNames: "OSM-WMS",
    },
];

const overlayLayerConfigs = [
    {
        key: "none",
        displayName: "--- Tidak Ada Overlay ---",
        type: "NONE",
    },
    {
        key: "citylights", // Dari daftar WMS Anda
        displayName: "NASA City Lights (2012)",
        type: "WMS",
        service: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        layerNames: "VIIRS_CityLights_2012",
    },
    // ... Anda bisa tambahkan layer data/overlay WMS lainnya di sini ...
];

// --- Fungsi Bantuan Universal untuk membuat Layer ---
function createLayer(WW, config) {
    if (!config || config.type === "NONE") {
        return null;
    }

    if (config.type === "BUILTIN" && config.constructor) {
        return config.constructor(WW);
    }

    if (config.type === "WMS") {
        const wmsConfig = {
            service: config.service,
            layerNames: config.layerNames,
            sector: new WW.Sector(-90, 90, -180, 180),
            levelZeroDelta: new WW.Location(45, 45),
            numLevels: 15,
            format: "image/png",
            size: 256,
        };
        return new WW.WmsLayer(wmsConfig);
    }

    console.error("Konfigurasi layer tidak dikenal:", config);
    return null;
}

// --- Komponen React ---
export default function App() {
    const canvasRef = useRef(null);
    const wwdRef = useRef(null);
    const activeBaseLayerRef = useRef(null); // Ref untuk Base Layer
    const activeOverlayLayerRef = useRef(null); // Ref untuk Overlay Layer
    const [cameraEye, setCameraEye] = useState(10000); // Default 10,000 km

    // Inisialisasi WorldWindow
    useEffect(() => {
        const interval = setInterval(() => {
            const WW = window.WorldWind || WorldWind;

            if (WW && canvasRef.current) {
                clearInterval(interval);

                const wwd = new WW.WorldWindow(canvasRef.current.id);
                wwdRef.current = wwd;
                wwd.globe = new WW.Globe2D();

                // Muat layer Base DEFAULT terlebih dahulu
                const defaultBaseConfig = baseLayerConfigs[0]; // BMNGLayer
                const defaultBaseLayer = createLayer(WW, defaultBaseConfig);
                if (defaultBaseLayer) {
                    wwd.addLayer(defaultBaseLayer);
                    activeBaseLayerRef.current = defaultBaseLayer;
                }

                wwd.addLayer(new WW.CoordinatesDisplayLayer(wwd));

                activeOverlayLayerRef.current = null;
                wwd.redraw();
            }
        }, 50);

        return () => clearInterval(interval);
    }, []);

    // --- Handler untuk BASE Layer ---
    const handleBaseLayerChange = (event) => {
        const selectedKey = event.target.value;
        const wwd = wwdRef.current;
        const WW = window.WorldWind || WorldWind;
        if (!wwd || !WW) return;

        const selectedConfig = baseLayerConfigs.find((l) => l.key === selectedKey);

        if (activeBaseLayerRef.current) {
            wwd.removeLayer(activeBaseLayerRef.current);
        }

        const newLayer = createLayer(WW, selectedConfig);
        if (newLayer) {
            // Insert di posisi 0 agar base layer selalu di bawah
            wwd.insertLayer(0, newLayer);
            activeBaseLayerRef.current = newLayer;
        }

        wwd.redraw();
    };

    // --- Handler untuk OVERLAY Layer ---
    const handleOverlayLayerChange = (event) => {
        const selectedKey = event.target.value;
        const wwd = wwdRef.current;
        const WW = window.WorldWind || WorldWind;
        if (!wwd || !WW) return;

        const selectedConfig = overlayLayerConfigs.find((l) => l.key === selectedKey);

        if (activeOverlayLayerRef.current) {
            wwd.removeLayer(activeOverlayLayerRef.current);
        }

        const newLayer = createLayer(WW, selectedConfig);
        if (newLayer) {
            // createLayer akan return null jika "None"
            wwd.addLayer(newLayer);
            activeOverlayLayerRef.current = newLayer;
        } else {
            activeOverlayLayerRef.current = null;
        }

        wwd.redraw();
    };

    // --- Handler untuk Camera Eye (Zoom) ---
    const handleCameraEyeChange = (event) => {
        const eyeDistance = parseFloat(event.target.value);
        setCameraEye(eyeDistance);

        const wwd = wwdRef.current;
        if (!wwd) return;

        // Set camera range (distance from surface) dalam meter
        wwd.navigator.range = eyeDistance * 1000; // Convert km to meters
        wwd.redraw();
    };

    // Format angka untuk display (contoh: 10,000 km)
    const formatDistance = (distance) => {
        return new Intl.NumberFormat("id-ID").format(distance) + " km";
    };

    // --- Dropdown styles menggunakan Tailwind ---
    const dropdownClasses =
        "p-2 text-sm bg-white text-black border border-gray-300 rounded-md min-w-[200px] shadow-sm";
    const labelClasses = "text-white text-xs block mb-1 font-medium";

    return (
        // Gunakan 'relative' agar dropdown bisa diposisikan 'absolute'
        <div className="w-full h-screen bg-black relative">
            {/* --- Kontrol UI (Dropdowns) --- */}
            <div className="absolute top-5 left-5 z-[1000] flex flex-col gap-3">
                {/* --- Dropdown BASE Layer --- */}
                <div>
                    <label className={labelClasses}>Base Layer</label>
                    <select
                        onChange={handleBaseLayerChange}
                        defaultValue={baseLayerConfigs[0].key} // Set default ke BMNGLayer
                        className={dropdownClasses}
                    >
                        {baseLayerConfigs.map((layer) => (
                            <option key={layer.key} value={layer.key}>
                                {layer.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* --- Dropdown OVERLAY Layer --- */}
                <div>
                    <label className={labelClasses}>Overlay Layer</label>
                    <select
                        onChange={handleOverlayLayerChange}
                        defaultValue={overlayLayerConfigs[0].key} // Set default ke "None"
                        className={dropdownClasses}
                    >
                        {overlayLayerConfigs.map((layer) => (
                            <option key={layer.key} value={layer.key}>
                                {layer.displayName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* --- Camera Eye Distance Slider --- */}
                <div>
                    <label className={labelClasses}>
                        Camera Distance: {formatDistance(cameraEye)}
                    </label>
                    <input
                        type="range"
                        min="1000"
                        max="500000"
                        step="1000"
                        value={cameraEye}
                        onChange={handleCameraEyeChange}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                                ((cameraEye - 1000) / (500000 - 1000)) * 100
                            }%, #d1d5db ${
                                ((cameraEye - 1000) / (500000 - 1000)) * 100
                            }%, #d1d5db 100%)`,
                        }}
                    />
                    <div className="flex justify-between text-xs text-gray-300 mt-1">
                        <span>1,000 km</span>
                        <span>500,000 km</span>
                    </div>
                </div>
            </div>

            {/* --- Canvas Peta --- */}
            <canvas id="wwdCanvas" ref={canvasRef} className="w-full h-full block z-50" />
        </div>
    );
}
