/**
 * SatellitePropertiesTab Component
 * Tab content for viewing/editing satellite properties
 * 2-Column Layout: Left (Object Tree) | Right (Form Input)
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Satellite,
  Palette,
  Orbit,
  Box,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
  Scan,
  Move,
  RotateCcw,
  Info,
  Link,
  FileText,
  Globe,
  Download,
  Radar,
  Circle,
} from "lucide-react";
import { useSatelliteStore } from "../../stores";
import {
  PRESET_COLORS,
  AXIS_OPTIONS,
  ORBIT_SOURCE_TYPES,
  TLE_SOURCES,
  ORBIT_PRESETS,
  SWATH_SHAPES,
  EARTH_RADIUS_KM,
  EARTH_MU,
  COVERAGE_MODES,
  calculateMeanMotion,
  calculateOrbitalPeriod,
  calculateAltitude,
  createDefaultObject,
  createDefaultCoverageObject,
  extractOrbitalElements,
  keplerianToTLE,
  extractNoradId,
} from "../../utils/satelliteConstants";
import { calculateCoverageRadius } from "../../utils/geodesic";

// Tree Item Component
const TreeItem = ({ icon: Icon, label, isSelected, isExpanded, hasChildren, onClick, onToggle, level = 0 }) => {
  return (
    <div
      className={`flex items-center gap-1.5 py-1.5 cursor-pointer transition-colors text-xs ${
        isSelected ? "bg-cyan-600/30 text-cyan-300 border-l-2 border-cyan-500" : "text-slate-300 hover:bg-slate-700/50 border-l-2 border-transparent"
      }`}
      style={{ paddingLeft: `${level * 12 + 8}px`, paddingRight: "8px" }}
      onClick={onClick}
    >
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="p-0.5 hover:bg-slate-600 rounded"
        >
          {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
        </button>
      ) : (
        <span className="w-4" />
      )}
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
      <span className="truncate flex-1">{label}</span>
    </div>
  );
};

const SatellitePropertiesTab = ({ satelliteId }) => {
  // Get satellite from store
  const satellite = useSatelliteStore((state) => state.satellites.find((sat) => sat.id === satelliteId));
  const updateSatellite = useSatelliteStore((state) => state.updateSatellite);
  const positions = useSatelliteStore((state) => state.positions);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Tree state
  const [expandedNodes, setExpandedNodes] = useState({
    basic: true,
    orbit: false,
    objects: true,
  });
  const [selectedNode, setSelectedNode] = useState("basic.name");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    noradId: "",
    color: PRESET_COLORS[0],
    objects: [], // Now includes coverage as first object
    // TLE fields
    tleLine1: "",
    tleLine2: "",
    orbitSource: "tle-manual",
    tleSource: "celestrak",
    tleUrl: "",
    tleHistory: [],
    selectedTleIndex: 0,
    // Keplerian elements
    orbitPreset: "custom",
    semiMajorAxis: "6978.137",
    eccentricity: "0.001",
    inclination: "5",
    raan: "0",
    argOfPerigee: "0",
    meanAnomaly: "0",
    epoch: new Date().toISOString().slice(0, 16),
  });

  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState(null);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [fetchMessage, setFetchMessage] = useState("");

  // Current position
  const currentPosition = positions[satelliteId];

  // Show toast notification
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Toggle tree node expansion
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Initialize form when satellite changes
  useEffect(() => {
    if (satellite) {
      // Ensure coverage object exists - migrate from showCoverage if needed
      let objects = satellite.objects || [];
      const hasCoverageObject = objects.some(obj => obj.isDefaultCoverage);
      
      if (!hasCoverageObject) {
        // Create default coverage object and add it as first item
        const coverageObj = createDefaultCoverageObject(satellite.color);
        // Migrate showCoverage setting if it exists
        if (satellite.showCoverage === false) {
          coverageObj.isVisible = false;
        }
        objects = [coverageObj, ...objects];
      }

      setFormData({
        name: satellite.name || "",
        noradId: satellite.noradId || "",
        color: satellite.color || PRESET_COLORS[0],
        objects: objects,
        // TLE fields
        tleLine1: satellite.tle?.line1 || "",
        tleLine2: satellite.tle?.line2 || "",
        orbitSource: satellite.orbitSource || "tle-manual",
        tleSource: satellite.tleSource || "celestrak",
        tleUrl: satellite.tleUrl || "",
        tleHistory: satellite.tleHistory || [],
        selectedTleIndex: 0,
        // Keplerian elements
        orbitPreset: "custom",
        semiMajorAxis: satellite.keplerian?.semiMajorAxis?.toString() || "6978.137",
        eccentricity: satellite.keplerian?.eccentricity?.toString() || "0.001",
        inclination: satellite.keplerian?.inclination?.toString() || "5",
        raan: satellite.keplerian?.raan?.toString() || "0",
        argOfPerigee: satellite.keplerian?.argOfPerigee?.toString() || "0",
        meanAnomaly: satellite.keplerian?.meanAnomaly?.toString() || "0",
        epoch: satellite.keplerian?.epoch || new Date().toISOString().slice(0, 16),
      });
      setHasChanges(false);
      setFetchStatus(null);
      setFetchMessage("");
    }
  }, [satellite]);

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Get non-coverage objects count for display
  const getSensorObjectsCount = () => {
    return formData.objects.filter(obj => !obj.isDefaultCoverage).length;
  };

  // Add new object
  const addObject = () => {
    // Count only non-coverage objects for naming
    const sensorCount = getSensorObjectsCount();
    const newObject = createDefaultObject(sensorCount + 1);
    setFormData((prev) => ({
      ...prev,
      objects: [...prev.objects, newObject],
    }));
    setHasChanges(true);
    setSelectedNode(`objects.${newObject.id}`);
    // Expand objects section
    setExpandedNodes((prev) => ({ ...prev, objects: true }));
  };

  // Update object
  const updateObject = (objectId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      objects: prev.objects.map((obj) => (obj.id === objectId ? { ...obj, [field]: value } : obj)),
    }));
    setHasChanges(true);
  };

  // Remove object
  const removeObject = (objectId) => {
    setFormData((prev) => ({
      ...prev,
      objects: prev.objects.filter((obj) => obj.id !== objectId),
    }));
    setHasChanges(true);
    setSelectedNode("basic.name");
  };

  // Build TLE URL based on source and satellite name
  const buildTleUrl = () => {
    const source = TLE_SOURCES.find((s) => s.id === formData.tleSource);
    if (!source || source.id === "custom") return formData.tleUrl;

    let url = source.urlTemplate;
    url = url.replace("{SATELLITE_NAME}", encodeURIComponent(formData.name));
    url = url.replace("{NORAD_ID}", formData.noradId);
    return url;
  };

  // Fetch TLE from URL
  const fetchTLE = async () => {
    const url = formData.tleSource === "custom" ? formData.tleUrl : buildTleUrl();

    if (!url) {
      setFetchStatus("error");
      setFetchMessage("Please enter a valid URL");
      return;
    }

    if (!formData.name.trim()) {
      setFetchStatus("error");
      setFetchMessage("Please enter satellite name first");
      return;
    }

    setLoading(true);
    setFetchStatus(null);
    setFetchMessage("");

    try {
      let text;

      if (window.electronAPI?.fetchTLE) {
        const result = await window.electronAPI.fetchTLE(url);
        if (!result.success) {
          throw new Error(result.error);
        }
        text = result.data;
      } else {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        text = await response.text();
      }

      const lines = text
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.trim());

      // Parse all TLEs from the file
      const allTLEs = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("1 ") && i + 1 < lines.length) {
          const line1 = line;
          const line2 = lines[i + 1].trim();

          let name = "";
          if (i > 0) {
            const prevLine = lines[i - 1].trim();
            if (!prevLine.startsWith("1 ") && !prevLine.startsWith("2 ")) {
              name = prevLine;
            }
          }

          if (line2.startsWith("2 ")) {
            const epochStr = line1.substring(18, 32).trim();
            const epochYear = parseInt(epochStr.substring(0, 2));
            const epochDayFull = parseFloat(epochStr.substring(2));
            const epochDayInt = Math.floor(epochDayFull);
            const epochDayFrac = epochDayFull - epochDayInt;
            const totalSecondsFloat = epochDayFrac * 86400;
            const hours = Math.floor(totalSecondsFloat / 3600);
            const minutes = Math.floor((totalSecondsFloat % 3600) / 60);
            const seconds = Math.floor(totalSecondsFloat % 60);
            const milliseconds = Math.round((totalSecondsFloat % 1) * 1000);
            const fullYear = epochYear > 56 ? 1900 + epochYear : 2000 + epochYear;
            const epochDate = new Date(Date.UTC(fullYear, 0, epochDayInt, hours, minutes, seconds, milliseconds));

            allTLEs.push({
              name: name.trim(),
              line1,
              line2,
              epoch: epochDate.toISOString(),
              noradId: line1.substring(2, 7).trim(),
            });
            i++;
          }
        }
      }

      if (allTLEs.length === 0) {
        throw new Error("No valid TLE data found in the file");
      }

      const searchName = formData.name.trim().toUpperCase();
      const matchingTLEs = allTLEs.filter(
        (tle) =>
          tle.name.toUpperCase().includes(searchName) ||
          searchName.includes(tle.name.toUpperCase().replace(/\s+/g, ""))
      );

      if (formData.orbitSource === "tle-url-history") {
        if (matchingTLEs.length > 0) {
          matchingTLEs.sort((a, b) => new Date(b.epoch) - new Date(a.epoch));
          setFormData((prev) => ({
            ...prev,
            tleHistory: matchingTLEs,
            selectedTleIndex: 0,
            tleLine1: matchingTLEs[0].line1,
            tleLine2: matchingTLEs[0].line2,
            noradId: matchingTLEs[0].noradId,
            tleUrl: url,
          }));
          setHasChanges(true);
          setFetchStatus("success");
          setFetchMessage(`Found ${matchingTLEs.length} TLE records for "${formData.name}"`);
        } else {
          const availableNames = [...new Set(allTLEs.map((t) => t.name))].slice(0, 10);
          throw new Error(
            `Satellite "${formData.name}" not found. Available: ${availableNames.join(", ")}${allTLEs.length > 10 ? "..." : ""}`
          );
        }
      } else {
        if (matchingTLEs.length > 0) {
          matchingTLEs.sort((a, b) => new Date(b.epoch) - new Date(a.epoch));
          const tle = matchingTLEs[0];
          setFormData((prev) => ({
            ...prev,
            tleLine1: tle.line1,
            tleLine2: tle.line2,
            noradId: tle.noradId,
            tleUrl: url,
          }));
          setHasChanges(true);
          setFetchStatus("success");
          setFetchMessage(`TLE found for "${tle.name}" (Epoch: ${new Date(tle.epoch).toLocaleDateString()})`);
        } else {
          const availableNames = [...new Set(allTLEs.map((t) => t.name))].slice(0, 10);
          throw new Error(
            `Satellite "${formData.name}" not found. Available: ${availableNames.join(", ")}${allTLEs.length > 10 ? "..." : ""}`
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch TLE:", error);
      setFetchStatus("error");
      setFetchMessage(error.message || "Failed to fetch TLE");
    } finally {
      setLoading(false);
    }
  };

  // Select TLE from history
  const selectTleFromHistory = (index) => {
    const tle = formData.tleHistory[index];
    if (tle) {
      setFormData((prev) => ({
        ...prev,
        selectedTleIndex: index,
        tleLine1: tle.line1,
        tleLine2: tle.line2,
      }));
      setHasChanges(true);
    }
  };

  // Refresh TLE from source (legacy - for existing TLE URL)
  const refreshTLE = async () => {
    if (!satellite.tleUrl && !formData.tleUrl) {
      setRefreshStatus({ type: "error", message: "No TLE URL configured" });
      return;
    }

    // Use fetchTLE instead
    await fetchTLE();
    if (fetchStatus === "success") {
      setRefreshStatus({ type: "success", message: "TLE updated" });
    } else if (fetchStatus === "error") {
      setRefreshStatus({ type: "error", message: fetchMessage });
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (
      formData.orbitSource === "tle-url" ||
      formData.orbitSource === "tle-url-history" ||
      formData.orbitSource === "tle-manual"
    ) {
      if (!formData.tleLine1.trim()) {
        newErrors.tleLine1 = "TLE Line 1 is required";
      } else if (!formData.tleLine1.startsWith("1 ")) {
        newErrors.tleLine1 = "Invalid TLE Line 1 format";
      }

      if (!formData.tleLine2.trim()) {
        newErrors.tleLine2 = "TLE Line 2 is required";
      } else if (!formData.tleLine2.startsWith("2 ")) {
        newErrors.tleLine2 = "Invalid TLE Line 2 format";
      }
    } else if (formData.orbitSource === "keplerian") {
      const sma = parseFloat(formData.semiMajorAxis);
      if (isNaN(sma) || sma <= 6371) {
        newErrors.semiMajorAxis = "Must be > 6371 km";
      }

      const ecc = parseFloat(formData.eccentricity);
      if (isNaN(ecc) || ecc < 0 || ecc >= 1) {
        newErrors.eccentricity = "Must be 0 ≤ e < 1";
      }

      const inc = parseFloat(formData.inclination);
      if (isNaN(inc) || inc < 0 || inc > 180) {
        newErrors.inclination = "Must be 0-180°";
      }

      const raanVal = parseFloat(formData.raan);
      if (isNaN(raanVal) || raanVal < 0 || raanVal > 360) {
        newErrors.raan = "Must be 0-360°";
      }

      const aopVal = parseFloat(formData.argOfPerigee);
      if (isNaN(aopVal) || aopVal < 0 || aopVal > 360) {
        newErrors.argOfPerigee = "Must be 0-360°";
      }

      const maVal = parseFloat(formData.meanAnomaly);
      if (isNaN(maVal) || maVal < 0 || maVal > 360) {
        newErrors.meanAnomaly = "Must be 0-360°";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validateForm()) {
      showToast("error", "Please fix validation errors");
      return;
    }

    // Derive showCoverage from the coverage object for backward compatibility
    const coverageObj = formData.objects.find(obj => obj.isDefaultCoverage);
    const showCoverage = coverageObj ? coverageObj.isVisible : true;

    const satelliteData = {
      name: formData.name.trim(),
      noradId: formData.noradId || extractNoradId(formData.tleLine1),
      color: formData.color,
      showCoverage: showCoverage, // For backward compatibility with Globe2D
      objects: formData.objects,
      orbitSource: formData.orbitSource,
      tleSource: formData.tleSource,
      tleUrl: formData.tleUrl,
    };

    // Add TLE or Keplerian based on source
    if (formData.orbitSource !== "keplerian") {
      satelliteData.tle = {
        line1: formData.tleLine1.trim(),
        line2: formData.tleLine2.trim(),
      };
      if (formData.tleHistory.length > 0) {
        satelliteData.tleHistory = formData.tleHistory;
      }
    } else {
      satelliteData.keplerian = {
        semiMajorAxis: parseFloat(formData.semiMajorAxis),
        eccentricity: parseFloat(formData.eccentricity),
        inclination: parseFloat(formData.inclination),
        raan: parseFloat(formData.raan),
        argOfPerigee: parseFloat(formData.argOfPerigee),
        meanAnomaly: parseFloat(formData.meanAnomaly),
        epoch: formData.epoch,
      };
      // Convert Keplerian to TLE for compatibility
      satelliteData.tle = keplerianToTLE(satelliteData.keplerian, formData.name);
    }

    updateSatellite(satelliteId, satelliteData);
    setHasChanges(false);
    showToast("success", "Satellite saved successfully");
  };

  // Get selected object
  const getSelectedObject = () => {
    if (selectedNode.startsWith("objects.")) {
      const objectId = selectedNode.replace("objects.", "");
      return formData.objects.find((obj) => obj.id === objectId);
    }
    return null;
  };

  const selectedObject = getSelectedObject();

  if (!satellite) {
    return <div className="p-4 text-center text-slate-400">Satellite not found</div>;
  }

  // Render form based on selected node
  const renderForm = () => {
    // Basic properties - consolidated view
    if (selectedNode === "basic" || selectedNode === "basic.name" || selectedNode === "basic.noradId") {
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            Basic Properties
          </h3>

          {/* Satellite Name & NORAD ID */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Satellite className="w-3.5 h-3.5 text-cyan-400" />
              Satellite Name
            </div>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter satellite name"
              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                errors.name ? "border-red-500" : "border-slate-600"
              }`}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            
            <div>
              <label className="block text-xs text-slate-500 mb-1">NORAD ID</label>
              <input
                type="text"
                value={formData.noradId}
                onChange={(e) => handleChange("noradId", e.target.value)}
                placeholder="e.g., 25544"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              Satellite Color
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleChange("color", color)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    formData.color.name === color.name ? "border-cyan-500 bg-cyan-600/20 ring-1 ring-cyan-500/50" : "border-slate-600 hover:border-slate-500"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-500"
                    style={{
                      backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                    }}
                  />
                  <span className="text-xs text-slate-300">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save/Cancel for Basic */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
            {hasChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                hasChanges
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      );
    }

    // Color settings only
    if (selectedNode === "basic.color") {
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Palette className="w-4 h-4 text-pink-400" />
            Color Settings
          </h3>
          
          <div>
            <label className="block text-xs text-slate-400 mb-2">Satellite Color</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleChange("color", color)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    formData.color.name === color.name ? "border-cyan-500 bg-cyan-600/20 ring-1 ring-cyan-500/50" : "border-slate-600 hover:border-slate-500"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-500"
                    style={{
                      backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                    }}
                  />
                  <span className="text-xs text-slate-300">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save/Cancel */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
            {hasChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                hasChanges
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      );
    }

    // Orbit/TLE settings
    if (selectedNode === "orbit" || selectedNode === "orbit.tle") {
      return (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Orbit className="w-4 h-4 text-purple-400" />
            Orbit Elements
          </h3>

          {/* Orbit Source Selection */}
          <div className="space-y-3">
            <h5 className="text-xs font-medium text-slate-400 uppercase">Source Type</h5>
            <div className="grid grid-cols-2 gap-2">
              {ORBIT_SOURCE_TYPES.map((source) => {
                // Map iconName to actual icon component
                const iconMap = { Link, FileText, Globe };
                const Icon = iconMap[source.iconName] || Globe;
                return (
                  <button
                    key={source.id}
                    onClick={() => handleChange("orbitSource", source.id)}
                    className={`flex items-start gap-2 p-2 rounded-lg border transition-all text-left ${
                      formData.orbitSource === source.id
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        formData.orbitSource === source.id ? "text-cyan-400" : "text-slate-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-white truncate">{source.name}</div>
                      <div className="text-xs text-slate-500 truncate">{source.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TLE from URL */}
          {(formData.orbitSource === "tle-url" || formData.orbitSource === "tle-url-history") && (
            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <h5 className="text-xs font-medium text-slate-400 uppercase">TLE Source</h5>

              {/* Source selection */}
              <div className="grid grid-cols-2 gap-2">
                {TLE_SOURCES.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleChange("tleSource", source.id)}
                    className={`px-2 py-1.5 rounded-lg border text-xs transition-all ${
                      formData.tleSource === source.id
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                        : "border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {source.name}
                  </button>
                ))}
              </div>

              {/* Custom URL input */}
              {formData.tleSource === "custom" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">TLE URL</label>
                  <input
                    type="text"
                    value={formData.tleUrl}
                    onChange={(e) => handleChange("tleUrl", e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Preview URL */}
              {formData.tleSource !== "custom" && formData.name && (
                <div className="text-xs text-slate-500 break-all">URL: {buildTleUrl()}</div>
              )}

              {/* Fetch button */}
              <button
                onClick={fetchTLE}
                disabled={loading || (!formData.name && formData.tleSource !== "custom")}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {loading ? "Fetching..." : "Fetch TLE"}
              </button>

              {/* Status message */}
              {fetchStatus && (
                <div
                  className={`flex items-center gap-2 text-xs ${
                    fetchStatus === "success" ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {fetchStatus === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {fetchMessage}
                </div>
              )}

              {/* TLE History selection */}
              {formData.orbitSource === "tle-url-history" && formData.tleHistory.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Select TLE Epoch ({formData.tleHistory.length} available)
                  </label>
                  <select
                    value={formData.selectedTleIndex}
                    onChange={(e) => selectTleFromHistory(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {formData.tleHistory.map((tle, idx) => (
                      <option key={idx} value={idx}>
                        {new Date(tle.epoch).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TLE Data Input - Show for all TLE-based sources */}
          {formData.orbitSource !== "keplerian" && (
            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <h5 className="text-xs font-medium text-slate-400 uppercase">TLE Data</h5>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Line 1 *</label>
                <input
                  type="text"
                  value={formData.tleLine1}
                  onChange={(e) => handleChange("tleLine1", e.target.value)}
                  placeholder="1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN"
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-xs font-mono ${
                    errors.tleLine1 ? "border-red-500" : "border-slate-600"
                  } focus:outline-none focus:border-cyan-500`}
                />
                {errors.tleLine1 && <p className="text-xs text-red-400 mt-1">{errors.tleLine1}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Line 2 *</label>
                <input
                  type="text"
                  value={formData.tleLine2}
                  onChange={(e) => handleChange("tleLine2", e.target.value)}
                  placeholder="2 NNNNN NNN.NNNN NNN.NNNN NNNNNNN NNN.NNNN NNN.NNNN NN.NNNNNNNNNNNNNN"
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-xs font-mono ${
                    errors.tleLine2 ? "border-red-500" : "border-slate-600"
                  } focus:outline-none focus:border-cyan-500`}
                />
                {errors.tleLine2 && <p className="text-xs text-red-400 mt-1">{errors.tleLine2}</p>}
              </div>

              {/* Extracted Orbital Elements from TLE */}
              {formData.tleLine1 && formData.tleLine2 && formData.tleLine1.startsWith("1 ") && formData.tleLine2.startsWith("2 ") && (() => {
                try {
                  const orbitalElements = extractOrbitalElements(formData.tleLine1, formData.tleLine2);
                  if (!orbitalElements) return null;
                  return (
                    <div className="space-y-3 mt-3 pt-3 border-t border-slate-700">
                      <h6 className="text-xs font-medium text-slate-400 uppercase">Orbital Elements (from TLE)</h6>
                      
                      {/* Calculated Orbital Info */}
                      <div className="grid grid-cols-3 gap-2 p-2 bg-cyan-900/20 rounded-lg border border-cyan-800/30">
                        <div className="text-center">
                          <p className="text-xs text-slate-500">Altitude</p>
                          <p className="text-sm font-medium text-cyan-400">
                            {orbitalElements.altitude?.toFixed(1) || "—"} km
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500">Period</p>
                          <p className="text-sm font-medium text-cyan-400">
                            {orbitalElements.period?.toFixed(1) || "—"} min
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500">Mean Motion</p>
                          <p className="text-sm font-medium text-cyan-400">
                            {orbitalElements.meanMotion?.toFixed(4) || "—"} rev/day
                          </p>
                        </div>
                      </div>

                      {/* Detailed Orbital Elements */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">Inclination</p>
                          <p className="text-white font-medium">{orbitalElements.inclination?.toFixed(4)}°</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">RAAN</p>
                          <p className="text-white font-medium">{orbitalElements.raan?.toFixed(4)}°</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">Eccentricity</p>
                          <p className="text-white font-medium">{orbitalElements.eccentricity?.toFixed(7)}</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">Arg of Perigee</p>
                          <p className="text-white font-medium">{orbitalElements.argOfPerigee?.toFixed(4)}°</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">Mean Anomaly</p>
                          <p className="text-white font-medium">{orbitalElements.meanAnomaly?.toFixed(4)}°</p>
                        </div>
                        <div className="p-2 bg-slate-900/50 rounded">
                          <p className="text-slate-500">Semi-major Axis</p>
                          <p className="text-white font-medium">{orbitalElements.semiMajorAxis?.toFixed(3)} km</p>
                        </div>
                      </div>

                      {/* TLE Epoch */}
                      {orbitalElements.epoch && (
                        <div className="p-2 bg-slate-900/50 rounded text-xs">
                          <p className="text-slate-500">TLE Epoch</p>
                          <p className="text-white font-medium">{orbitalElements.epoch.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  );
                } catch (e) {
                  console.error("Error parsing TLE orbital elements:", e);
                  return null;
                }
              })()}
            </div>
          )}

          {/* Keplerian Elements */}
          {formData.orbitSource === "keplerian" && (
            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <h5 className="text-xs font-medium text-slate-400 uppercase">Keplerian Elements</h5>

              {/* Orbit Preset Selector */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Orbit Preset</label>
                <select
                  value={formData.orbitPreset}
                  onChange={(e) => {
                    const preset = ORBIT_PRESETS.find((p) => p.id === e.target.value);
                    if (preset && preset.values) {
                      setFormData((prev) => ({
                        ...prev,
                        orbitPreset: e.target.value,
                        ...preset.values,
                      }));
                      setHasChanges(true);
                    } else {
                      handleChange("orbitPreset", e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  {ORBIT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} - {preset.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculated Orbital Info */}
              <div className="grid grid-cols-3 gap-2 p-2 bg-cyan-900/20 rounded-lg border border-cyan-800/30">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Altitude</p>
                  <p className="text-sm font-medium text-cyan-400">
                    {calculateAltitude(formData.semiMajorAxis)?.toFixed(1) || "—"} km
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Period</p>
                  <p className="text-sm font-medium text-cyan-400">
                    {calculateOrbitalPeriod(formData.semiMajorAxis)?.toFixed(1) || "—"} min
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Mean Motion</p>
                  <p className="text-sm font-medium text-cyan-400">
                    {calculateMeanMotion(formData.semiMajorAxis)?.toFixed(4) || "—"} rev/day
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Altitude (convenience input) */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Altitude (km)</label>
                  <input
                    type="number"
                    step="1"
                    value={calculateAltitude(formData.semiMajorAxis)?.toFixed(1) || ""}
                    onChange={(e) => {
                      const alt = parseFloat(e.target.value);
                      if (!isNaN(alt)) {
                        handleChange("semiMajorAxis", (EARTH_RADIUS_KM + alt).toFixed(3));
                        handleChange("orbitPreset", "custom");
                      }
                    }}
                    placeholder="e.g. 600"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-xs text-slate-500 mt-0.5">Auto-calculates Semi-major Axis</p>
                </div>

                {/* Semi-major axis */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Semi-major Axis (km) *</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.semiMajorAxis}
                    onChange={(e) => handleChange("semiMajorAxis", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.semiMajorAxis ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.semiMajorAxis && <p className="text-xs text-red-400 mt-1">{errors.semiMajorAxis}</p>}
                </div>

                {/* Eccentricity */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Eccentricity *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.eccentricity}
                    onChange={(e) => handleChange("eccentricity", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.eccentricity ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.eccentricity && <p className="text-xs text-red-400 mt-1">{errors.eccentricity}</p>}
                </div>

                {/* Inclination */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Inclination (°) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.inclination}
                    onChange={(e) => handleChange("inclination", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.inclination ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.inclination && <p className="text-xs text-red-400 mt-1">{errors.inclination}</p>}
                </div>

                {/* RAAN */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">RAAN (°) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.raan}
                    onChange={(e) => handleChange("raan", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.raan ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.raan && <p className="text-xs text-red-400 mt-1">{errors.raan}</p>}
                </div>

                {/* Argument of Perigee */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Arg. of Perigee (°) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.argOfPerigee}
                    onChange={(e) => handleChange("argOfPerigee", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.argOfPerigee ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.argOfPerigee && <p className="text-xs text-red-400 mt-1">{errors.argOfPerigee}</p>}
                </div>

                {/* Mean Anomaly */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mean Anomaly (°) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.meanAnomaly}
                    onChange={(e) => handleChange("meanAnomaly", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm ${
                      errors.meanAnomaly ? "border-red-500" : "border-slate-600"
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  {errors.meanAnomaly && <p className="text-xs text-red-400 mt-1">{errors.meanAnomaly}</p>}
                </div>
              </div>

              {/* Epoch */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Epoch *</label>
                <input
                  type="datetime-local"
                  value={formData.epoch}
                  onChange={(e) => handleChange("epoch", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Current Orbit Info Display */}
          {currentPosition && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="text-xs font-medium text-slate-300 mb-2">Current Orbit Info</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Altitude</p>
                  <p className="text-cyan-400 font-medium">{currentPosition.altitude?.toFixed(1)} km</p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Velocity</p>
                  <p className="text-cyan-400 font-medium">{currentPosition.velocity?.toFixed(2)} km/s</p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Latitude</p>
                  <p className="text-white">{currentPosition.latitude?.toFixed(4)}°</p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Longitude</p>
                  <p className="text-white">{currentPosition.longitude?.toFixed(4)}°</p>
                </div>
              </div>
            </div>
          )}

          {/* Save/Cancel */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
            {hasChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                hasChanges
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      );
    }

    // Objects list view
    if (selectedNode === "objects") {
      // Separate coverage object from sensor objects
      const coverageObject = formData.objects.find(obj => obj.isDefaultCoverage);
      const sensorObjects = formData.objects.filter(obj => !obj.isDefaultCoverage);

      return (
        <div className="space-y-4">
          {/* Coverage Section */}
          {coverageObject && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Radar className="w-4 h-4 text-cyan-400" />
                Coverage Area
              </h3>
              <div
                onClick={() => setSelectedNode(`objects.${coverageObject.id}`)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedNode === `objects.${coverageObject.id}` 
                    ? "border-cyan-500/50 bg-cyan-900/20" 
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full border border-slate-500 shrink-0"
                  style={{
                    backgroundColor: `rgba(${coverageObject.color.r * 255}, ${coverageObject.color.g * 255}, ${coverageObject.color.b * 255}, 0.5)`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{coverageObject.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {coverageObject.coverageMode === "auto" ? (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Radar className="w-3 h-3" />
                        Auto (Altitude-based)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-purple-400">
                        <Circle className="w-3 h-3" />
                        Manual: {coverageObject.manualRadius} km
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {coverageObject.isVisible ? (
                    <Eye className="w-4 h-4 text-green-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sensor Objects Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                Sensor Objects
              </h3>
              <button
                onClick={addObject}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors border border-blue-500/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Object
              </button>
            </div>

            {sensorObjects.length === 0 ? (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <p className="text-sm text-slate-400">No sensor objects configured</p>
                <p className="text-xs text-slate-500 mt-1">Add sensor objects to define scanning areas</p>
              </div>
            ) : (
              sensorObjects.map((obj) => (
                <div
                  key={obj.id}
                  onClick={() => setSelectedNode(`objects.${obj.id}`)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNode === `objects.${obj.id}` ? "border-blue-500/50 bg-blue-900/20" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-slate-500 shrink-0"
                    style={{
                      backgroundColor: `rgb(${obj.color.r * 255}, ${obj.color.g * 255}, ${obj.color.b * 255})`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{obj.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Scan className="w-3 h-3 text-green-400" />
                        <span className="text-green-300">{obj.scanWidth} km</span>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-purple-400">FOV {obj.fovCrossTrack}°×{obj.fovAlongTrack}°</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {obj.isVisible ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-slate-600" />}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeObject(obj.id);
                      }}
                      title="Delete Object"
                      className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Save/Cancel */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
            {hasChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                hasChanges
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      );
    }

    // Object detail settings
    if (selectedObject) {
      // Check if this is the default coverage object
      if (selectedObject.isDefaultCoverage) {
        // Calculate current coverage radius based on altitude
        const altitude = currentPosition?.alt || 600;
        const autoRadius = calculateCoverageRadius(altitude, selectedObject.minElevationAngle ?? 0);

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Radar className="w-4 h-4 text-cyan-400" />
                Coverage Configuration
              </h3>
            </div>

            {/* Coverage Info */}
            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-800/30">
              <div className="text-xs text-cyan-400 mb-2">Coverage Area</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Current Altitude</p>
                  <p className="text-sm font-medium text-white">{altitude.toFixed(1)} km</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Coverage Radius</p>
                  <p className="text-sm font-medium text-cyan-400">
                    {selectedObject.coverageMode === "auto" 
                      ? `${autoRadius.toFixed(1)} km` 
                      : `${selectedObject.manualRadius} km`}
                  </p>
                </div>
              </div>
            </div>

            {/* Coverage Mode Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Coverage Mode
              </div>
              <div className="grid grid-cols-1 gap-2">
                {COVERAGE_MODES.map((mode) => {
                  const iconMap = { Radar, Circle };
                  const ModeIcon = iconMap[mode.iconName] || Circle;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => updateObject(selectedObject.id, "coverageMode", mode.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                        selectedObject.coverageMode === mode.id
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-slate-600 hover:border-slate-500"
                      }`}
                    >
                      <ModeIcon className={`w-5 h-5 mt-0.5 ${
                        selectedObject.coverageMode === mode.id ? "text-cyan-400" : "text-slate-500"
                      }`} />
                      <div>
                        <div className={`text-sm font-medium ${
                          selectedObject.coverageMode === mode.id ? "text-cyan-300" : "text-slate-300"
                        }`}>
                          {mode.name}
                        </div>
                        <div className="text-xs text-slate-500">{mode.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto Mode Settings */}
            {selectedObject.coverageMode === "auto" && (
              <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h5 className="text-xs font-medium text-slate-400 uppercase">Auto Coverage Settings</h5>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Minimum Elevation Angle (°)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="90"
                    value={selectedObject.minElevationAngle ?? 0}
                    onChange={(e) => updateObject(selectedObject.id, "minElevationAngle", Math.max(0, Math.min(90, parseFloat(e.target.value) || 0)))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    0° = horizon (max coverage), 90° = directly overhead (min coverage)
                  </p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded text-center">
                  <p className="text-xs text-slate-500">Calculated Radius</p>
                  <p className="text-lg font-medium text-cyan-400">{autoRadius.toFixed(1)} km</p>
                </div>
              </div>
            )}

            {/* Manual Mode Settings */}
            {selectedObject.coverageMode === "manual" && (
              <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <h5 className="text-xs font-medium text-slate-400 uppercase">Manual Coverage Settings</h5>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Coverage Radius (km)</label>
                  <input
                    type="number"
                    step="10"
                    min="1"
                    value={selectedObject.manualRadius || 500}
                    onChange={(e) => updateObject(selectedObject.id, "manualRadius", parseFloat(e.target.value) || 500)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>
            )}

            {/* Visual Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                Visual Settings
              </div>
              
              <div>
                <label className="block text-xs text-slate-400 mb-2">Coverage Color</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_COLORS.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => updateObject(selectedObject.id, "color", color)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
                        selectedObject.color?.name === color.name
                          ? "border-cyan-500 bg-cyan-600/20 ring-1 ring-cyan-500/50"
                          : "border-slate-600 hover:border-slate-500"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-slate-500"
                        style={{
                          backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                        }}
                      />
                      <span className="text-xs text-slate-300">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fill Opacity</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={selectedObject.fillOpacity || 0.15}
                    onChange={(e) => updateObject(selectedObject.id, "fillOpacity", parseFloat(e.target.value) || 0.15)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Outline Opacity</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={selectedObject.outlineOpacity || 0.6}
                    onChange={(e) => updateObject(selectedObject.id, "outlineOpacity", parseFloat(e.target.value) || 0.6)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-sm text-slate-300 flex items-center gap-2">
                {selectedObject.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Show Coverage
              </span>
              <button
                onClick={() => updateObject(selectedObject.id, "isVisible", !selectedObject.isVisible)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  selectedObject.isVisible ? "bg-cyan-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    selectedObject.isVisible ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
              {hasChanges && (
                <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                  hasChanges
                    ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        );
      }

      // Regular sensor object form
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-400" />
              {selectedObject.name}
            </h3>
            <button
              onClick={() => removeObject(selectedObject.id)}
              className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
              title="Delete Object"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Object Name */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Object Name</label>
            <input
              type="text"
              value={selectedObject.name}
              onChange={(e) => updateObject(selectedObject.id, "name", e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="Enter object name"
            />
          </div>

          {/* Orientation */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Pointing Axis</label>
            <div className="grid grid-cols-3 gap-2">
              {AXIS_OPTIONS.map((axis) => (
                <button
                  key={axis.id}
                  onClick={() => updateObject(selectedObject.id, "axis", axis.id)}
                  className={`px-3 py-2 rounded-lg text-xs transition-all ${
                    selectedObject.axis === axis.id
                      ? "bg-yellow-600/30 text-yellow-300 border border-yellow-500/50"
                      : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                  }`}
                >
                  {axis.name}
                </button>
              ))}
            </div>
          </div>

          {/* Scanning Parameters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Scan className="w-3.5 h-3.5 text-green-400" />
              Swath Configuration
            </div>

            {/* Swath Shape Selection */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Swath Shape</label>
              <div className="grid grid-cols-2 gap-2">
                {SWATH_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => updateObject(selectedObject.id, "swathShape", shape.id)}
                    className={`px-2 py-1.5 rounded-lg text-xs transition-all text-left ${
                      (selectedObject.swathShape || "rectangle") === shape.id
                        ? "bg-green-600/30 text-green-300 border border-green-500/50"
                        : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <div className="font-medium">{shape.name}</div>
                    <div className="text-xs text-slate-500 truncate">{shape.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Shape-specific parameters */}
            {/* Circle: only width (diameter) */}
            {(selectedObject.swathShape === "circle" || !selectedObject.swathShape) && selectedObject.swathShape !== "rectangle" && selectedObject.swathShape !== "ellipse" && selectedObject.swathShape !== "cone" && selectedObject.swathShape !== "polygon" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Diameter (km)</label>
                  <input
                    type="number"
                    value={selectedObject.scanWidth || 100}
                    onChange={(e) => updateObject(selectedObject.id, "scanWidth", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    min="0"
                    step="10"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Off-Nadir (°)</label>
                  <input
                    type="number"
                    value={selectedObject.scanAngle || 0}
                    onChange={(e) => updateObject(selectedObject.id, "scanAngle", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    min="-60"
                    max="60"
                    step="1"
                  />
                </div>
              </div>
            )}

            {/* Rectangle: width x length */}
            {selectedObject.swathShape === "rectangle" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Width / Cross-track (km)</label>
                    <input
                      type="number"
                      value={selectedObject.scanWidth || 100}
                      onChange={(e) => updateObject(selectedObject.id, "scanWidth", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Length / Along-track (km)</label>
                    <input
                      type="number"
                      value={selectedObject.scanLength || 100}
                      onChange={(e) => updateObject(selectedObject.id, "scanLength", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      step="10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Off-Nadir Angle (°)</label>
                  <input
                    type="number"
                    value={selectedObject.scanAngle || 0}
                    onChange={(e) => updateObject(selectedObject.id, "scanAngle", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    min="-60"
                    max="60"
                    step="1"
                  />
                </div>
                <p className="text-xs text-slate-500">Rectangle swath oriented along satellite track direction.</p>
              </div>
            )}

            {/* Ellipse: width x length */}
            {selectedObject.swathShape === "ellipse" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Width / Semi-minor (km)</label>
                    <input
                      type="number"
                      value={selectedObject.scanWidth || 100}
                      onChange={(e) => updateObject(selectedObject.id, "scanWidth", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Length / Semi-major (km)</label>
                    <input
                      type="number"
                      value={selectedObject.scanLength || 100}
                      onChange={(e) => updateObject(selectedObject.id, "scanLength", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      step="10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Off-Nadir Angle (°)</label>
                  <input
                    type="number"
                    value={selectedObject.scanAngle || 0}
                    onChange={(e) => updateObject(selectedObject.id, "scanAngle", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    min="-60"
                    max="60"
                    step="1"
                  />
                </div>
              </div>
            )}

            {/* Cone/Sector: cone angle + sector range */}
            {selectedObject.swathShape === "cone" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cone Radius (km)</label>
                    <input
                      type="number"
                      value={selectedObject.scanWidth || 100}
                      onChange={(e) => updateObject(selectedObject.id, "scanWidth", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      step="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Half-Cone Angle (°)</label>
                    <input
                      type="number"
                      value={selectedObject.coneAngle || 30}
                      onChange={(e) => updateObject(selectedObject.id, "coneAngle", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      max="90"
                      step="1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sector Start (°)</label>
                    <input
                      type="number"
                      value={selectedObject.sectorStart || 0}
                      onChange={(e) => updateObject(selectedObject.id, "sectorStart", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      max="360"
                      step="5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Sector End (°)</label>
                    <input
                      type="number"
                      value={selectedObject.sectorEnd || 360}
                      onChange={(e) => updateObject(selectedObject.id, "sectorEnd", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      min="0"
                      max="360"
                      step="5"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Sector angles: 0°=forward, 90°=right, 180°=back, 270°=left</p>
              </div>
            )}

            {/* Polygon: custom vertices */}
            {selectedObject.swathShape === "polygon" && (
              <div className="space-y-2">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">
                    Define polygon vertices as offsets from nadir (km). Format: X,Y pairs where X=cross-track, Y=along-track.
                  </p>
                  <textarea
                    value={(selectedObject.polygonVertices || []).map(v => `${v.x},${v.y}`).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      const vertices = lines.map(line => {
                        const [x, y] = line.split(',').map(v => parseFloat(v.trim()) || 0);
                        return { x, y };
                      }).filter(v => !isNaN(v.x) && !isNaN(v.y));
                      updateObject(selectedObject.id, "polygonVertices", vertices);
                    }}
                    placeholder="0,50&#10;25,25&#10;25,-25&#10;0,-50&#10;-25,-25&#10;-25,25"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    rows={5}
                  />
                  <p className="text-xs text-slate-500 mt-1">Each line: X,Y (e.g., "50,100" = 50km right, 100km forward)</p>
                </div>
              </div>
            )}
          </div>

          {/* Field of View */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Move className="w-3.5 h-3.5 text-purple-400" />
              Field of View
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cross-track (°)</label>
                <input
                  type="number"
                  value={selectedObject.fovCrossTrack}
                  onChange={(e) => updateObject(selectedObject.id, "fovCrossTrack", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  min="0"
                  max="180"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Along-track (°)</label>
                <input
                  type="number"
                  value={selectedObject.fovAlongTrack}
                  onChange={(e) => updateObject(selectedObject.id, "fovAlongTrack", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  min="0"
                  max="180"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Object Color</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => updateObject(selectedObject.id, "color", color)}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
                    selectedObject.color?.name === color.name ? "border-blue-500 bg-blue-600/20 ring-1 ring-blue-500/50" : "border-slate-600 hover:border-slate-500"
                  }`}
                  title={color.name}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-500"
                    style={{
                      backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                    }}
                  />
                  <span className="text-xs text-slate-300">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Visibility Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-sm text-slate-300">Show Object</span>
              <button
                onClick={() => updateObject(selectedObject.id, "isVisible", !selectedObject.isVisible)}
                className={`relative w-10 h-5 rounded-full transition-colors ${selectedObject.isVisible ? "bg-cyan-500" : "bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedObject.isVisible ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-sm text-slate-300">Show Swath on Ground</span>
              <button
                onClick={() => updateObject(selectedObject.id, "showSwath", !selectedObject.showSwath)}
                className={`relative w-10 h-5 rounded-full transition-colors ${selectedObject.showSwath ? "bg-green-500" : "bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedObject.showSwath ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-sm text-slate-300">Show Label</span>
              <button
                onClick={() => updateObject(selectedObject.id, "showLabel", !selectedObject.showLabel)}
                className={`relative w-10 h-5 rounded-full transition-colors ${selectedObject.showLabel ? "bg-blue-500" : "bg-slate-600"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectedObject.showLabel ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Save/Cancel */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
            {hasChanges && (
              <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                hasChanges
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      );
    }

    // Default: show satellite overview
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-400" />
          Satellite Overview
        </h3>
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `rgb(${formData.color.r * 255}, ${formData.color.g * 255}, ${formData.color.b * 255})`,
              }}
            >
              <Satellite className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-medium">{formData.name || "Unnamed Satellite"}</p>
              <p className="text-xs text-slate-400">NORAD ID: {formData.noradId || "N/A"}</p>
            </div>
          </div>
          {currentPosition && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Altitude</p>
                <p className="text-sm text-cyan-400">{currentPosition.altitude?.toFixed(1)} km</p>
              </div>
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Velocity</p>
                <p className="text-sm text-cyan-400">{currentPosition.velocity?.toFixed(2)} km/s</p>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {formData.objects.length} sensor object{formData.objects.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <p className="text-xs text-slate-500 text-center">Select an item from the tree to edit properties</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`absolute top-2 right-2 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs shadow-lg ${
            toast.type === "success" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Main Content - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Object Tree */}
        <div className="w-48 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 overflow-y-auto">
          {/* Basic Properties */}
          <TreeItem
            icon={Settings}
            label="Basic"
            isSelected={selectedNode === "basic"}
            isExpanded={expandedNodes.basic}
            hasChildren={true}
            onClick={() => setSelectedNode("basic")}
            onToggle={() => toggleNode("basic")}
          />
          {expandedNodes.basic && (
            <>
              <TreeItem
                icon={Satellite}
                label="Satellite Name"
                isSelected={selectedNode === "basic.name" || selectedNode === "basic.noradId"}
                onClick={() => setSelectedNode("basic.name")}
                level={1}
              />
              <TreeItem
                icon={Palette}
                label="Color"
                isSelected={selectedNode === "basic.color"}
                onClick={() => setSelectedNode("basic.color")}
                level={1}
              />
            </>
          )}

          {/* Orbit */}
          <TreeItem
            icon={Orbit}
            label="Orbit"
            isSelected={selectedNode === "orbit" || selectedNode === "orbit.tle"}
            isExpanded={expandedNodes.orbit}
            hasChildren={true}
            onClick={() => setSelectedNode("orbit")}
            onToggle={() => toggleNode("orbit")}
          />
          {expandedNodes.orbit && (
            <TreeItem
              label="TLE Data"
              isSelected={selectedNode === "orbit.tle"}
              onClick={() => setSelectedNode("orbit.tle")}
              level={1}
            />
          )}

          {/* Objects */}
          <TreeItem
            icon={Box}
            label={`Objects (${formData.objects.length})`}
            isSelected={selectedNode === "objects"}
            isExpanded={expandedNodes.objects}
            hasChildren={formData.objects.length > 0}
            onClick={() => setSelectedNode("objects")}
            onToggle={() => toggleNode("objects")}
          />
          {expandedNodes.objects &&
            formData.objects.map((obj) => (
              <TreeItem
                key={obj.id}
                icon={obj.isDefaultCoverage ? Radar : Box}
                label={obj.name}
                isSelected={selectedNode === `objects.${obj.id}`}
                onClick={() => setSelectedNode(`objects.${obj.id}`)}
                level={1}
              />
            ))}
        </div>

        {/* Right Column - Form Input */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderForm()}
        </div>
      </div>
    </div>
  );
};

export default SatellitePropertiesTab;
