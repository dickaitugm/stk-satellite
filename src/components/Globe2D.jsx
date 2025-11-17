import { useEffect, useRef } from "react";
import WorldWind from "worldwindjs";

export default function Globe2D() {
    const wwdRef = useRef(null);
    const fixingRef = useRef(false);

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
        // FUNCTION: GET BORDER CENTER COORDINATES (ENHANCED)
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
                } else {
                    result[name] = null;
                }
            });

            return result;
        };

        // Legacy function for compatibility with existing code
        const getBorders = () => {
            const borders = getCanvasBordersLatLon();
            return {
                top: borders.top ? borders.top.latitude : null,
                bottom: borders.bottom ? borders.bottom.latitude : null
            };
        };

        // ==========================
        // AUTO FIX PAN - OPTIMIZED
        // ==========================
        const startFix = () => {
            if (fixingRef.current) return;
            fixingRef.current = true;

            const overlay = document.getElementById("loadingOverlay");
            overlay.style.display = "flex";

            const BASE_PAN_SPEED = 1.0; // Increased from 0.25
            const MAX_FRAME = 200; // Reduced from 600
            let frame = 0;
            let lastRedrawFrame = 0;
            const REDRAW_INTERVAL = 3; // Redraw every 3 frames instead of every frame

            const animate = () => {
                if (frame++ > MAX_FRAME) {
                    fixingRef.current = false;
                    overlay.style.display = "none";
                    return;
                }

                const borders = getBorders();
                const topNull = borders.top === null;
                const bottomNull = borders.bottom === null;

                // Jika dua-duanya OK → selesai
                if (!topNull && !bottomNull) {
                    fixingRef.current = false;
                    overlay.style.display = "none";
                    return;
                }

                const nav = wwdRef.current.navigator;

                // Dynamic speed based on how far off we are
                let dynamicSpeed = BASE_PAN_SPEED;
                
                // If both borders are null, we're really far off - move faster
                if (topNull && bottomNull) {
                    dynamicSpeed = BASE_PAN_SPEED * 2.0;
                }

                // ====== LOGIKA BENAR dengan DYNAMIC SPEED ======
                // TOP border null → kamera terlalu naik → PAN TURUN
                if (topNull) {
                    nav.lookAtLocation.latitude -= dynamicSpeed;
                }

                // BOTTOM border null → kamera terlalu turun → PAN NAIK
                if (bottomNull) {
                    nav.lookAtLocation.latitude += dynamicSpeed;
                }

                // Optimized redraw - only redraw every few frames
                if (frame - lastRedrawFrame >= REDRAW_INTERVAL) {
                    wwd.redraw();
                    lastRedrawFrame = frame;
                }

                requestAnimationFrame(animate);
            };

            requestAnimationFrame(animate);
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
                // Optional: Enable for debugging
                // console.log("Mouse Lat:", pos.latitude.toFixed(6), "Lon:", pos.longitude.toFixed(6));
            }
        };

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

        // ==========================
        // ON RESIZE
        // ==========================
        const onResize = () => {
            setTimeout(() => {
                const borders = getBorders();

                if (borders.top === null || borders.bottom === null) {
                    startFix();
                }
            }, 150);
        };

        // Register all event listeners
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
        canvas.addEventListener("pointermove", onPointerMoveCapture, { capture: true, passive: false });
        window.addEventListener("pointerup", onPointerUp, { passive: true });
        window.addEventListener("resize", onResize);

        // cleanup
        return () => {
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMoveCapture, { capture: true });
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("resize", onResize);
        };

    }, []);

    return (
        <>
            <canvas
                id="globeCanvas"
                className="w-full h-full bg-black"
            ></canvas>

            <div
                id="loadingOverlay"
                style={{
                    display: "none",
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,1)", // Full black background
                    color: "white",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "20px",
                    fontWeight: "bold",
                    zIndex: 9999
                }}
            >
                {/* Loading Spinner */}
                <div
                    style={{
                        width: "60px",
                        height: "60px",
                        border: "6px solid rgba(255,255,255,0.3)",
                        borderTop: "6px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginBottom: "20px"
                    }}
                ></div>
                Adjusting map...
                
                {/* CSS Animation for spinner */}
                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        </>
    );
}
