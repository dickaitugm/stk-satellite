// src/services/worldwind/wwdInit.js
import WorldWind from "worldwindjs";

/**
 * Initialize WorldWindow pada elemen canvas (element or id)
 * Returns the WorldWindow instance.
 */
export default function initWorldWindow(canvasElementOrId, initialEyeDistance = 17000000) {
    console.log(
        "initWorldWindow called with:",
        canvasElementOrId,
        "Initial eye distance:",
        initialEyeDistance
    );

    const canvas =
        typeof canvasElementOrId === "string"
            ? document.getElementById(canvasElementOrId)
            : canvasElementOrId;

    if (!canvas) {
        console.error("initWorldWindow: canvas element not found", canvasElementOrId);
        return null;
    }

    console.log("Canvas found:", canvas);

    // Try multiple ways to access WorldWind
    let WW = null;
    if (window.WorldWind) {
        WW = window.WorldWind;
        console.log("WorldWind found on window");
    } else if (WorldWind) {
        WW = WorldWind;
        console.log("WorldWind found via import");
    } else {
        console.error("WorldWind not found on window or import");
        console.log(
            "Available on window:",
            Object.keys(window).filter((k) => k.toLowerCase().includes("world"))
        );
        return null;
    }

    // Ensure canvas has proper dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 600;

    console.log("Canvas dimensions:", canvas.width, "x", canvas.height);

    // create WorldWindow
    const wwd = new WW.WorldWindow(canvas);
    console.log("WorldWindow created:", wwd);

    // 2D globe
    wwd.globe = new WW.Globe2D();
    console.log("Globe2D set");

    // Add basic layers
    try {
        // Background layer
        const backgroundLayer = new WW.BMNGLayer();
        wwd.addLayer(backgroundLayer);
        console.log("Background layer added");

        // coordinates display
        const coordsLayer = new WW.CoordinatesDisplayLayer(wwd);
        wwd.addLayer(coordsLayer);
        console.log("Coordinates layer added");
    } catch (err) {
        console.error("Error adding layers:", err);
    }

    // basic event handlers (resize)
    const onResize = () => {
        try {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            wwd.redraw();
        } catch (err) {
            console.error("Resize error:", err);
        }
    };
    window.addEventListener("resize", onResize);

    // Set initial camera position
    try {
        // Set lookAt position at surface level (altitude = 0)
        const initialPosition = new WW.Position(0, 0, 0); // Center at 0,0 at surface
        wwd.navigator.lookAtLocation = initialPosition;

        // Set range (eye distance) separately
        wwd.navigator.range = initialEyeDistance;
        console.log("Initial camera position set - Lat: 0, Lng: 0, Range:", initialEyeDistance);

        // Limit latitude bounds to prevent over-zooming
        const originalHandleSecondaryPointerAction = wwd.navigator.handleSecondaryPointerAction;
        wwd.navigator.handleSecondaryPointerAction = function (recognizer) {
            const result = originalHandleSecondaryPointerAction.call(this, recognizer);

            // Constrain latitude to -90 to 90 degrees
            if (this.lookAtLocation.latitude > 90) {
                this.lookAtLocation.latitude = 90;
            } else if (this.lookAtLocation.latitude < -90) {
                this.lookAtLocation.latitude = -90;
            }

            // Constrain eye distance
            if (this.range < 1000000) {
                // Min 1000 km
                this.range = 1000000;
            } else if (this.range > 100000000) {
                // Max 100000 km
                this.range = 100000000;
            }

            return result;
        };
    } catch (err) {
        console.error("Error setting initial camera position:", err);
    }

    // Initial redraw
    setTimeout(() => {
        try {
            wwd.redraw();
            console.log("Initial redraw completed");
        } catch (err) {
            console.error("Initial redraw error:", err);
        }
    }, 100);

    // cleanup hook via returned object (caller can call .destroy())
    wwd._cleanup = () => {
        window.removeEventListener("resize", onResize);
        // remove layers if needed
        try {
            while (wwd.layers.length) wwd.removeLayer(wwd.layers[0]);
        } catch (e) {}
    };

    return wwd;
}
