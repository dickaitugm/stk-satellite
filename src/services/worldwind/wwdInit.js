// src/services/worldwind/wwdInit.js
import WorldWind from "worldwindjs";

/**
 * Initialize WorldWindow pada elemen canvas (element or id)
 * Returns the WorldWindow instance.
 */
export default function initWorldWindow(canvasElementOrId) {
    console.log("initWorldWindow called with:", canvasElementOrId);

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
