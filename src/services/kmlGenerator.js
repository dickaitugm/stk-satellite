/**
 * KML/KMZ Generator for Ground Track Export
 * Generates KML content for satellite ground tracks compatible with Google Earth
 */

/**
 * Convert color from {r, g, b, a} (0-1 range) to KML format (aabbggrr hex)
 * @param {Object} color - {r, g, b, a} values from 0-1
 * @returns {string} KML color in aabbggrr format
 */
export function colorToKml(color) {
  const r = Math.round((color?.r || 0) * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round((color?.g || 1) * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round((color?.b || 1) * 255)
    .toString(16)
    .padStart(2, "0");
  const a = Math.round((color?.a || 0.8) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${a}${b}${g}${r}`;
}

/**
 * Generate ground track KML content
 * @param {Object} options
 * @param {string} options.satelliteName - Name of the satellite
 * @param {string} options.kmlColor - KML color in aabbggrr format
 * @param {Object} options.currentPos - Current position {lat, lon, alt}
 * @param {Array} options.orbitPoints - Array of {lat, lon, alt} points
 * @param {Date} options.exportTime - Export timestamp
 * @returns {string} KML content string
 */
export function generateGroundTrackKml({ satelliteName, kmlColor, currentPos, orbitPoints, exportTime }) {
  const currentCoord = `${currentPos.lon.toFixed(6)},${currentPos.lat.toFixed(6)},0`;
  const groundTrackCoords = orbitPoints.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},0`).join("\n              ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${satelliteName} Ground Track</name>
    <description>Ground track exported from OrbitSim at ${exportTime.toISOString()}</description>

    <!-- Ground Track Style -->
    <Style id="groundTrackStyle">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>3</width>
      </LineStyle>
    </Style>

    <!-- Satellite Sub-Point Style -->
    <Style id="subPointStyle">
      <IconStyle>
        <color>${kmlColor}</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/target.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ffffffff</color>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>

    <!-- Satellite Sub-Satellite Point (Current Position on Ground) -->
    <Placemark>
      <name>${satelliteName} (Sub-Point)</name>
      <description>
        <![CDATA[
          <b>Satellite:</b> ${satelliteName}<br/>
          <b>Altitude:</b> ${currentPos.alt.toFixed(2)} km<br/>
          <b>Sub-Satellite Point:</b><br/>
          &nbsp;&nbsp;Latitude: ${currentPos.lat.toFixed(4)}°<br/>
          &nbsp;&nbsp;Longitude: ${currentPos.lon.toFixed(4)}°<br/>
          <b>Time:</b> ${exportTime.toISOString()}
        ]]>
      </description>
      <styleUrl>#subPointStyle</styleUrl>
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${currentCoord}</coordinates>
      </Point>
    </Placemark>

    <!-- Ground Track Path -->
    <Placemark>
      <name>${satelliteName} Ground Track</name>
      <description>Satellite ground track projection</description>
      <styleUrl>#groundTrackStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
              ${groundTrackCoords}
        </coordinates>
      </LineString>
    </Placemark>

  </Document>
</kml>`;
}

/**
 * Generate KMZ file buffer (ZIP containing doc.kml)
 * @param {string} kmlContent - KML content string
 * @returns {Promise<Buffer>} KMZ buffer
 */
export async function generateKmzBuffer(kmlContent) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("doc.kml", kmlContent);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
