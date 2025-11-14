import WorldWind from "worldwindjs";

export function initWorldWindow(canvasId) {
    const wwd = new WorldWind.WorldWindow(canvasId);
    wwd.globe = new WorldWind.Globe2D();

    // Tambahkan koordinat
    wwd.addLayer(new WorldWind.CoordinatesDisplayLayer(wwd));

    return wwd;
}
