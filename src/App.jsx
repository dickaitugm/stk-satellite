import React, { useState, useRef } from "react";
import {
    MapContainer,
    WMSTileLayer,
    LayersControl,
    ScaleControl,
    LayerGroup,
    Marker,
    Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- Perbaikan Ikon Marker Leaflet (Vite/Webpack) ---
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadowUrl from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadowUrl,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function App() {
    const [mapCenter] = useState([0, 118]); // Tengah Indonesia
    const [mapZoom] = useState(3);

    const orbitLayerRef = useRef(null);
    const satelliteLayerRef = useRef(null);

    // --- Daftar URL WMS ---
    const nasaWmsUrl = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
    const mundialisWmsUrl = "http://ows.mundialis.de/services/service?";
    const gmrtWmsUrl = "https://www.gmrt.org/services/mapserver/wms.cgi";
    const openTopoUrl = "https://ows.terrestris.de/osm/service?";
    const usgsHydroUrl =
        "https://basemap.nationalmap.gov/arcgis/services/USGSHydroCached/MapServer/WMSServer?";
    const eumetsatUrl = "https://view.eumetsat.int/geoserver/ows?";
    const metNorwayUrl =
        "https://thredds.met.no/thredds/wms/met.no/observations/metobs_temperature_1hour_statistic.nc?";

    return (
        <div className="w-screen h-screen relative bg-gray-900">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                crs={L.CRS.EPSG4326}
                minZoom={1}
                maxZoom={10}
                style={{ height: "100%", width: "100%", background: "#050505" }}
                maxBounds={[
                    [-90, -180],
                    [90, 180],
                ]}
                maxBoundsViscosity={1.0}
            >
                {/* === Kontrol Layer === */}
                <LayersControl position="topright">
                    {/* --- NASA GIBS Layers --- */}
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

                    <LayersControl.BaseLayer name="NASA True Color (VIIRS)">
                        <WMSTileLayer
                            url={nasaWmsUrl}
                            params={{
                                layers: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
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

                    {/* --- Mundialis --- */}
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

                    <LayersControl.BaseLayer name="Mundialis Hillshade">
                        <WMSTileLayer
                            url={mundialisWmsUrl}
                            params={{
                                layers: "SRTM30-Colored-Hillshade",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="Mundialis"
                        />
                    </LayersControl.BaseLayer>

                    {/* --- GMRT Bathymetry --- */}
                    <LayersControl.BaseLayer name="GMRT Bathymetry">
                        <WMSTileLayer
                            url={gmrtWmsUrl}
                            params={{
                                layers: "GMRT",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="Marine-Geo"
                        />
                    </LayersControl.BaseLayer>

                    {/* --- OpenTopoMap (Terrestris) --- */}
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

                    {/* --- USGS Hydrographic (Rivers) --- */}
                    <LayersControl.BaseLayer name="USGS Hydrography">
                        <WMSTileLayer
                            url={usgsHydroUrl}
                            params={{
                                layers: "0",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="USGS National Map"
                        />
                    </LayersControl.BaseLayer>

                    {/* --- EUMETSAT Europe Clouds --- */}
                    <LayersControl.BaseLayer name="EUMETSAT Europe Clouds">
                        <WMSTileLayer
                            url={eumetsatUrl}
                            params={{
                                layers: "msg_fes:europe_ir108",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="EUMETSAT View"
                        />
                    </LayersControl.BaseLayer>

                    {/* --- MET Norway (Temperature) --- */}
                    <LayersControl.BaseLayer name="MET Norway Temperature">
                        <WMSTileLayer
                            url={metNorwayUrl}
                            params={{
                                layers: "air_temperature",
                                format: "image/png",
                                transparent: true,
                            }}
                            attribution="MET Norway"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {/* Skala Peta */}
                <ScaleControl position="bottomleft" imperial={false} />

                {/* Orbit & Satelit Layer */}
                <LayerGroup ref={orbitLayerRef}></LayerGroup>

                <LayerGroup ref={satelliteLayerRef}>
                    <Marker position={[0, 118]}>
                        <Popup>LAPAN-A3 (Dummy Marker)</Popup>
                    </Marker>
                </LayerGroup>
            </MapContainer>

            {/* Overlay UI */}
            <div className="absolute top-4 left-4 z-[1000] p-4 bg-black/70 rounded-lg border border-gray-700 shadow-xl backdrop-blur-md pointer-events-none">
                <h1 className="text-xl font-bold text-white tracking-wide">
                    🌍 STK-Like Earth WMS Viewer
                </h1>
                <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-xs text-gray-300 font-mono">
                        Projection: Equirectangular (EPSG:4326)
                    </p>
                </div>
            </div>
        </div>
    );
}
