// src/services/worldwind/wwdInit.js
import WorldWind from "worldwindjs";

/**
 * Initialize WorldWindow pada elemen canvas (element or id)
 * Returns the WorldWindow instance.
 */
export default function initWorldWindow(canvasElementOrId) {
    const canvas =
        typeof canvasElementOrId === "string"
            ? document.getElementById(canvasElementOrId)
            : canvasElementOrId;

    if (!canvas) {
        console.error("initWorldWindow: canvas element not found", canvasElementOrId);
        return null;
    }

    const WW = window.WorldWind || WorldWind;
    if (!WW) {
        console.error("WorldWind not found on window or import");
        return null;
    }

    // create WorldWindow
    const wwd = new WW.WorldWindow(canvas.id || canvas);
    // 2D globe
    wwd.globe = new WW.Globe2D();

    // coordinates display
    wwd.addLayer(new WW.CoordinatesDisplayLayer(wwd));

    // basic event handlers (resize)
    const onResize = () => {
        wwd.redraw();
    };
    window.addEventListener("resize", onResize);

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
