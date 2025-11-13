import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import * as satellite from "satellite.js/dist/satellite.es.js";

// Fix default marker icon path
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ===== TLE Example (LAPAN-A3) =====
const TLE_LINE_1 = "1 41603U 16040E   24317.51868056  .00000023  00000-0  11000-4 0  9990";
const TLE_LINE_2 = "2 41603  97.4014  84.1077 0010368 231.2014 128.7893 15.21897947489817";

function SatelliteMarker() {
    const [position, setPosition] = useState([0, 0]);
    const [altitude, setAltitude] = useState(0);
    const satrec = useRef(satellite.twoline2satrec(TLE_LINE_1, TLE_LINE_2));
    const lastPosition = useRef([0, 0]);
    const lastUpdate = useRef(Date.now());

    useEffect(() => {
        let frameId;
        const update = () => {
            const now = new Date();
            const gmst = satellite.gstime(now);
            const eci = satellite.propagate(satrec.current, now);
            const gdPos = satellite.eciToGeodetic(eci.position, gmst);

            const lat = satellite.degreesLat(gdPos.latitude);
            const lon = satellite.degreesLong(gdPos.longitude);
            const alt = gdPos.height * 1000;

            // Lerp animasi posisi
            const [prevLat, prevLon] = lastPosition.current;
            const dt = (Date.now() - lastUpdate.current) / 1000;
            const lerpFactor = Math.min(1, dt * 2); // kecepatan transisi
            const smoothLat = prevLat + (lat - prevLat) * lerpFactor;
            const smoothLon = prevLon + (lon - prevLon) * lerpFactor;

            setPosition([smoothLat, smoothLon]);
            setAltitude(alt.toFixed(0));

            lastPosition.current = [smoothLat, smoothLon];
            lastUpdate.current = Date.now();
            frameId = requestAnimationFrame(update);
        };

        update();
        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <Marker position={position}>
            <Popup>
                <b>LAPAN-A3</b>
                <br />
                Lat: {position[0].toFixed(4)}° <br />
                Lon: {position[1].toFixed(4)}° <br />
                Alt: {altitude} m
            </Popup>
        </Marker>
    );
}

export default function App() {
    return (
        <MapContainer center={[0, 110]} zoom={3} style={{ height: "100vh", width: "100%" }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
            />
            <SatelliteMarker />
        </MapContainer>
    );
}
