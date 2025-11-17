import { useEffect, useRef } from "react";
import WorldWind from "worldwindjs";

export default function Globe2D() {
    const wwdRef = useRef(null);

    useEffect(() => {
        const canvas = document.getElementById("globeCanvas");
        if (!canvas) return;

        const wwd = new WorldWind.WorldWindow("globeCanvas");
        wwdRef.current = wwd;

        // Globe 2D Equirectangular
        const flat = new WorldWind.Globe2D();
        flat.projection = new WorldWind.ProjectionEquirectangular();
        wwd.globe = flat;

        // Layers
        wwd.addLayer(new WorldWind.BMNGLayer());
        wwd.addLayer(new WorldWind.ViewControlsLayer(wwd));
        wwd.addLayer(new WorldWind.CoordinatesDisplayLayer(wwd));

        // ==========================================================
        // FUNCTION: GET BORDER CENTER COORDINATES
        // ==========================================================
        const getCanvasBordersLatLon = () => {
            const wwd = wwdRef.current;
            const canvas = document.getElementById("globeCanvas");
            const rect = canvas.getBoundingClientRect();

            const points = {
                top:    { x: rect.width / 2, y: 0 },
                bottom: { x: rect.width / 2, y: rect.height },
                left:   { x: 0, y: rect.height / 2 },
                right:  { x: rect.width, y: rect.height / 2 }
            };

            const result = {};

            Object.entries(points).forEach(([name, { x, y }]) => {
                const pick = wwd.pickTerrain(new WorldWind.Vec2(x, y));
                if (pick.objects.length > 0 && pick.objects[0].position) {
                    const pos = pick.objects[0].position;
                    result[name] = {
                        latitude: pos.latitude,
                        longitude: pos.longitude
                    };

                    console.log(
                        `[BORDER ${name.toUpperCase()}]`,
                        "Lat:", pos.latitude.toFixed(6),
                        "Lon:", pos.longitude.toFixed(6)
                    );
                } else {
                    result[name] = null;
                }
            });

            return result;
        };

        // ==========================================================
        // MOUSE MOVE: TRACK BORDERS WHILE MOVING
        // ==========================================================
        const handleMouseMove = (event) => {
            if (!wwdRef.current) return;

            const canvas = event.target;
            const wwd = wwdRef.current;

            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const pickList = wwd.pickTerrain(new WorldWind.Vec2(x, y));

            if (pickList.objects.length > 0 && pickList.objects[0].position) {
                const pos = pickList.objects[0].position;

                console.log(
                    "Mouse Lat:", pos.latitude.toFixed(6),
                    "Lon:", pos.longitude.toFixed(6),
                    "Elev:", pos.altitude.toFixed(2)
                );

                // panggil terus saat mouse bergerak
                getCanvasBordersLatLon();
            }
        };

        canvas.addEventListener("mousemove", handleMouseMove);

        // ==========================================================
        // DRAG LIMIT: TOP & BOTTOM BORDER PROTECTION
        // ==========================================================
        let isPointerDown = false;
        let startY = 0;

        const TOP_LAT_THRESHOLD = 89.95;       // near north pole
        const BOTTOM_LAT_THRESHOLD = -88.95;   // near south pole

        const onPointerDown = (e) => {
            isPointerDown = true;
            startY = e.clientY;
        };

        const onPointerUp = () => {
            isPointerDown = false;
        };

        const onPointerMoveCapture = (e) => {
            if (!isPointerDown) return;

            const deltaY = e.clientY - startY;
            const borders = getCanvasBordersLatLon();

            const top = borders.top;
            const bottom = borders.bottom;

            // ---------- DRAG DOWN (tarik peta ke bawah) ----------
            if (deltaY > 0) {
                const disableDown =
                    !top ||
                    (typeof top.latitude === "number" && top.latitude >= TOP_LAT_THRESHOLD);

                if (disableDown) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    canvas.style.cursor = "not-allowed";
                    return;
                }
            }

            // ---------- DRAG UP (tarik peta ke atas) ----------
            if (deltaY < 0) {
                const disableUp =
                    !bottom ||
                    (typeof bottom.latitude === "number" && bottom.latitude <= BOTTOM_LAT_THRESHOLD);

                if (disableUp) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    canvas.style.cursor = "not-allowed";
                    return;
                }
            }

            canvas.style.cursor = "";
        };

        // register listeners
        canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
        window.addEventListener("pointerup", onPointerUp, { passive: true });
        canvas.addEventListener("pointermove", onPointerMoveCapture, { capture: true, passive: false });

        // cleanup
        return () => {
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointermove", onPointerMoveCapture, { capture: true });
        };
    }, []);

    return (
        <canvas id="globeCanvas" className="w-full h-full bg-black"></canvas>
    );
}
