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

/**
 * Generate satellite pass KML content
 * @param {Object} options
 * @param {string} options.satelliteName - Name of the satellite
 * @param {string} options.groundStationName - Name of the ground station
 * @param {string} options.kmlColor - KML color in aabbggrr format
 * @param {Object} options.aos - AOS data {time, azimuth, elevation}
 * @param {Object} options.los - LOS data {time, azimuth, elevation}
 * @param {Object} options.maxElevation - Max elevation data {time, elevation, azimuth}
 * @param {Array} options.pathPoints - Array of {lat, lon, alt, time, azimuth, elevation} points
 * @param {Object} options.groundStation - Ground station location {lat, lon, alt}
 * @param {number} options.passNumber - Pass number
 * @param {Date} options.exportTime - Export timestamp
 * @returns {string} KML content string
 */
export function generatePassKml({ satelliteName, groundStationName, kmlColor, aos, los, maxElevation, pathPoints, groundStation, passNumber, exportTime }) {
  // Format pass trajectory coordinates
  const trajectoryCoords = pathPoints.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},${(p.alt * 1000).toFixed(0)}`).join("\n              ");

  // Ground track (satellite position projected to ground)
  const groundTrackCoords = pathPoints.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},0`).join("\n              ");

  // AOS, Max El, LOS points
  const aosPoint = pathPoints[0];
  const losPoint = pathPoints[pathPoints.length - 1];
  const maxElPoint = pathPoints.find((p) => Math.abs(p.elevation - maxElevation.elevation) < 1) || pathPoints[Math.floor(pathPoints.length / 2)];

  // Ground station coordinates
  const gsCoord = `${groundStation.lon.toFixed(6)},${groundStation.lat.toFixed(6)},0`;

  // Format times
  const aosTime = new Date(aos.time);
  const losTime = new Date(los.time);
  const maxElTime = new Date(maxElevation.time);
  const duration = Math.floor((los.time - aos.time) / 1000);
  const durationStr = `${Math.floor(duration / 60)}m ${duration % 60}s`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Pass #${passNumber}: ${satelliteName} over ${groundStationName}</name>
    <description>
      <![CDATA[
        <b>Satellite Pass Prediction</b><br/>
        <b>Satellite:</b> ${satelliteName}<br/>
        <b>Ground Station:</b> ${groundStationName}<br/>
        <b>Pass #:</b> ${passNumber}<br/>
        <hr/>
        <b>AOS:</b> ${aosTime.toISOString()} | Az: ${aos.azimuth.toFixed(1)}°<br/>
        <b>Max El:</b> ${maxElTime.toISOString()} | El: ${maxElevation.elevation.toFixed(1)}°<br/>
        <b>LOS:</b> ${losTime.toISOString()} | Az: ${los.azimuth.toFixed(1)}°<br/>
        <b>Duration:</b> ${durationStr}<br/>
        <hr/>
        <i>Exported from OrbitSim at ${exportTime.toISOString()}</i>
      ]]>
    </description>

    <!-- Pass Trajectory Style (3D path in space) -->
    <Style id="trajectoryStyle">
      <LineStyle>
        <color>${kmlColor}</color>
        <width>3</width>
      </LineStyle>
    </Style>

    <!-- Ground Track Style -->
    <Style id="groundTrackStyle">
      <LineStyle>
        <color>80${kmlColor.slice(2)}</color>
        <width>2</width>
      </LineStyle>
    </Style>

    <!-- AOS Style (Green) -->
    <Style id="aosStyle">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ff00ff00</color>
        <scale>0.9</scale>
      </LabelStyle>
    </Style>

    <!-- Max Elevation Style (Blue) -->
    <Style id="maxElStyle">
      <IconStyle>
        <color>ffff6600</color>
        <scale>1.3</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/star.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ffff6600</color>
        <scale>0.9</scale>
      </LabelStyle>
    </Style>

    <!-- LOS Style (Red) -->
    <Style id="losStyle">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ff0000ff</color>
        <scale>0.9</scale>
      </LabelStyle>
    </Style>

    <!-- Ground Station Style -->
    <Style id="gsStyle">
      <IconStyle>
        <color>ff00ffff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/ranger_station.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <color>ffffffff</color>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>

    <!-- Ground Station -->
    <Placemark>
      <name>${groundStationName}</name>
      <description>
        <![CDATA[
          <b>Ground Station</b><br/>
          Latitude: ${groundStation.lat.toFixed(4)}°<br/>
          Longitude: ${groundStation.lon.toFixed(4)}°<br/>
          Altitude: ${(groundStation.alt || 0).toFixed(0)} m
        ]]>
      </description>
      <styleUrl>#gsStyle</styleUrl>
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${gsCoord}</coordinates>
      </Point>
    </Placemark>

    <!-- AOS Marker -->
    <Placemark>
      <name>AOS (${aosTime.toISOString().slice(11, 19)} UTC)</name>
      <description>
        <![CDATA[
          <b>Acquisition of Signal (AOS)</b><br/>
          Time: ${aosTime.toISOString()}<br/>
          Azimuth: ${aos.azimuth.toFixed(1)}°<br/>
          Elevation: ${aos.elevation?.toFixed(1) || "N/A"}°<br/>
          Altitude: ${aosPoint.alt.toFixed(1)} km
        ]]>
      </description>
      <styleUrl>#aosStyle</styleUrl>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${aosPoint.lon.toFixed(6)},${aosPoint.lat.toFixed(6)},${(aosPoint.alt * 1000).toFixed(0)}</coordinates>
      </Point>
    </Placemark>

    <!-- Max Elevation Marker -->
    <Placemark>
      <name>Max El ${maxElevation.elevation.toFixed(1)}° (${maxElTime.toISOString().slice(11, 19)} UTC)</name>
      <description>
        <![CDATA[
          <b>Maximum Elevation</b><br/>
          Time: ${maxElTime.toISOString()}<br/>
          Elevation: ${maxElevation.elevation.toFixed(1)}°<br/>
          Azimuth: ${maxElevation.azimuth.toFixed(1)}°<br/>
          Altitude: ${maxElPoint.alt.toFixed(1)} km
        ]]>
      </description>
      <styleUrl>#maxElStyle</styleUrl>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${maxElPoint.lon.toFixed(6)},${maxElPoint.lat.toFixed(6)},${(maxElPoint.alt * 1000).toFixed(0)}</coordinates>
      </Point>
    </Placemark>

    <!-- LOS Marker -->
    <Placemark>
      <name>LOS (${losTime.toISOString().slice(11, 19)} UTC)</name>
      <description>
        <![CDATA[
          <b>Loss of Signal (LOS)</b><br/>
          Time: ${losTime.toISOString()}<br/>
          Azimuth: ${los.azimuth.toFixed(1)}°<br/>
          Elevation: ${los.elevation?.toFixed(1) || "N/A"}°<br/>
          Altitude: ${losPoint.alt.toFixed(1)} km
        ]]>
      </description>
      <styleUrl>#losStyle</styleUrl>
      <Point>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>${losPoint.lon.toFixed(6)},${losPoint.lat.toFixed(6)},${(losPoint.alt * 1000).toFixed(0)}</coordinates>
      </Point>
    </Placemark>

    <!-- Satellite Trajectory (3D Path) -->
    <Placemark>
      <name>${satelliteName} Pass Trajectory</name>
      <description>3D satellite trajectory during pass</description>
      <styleUrl>#trajectoryStyle</styleUrl>
      <LineString>
        <extrude>0</extrude>
        <tessellate>0</tessellate>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
              ${trajectoryCoords}
        </coordinates>
      </LineString>
    </Placemark>

    <!-- Ground Track -->
    <Placemark>
      <name>${satelliteName} Ground Track</name>
      <description>Ground projection of satellite path</description>
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
 * Generate multiple passes KML content
 * @param {Object} options
 * @param {string} options.satelliteName - Name of the satellite
 * @param {string} options.groundStationName - Name of the ground station
 * @param {Array} options.passes - Array of pass data
 * @param {Object} options.groundStation - Ground station location
 * @param {Date} options.exportTime - Export timestamp
 * @returns {string} KML content string
 */
export function generateMultiPassKml({ satelliteName, groundStationName, passes, groundStation, exportTime }) {
  const gsCoord = `${groundStation.lon.toFixed(6)},${groundStation.lat.toFixed(6)},0`;

  // Generate placemarks for each pass
  const passPlacemarks = passes
    .map((pass, index) => {
      const passNum = index + 1;
      const aosTime = new Date(pass.aos.time);
      const losTime = new Date(pass.los.time);
      const duration = Math.floor((pass.los.time - pass.aos.time) / 1000);
      const durationStr = `${Math.floor(duration / 60)}m ${duration % 60}s`;

      const trajectoryCoords = pass.path.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},${(p.alt * 1000).toFixed(0)}`).join("\n                ");

      const groundTrackCoords = pass.path.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)},0`).join("\n                ");

      const aosPoint = pass.path[0];
      const losPoint = pass.path[pass.path.length - 1];
      const maxElPoint = pass.path.find((p) => Math.abs(p.elevation - pass.maxElevation.elevation) < 1) || pass.path[Math.floor(pass.path.length / 2)];

      // Color based on max elevation
      const passColor =
        pass.maxElevation.elevation >= 45
          ? "ff00ff00" // Green for high passes
          : pass.maxElevation.elevation >= 20
          ? "ff00ffff" // Yellow for medium passes
          : "ff8080ff"; // Light red for low passes

      return `
    <!-- Pass #${passNum} Folder -->
    <Folder>
      <name>Pass #${passNum} - ${aosTime.toISOString().slice(0, 10)} ${aosTime.toISOString().slice(11, 19)} UTC</name>
      <description>
        <![CDATA[
          <b>Pass #${passNum}</b><br/>
          AOS: ${aosTime.toISOString()}<br/>
          Max El: ${pass.maxElevation.elevation.toFixed(1)}°<br/>
          LOS: ${losTime.toISOString()}<br/>
          Duration: ${durationStr}
        ]]>
      </description>

      <!-- AOS Marker -->
      <Placemark>
        <name>AOS #${passNum}</name>
        <styleUrl>#aosStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>${aosPoint.lon.toFixed(6)},${aosPoint.lat.toFixed(6)},${(aosPoint.alt * 1000).toFixed(0)}</coordinates>
        </Point>
      </Placemark>

      <!-- Max El Marker -->
      <Placemark>
        <name>Max ${pass.maxElevation.elevation.toFixed(0)}°</name>
        <styleUrl>#maxElStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>${maxElPoint.lon.toFixed(6)},${maxElPoint.lat.toFixed(6)},${(maxElPoint.alt * 1000).toFixed(0)}</coordinates>
        </Point>
      </Placemark>

      <!-- LOS Marker -->
      <Placemark>
        <name>LOS #${passNum}</name>
        <styleUrl>#losStyle</styleUrl>
        <Point>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>${losPoint.lon.toFixed(6)},${losPoint.lat.toFixed(6)},${(losPoint.alt * 1000).toFixed(0)}</coordinates>
        </Point>
      </Placemark>

      <!-- Trajectory -->
      <Placemark>
        <name>Trajectory #${passNum}</name>
        <Style>
          <LineStyle>
            <color>${passColor}</color>
            <width>3</width>
          </LineStyle>
        </Style>
        <LineString>
          <altitudeMode>absolute</altitudeMode>
          <coordinates>
                ${trajectoryCoords}
          </coordinates>
        </LineString>
      </Placemark>

      <!-- Ground Track -->
      <Placemark>
        <name>Ground Track #${passNum}</name>
        <Style>
          <LineStyle>
            <color>80${passColor.slice(2)}</color>
            <width>2</width>
          </LineStyle>
        </Style>
        <LineString>
          <tessellate>1</tessellate>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>
                ${groundTrackCoords}
          </coordinates>
        </LineString>
      </Placemark>
    </Folder>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${satelliteName} Passes over ${groundStationName}</name>
    <description>
      <![CDATA[
        <b>Satellite Pass Predictions</b><br/>
        <b>Satellite:</b> ${satelliteName}<br/>
        <b>Ground Station:</b> ${groundStationName}<br/>
        <b>Total Passes:</b> ${passes.length}<br/>
        <hr/>
        <i>Exported from OrbitSim at ${exportTime.toISOString()}</i>
      ]]>
    </description>

    <!-- Styles -->
    <Style id="aosStyle">
      <IconStyle>
        <color>ff00ff00</color>
        <scale>0.8</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="maxElStyle">
      <IconStyle>
        <color>ffff6600</color>
        <scale>1.0</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/star.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="losStyle">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>0.8</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/triangle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="gsStyle">
      <IconStyle>
        <color>ff00ffff</color>
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/ranger_station.png</href></Icon>
      </IconStyle>
      <LabelStyle><color>ffffffff</color><scale>1.0</scale></LabelStyle>
    </Style>

    <!-- Ground Station -->
    <Placemark>
      <name>${groundStationName}</name>
      <description>
        <![CDATA[
          <b>Ground Station</b><br/>
          Latitude: ${groundStation.lat.toFixed(4)}°<br/>
          Longitude: ${groundStation.lon.toFixed(4)}°
        ]]>
      </description>
      <styleUrl>#gsStyle</styleUrl>
      <Point>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>${gsCoord}</coordinates>
      </Point>
    </Placemark>

    ${passPlacemarks}

  </Document>
</kml>`;
}
