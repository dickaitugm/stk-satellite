import WorldWind from "worldwindjs";

export const baseLayerConfigs = [
    {
        key: "bmngTiled",
        displayName: "Blue Marble (Tiled)",
        type: "BUILTIN",
        constructor: () => new WorldWind.BMNGLayer(),
    },
    {
        key: "bmngWMS",
        displayName: "NASA Blue Marble (WMS)",
        type: "WMS",
        service: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        layerNames: "BlueMarble_NextGeneration",
    },
];

export const overlayLayerConfigs = [
    {
        key: "none",
        displayName: "None",
        type: "NONE",
    },
    {
        key: "citylights",
        displayName: "City Lights (2012)",
        type: "WMS",
        service: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
        layerNames: "VIIRS_CityLights_2012",
    },
];

export function createLayer(config) {
    if (!config || config.type === "NONE") return null;

    if (config.type === "BUILTIN") {
        return config.constructor();
    }

    if (config.type === "WMS") {
        return new WorldWind.WmsLayer({
            service: config.service,
            layerNames: config.layerNames,
            sector: new WorldWind.Sector(-90, 90, -180, 180),
            levelZeroDelta: new WorldWind.Location(45, 45),
            numLevels: 15,
            format: "image/png",
            size: 256,
        });
    }

    return null;
}
