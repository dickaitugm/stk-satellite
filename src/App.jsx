import React, { use, useEffect, useRef } from "react";
import {
    MapContainer,
    WMSTileLayer,
    LayersControl,
    ScaleControl,
    LayerGroup,
    Marker,
    Popup,
    useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- Fix ikon marker ---
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadowUrl from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadowUrl,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// === Auto Fit dengan kendali Zoom ===
function AutoFitBounds({ wrapperRef }) {
    const map = useMap();

    useEffect(() => {
        const worldBounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));

        const fitMap = () => {
            if (!wrapperRef.current) return;

            const currentZoom = map.getZoom();
            if (currentZoom > 2.25) {
                map.invalidateSize();
                return;
            }

            // === Maintain 2:1 aspect ratio ===
            const width = wrapperRef.current.clientWidth;
            const height = width / 2;
            wrapperRef.current.style.height = `${height}px`;

            map.invalidateSize();
            map.fitBounds(worldBounds, { animate: false });
        };

        fitMap();

        // === Restrict vertical pan (lock latitude) ===
        let isClamping = false; // guard flag to prevent recursion

        const clampVertical = () => {
            if (isClamping) return; // avoid recursion loop

            const center = map.getCenter();
            const zoom = map.getZoom();

            // lock latitude around 0° (equator)
            const lockedLat = 0;

            if (Math.abs(center.lat - lockedLat) > 0.0001) {
                isClamping = true; // enable guard before panTo
                map.panTo([lockedLat, center.lng], { animate: false });
                isClamping = false; // release guard
            }
        };

        // only allow horizontal movement
        map.on("move", clampVertical);

        // === optional: log zoom level for debugging ===
        map.on("zoomend", () => {
            console.log("Current Zoom:", map.getZoom());
        });

        // === Electron resize integration ===
        if (window.electronAPI) {
            window.electronAPI.onWindowResize(() => {
                fitMap();
            });
        }

        const observer = new ResizeObserver(fitMap);
        if (wrapperRef.current) observer.observe(wrapperRef.current);

        return () => {
            observer.disconnect();
            map.off("move", clampVertical);
        };
    }, [map, wrapperRef]);

    return null;
}

function ZoomLogger() {
    const map = useMap();

    useEffect(() => {
        const logZoom = () => {
            const currentZoom = map.getZoom();
            console.log("Current Zoom:", currentZoom);
        };

        // Log pertama kali map siap
        logZoom();

        // Log setiap kali zoom berubah
        map.on("zoomend", logZoom);

        return () => map.off("zoomend", logZoom);
    }, [map]);

    return null;
}

export default function App() {
    const wrapperRef = useRef(null);

    const nasaWmsUrl = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
    const mundialisWmsUrl = "http://ows.mundialis.de/services/service?";
    const openTopoUrl = "https://ows.terrestris.de/osm/service?";

    return (
        <div
            ref={wrapperRef}
            className="bg-black relative overflow-hidden mx-auto"
            style={{
                width: "100%",
                maxWidth: "100vw",
                height: "50vh",
                transition: "height 0.3s ease",
            }}
        >
            <MapContainer
                crs={L.CRS.EPSG4326}
                zoomSnap={0.25}
                worldCopyJump={true}
                zoomControl={true}
                style={{
                    width: "100%",
                    height: "100%",
                    background: "#050505",
                }}
                center={[0, 0]}
                zoom={1}
            >
                <AutoFitBounds wrapperRef={wrapperRef} />

                {/* === Layers === */}
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="NASA Blue Marble">
                        <WMSTileLayer
                            url={nasaWmsUrl}
                            params={{
                                layers: "BlueMarble_NextGeneration",
                                format: "image/jpeg",
                                version: "1.3.0",
                            }}
                            attribution="NASA GIBS"
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name="NASA City Lights (Night)">
                        <WMSTileLayer
                            url={nasaWmsUrl}
                            params={{
                                layers: "VIIRS_CityLights_2012",
                                format: "image/png",
                                transparent: true,
                                version: "1.3.0",
                            }}
                            attribution="NASA GIBS"
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name="Mundialis Topo + OSM Overlay">
                        <WMSTileLayer
                            url={mundialisWmsUrl}
                            params={{
                                layers: "TOPO-WMS,OSM-Overlay-WMS",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="Mundialis"
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name="OpenTopoMap (Terrestris)">
                        <WMSTileLayer
                            url={openTopoUrl}
                            params={{
                                layers: "OSM-WMS",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="© OpenTopoMap via terrestris"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <ScaleControl position="bottomleft" imperial={false} />

                {/* Dummy Marker */}
                <LayerGroup>
                    <Marker position={[0, 118]}>
                        <Popup>LAPAN-A3 (Dummy Marker)</Popup>
                    </Marker>
                </LayerGroup>

                <ZoomLogger />
            </MapContainer>

            {/* Overlay Info */}
            <div className="absolute top-6 left-6 z-[1000] p-4 bg-black/70 rounded-lg border border-gray-700 shadow-xl backdrop-blur-md pointer-events-none">
                <h1 className="text-xl font-bold text-white tracking-wide">
                    🌍 Earth WMS Viewer (Auto 2:1)
                </h1>
                <p className="text-xs text-gray-300 font-mono mt-1">
                    Auto sync with Electron resize • Zoom-sensitive fitBounds
                </p>
            </div>
        </div>
    );
}
