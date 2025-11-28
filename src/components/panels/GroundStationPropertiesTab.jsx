/**
 * GroundStationPropertiesTab Component
 * Tab content for viewing/editing ground station properties
 * 2-Column Layout: Left (Object Tree) | Right (Form Input)
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Radio,
  Palette,
  Target,
  Save,
  Trash2,
  Plus,
  Satellite,
  Circle,
  Settings,
  Eye,
  X,
  ChevronUp,
  Clock,
  Play,
  Loader2,
  Calendar,
  Copy,
  FileText,
  Download,
  History,
  Info,
} from "lucide-react";
import { useGroundStationStore, useSatelliteStore, useTabsStore, useTimeStore } from "../../stores";
import { calculateSatellitePasses, calculatePassDetails, parseTleEpoch } from "../../services/satelliteCalculator";

// Predefined colors for ground stations
const PRESET_COLORS = [
  { name: "Orange", r: 1, g: 0.5, b: 0 },
  { name: "Red", r: 1, g: 0.2, b: 0.2 },
  { name: "Green", r: 0.2, g: 0.8, b: 0.2 },
  { name: "Blue", r: 0.2, g: 0.5, b: 1 },
  { name: "Purple", r: 0.7, g: 0.3, b: 0.9 },
  { name: "Yellow", r: 1, g: 0.9, b: 0.2 },
  { name: "Cyan", r: 0.2, g: 0.9, b: 0.9 },
  { name: "Pink", r: 1, g: 0.4, b: 0.7 },
];

// Station type options
const STATION_TYPES = [
  { id: "tracking", name: "Tracking", icon: "📡" },
  { id: "command", name: "Command", icon: "🎛️" },
  { id: "relay", name: "Relay", icon: "🔄" },
  { id: "receive", name: "Receive", icon: "📥" },
];

// Default coverage item
const createDefaultCoverage = () => ({
  id: `cov-${Date.now()}`,
  name: "Coverage 1",
  type: "manual",
  satelliteId: null,
  minElevation: 5,
  maxRange: 2500,
  color: PRESET_COLORS[0],
  isVisible: true,
});

// Tree Item Component
const TreeItem = ({ icon: Icon, label, isSelected, isExpanded, hasChildren, onClick, onToggle, level = 0 }) => {
  return (
    <div
      className={`flex items-center gap-1.5 py-1.5 cursor-pointer transition-colors text-xs ${
        isSelected ? "bg-blue-600/30 text-blue-300 border-l-2 border-blue-500" : "text-slate-300 hover:bg-slate-700/50 border-l-2 border-transparent"
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

const GroundStationPropertiesTab = ({ stationId }) => {
  // Get station from store
  const station = useGroundStationStore((state) => state.groundStations.find((gs) => gs.id === stationId));
  const updateGroundStation = useGroundStationStore((state) => state.updateGroundStation);
  const satellites = useSatelliteStore((state) => state.satellites);
  const removeTab = useTabsStore((state) => state.removeTab);
  const currentTime = useTimeStore((state) => state.currentTime);

  // Tree state
  const [expandedNodes, setExpandedNodes] = useState({
    basic: true,
    coverages: true,
  });
  const [selectedNode, setSelectedNode] = useState("basic.name");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    lat: "",
    lon: "",
    alt: "0",
    type: "tracking",
    color: PRESET_COLORS[0],
    coverages: [],
  });

  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Access Analysis state
  const [accessConfig, setAccessConfig] = useState({
    satelliteId: "",
    startDate: "",
    endDate: "",
    minElevation: 5,
    selectedTleIndex: -1, // -1 means use current TLE
  });
  const [accessResults, setAccessResults] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedPasses, setExpandedPasses] = useState({}); // Track which passes are expanded
  const [passDetails, setPassDetails] = useState({}); // Store calculated pass details

  // Initialize access config with current time (only once on mount)
  useEffect(() => {
    const now = new Date(currentTime);
    const startDate = now.toISOString().slice(0, 16);
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16); // +24 hours
    setAccessConfig((prev) => ({
      ...prev,
      startDate,
      endDate,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate Access (AOS/LOS)
  const calculateAccess = useCallback(() => {
    if (!accessConfig.satelliteId || !accessConfig.startDate || !accessConfig.endDate) {
      return;
    }

    const selectedSat = satellites.find((s) => s.id === accessConfig.satelliteId);
    if (!selectedSat?.tle) return;

    if (!station?.location) return;

    // Get TLE to use - either from history or current
    let tleToUse = selectedSat.tle;
    if (accessConfig.selectedTleIndex >= 0 && selectedSat.tleHistory?.length > 0) {
      const historyTle = selectedSat.tleHistory[accessConfig.selectedTleIndex];
      if (historyTle) {
        tleToUse = { line1: historyTle.line1, line2: historyTle.line2 };
      }
    }

    setIsCalculating(true);
    setAccessResults([]);
    setExpandedPasses({});
    setPassDetails({});

    // Run calculation (could be async in future)
    setTimeout(() => {
      try {
        const startTimestamp = new Date(accessConfig.startDate).getTime();
        const endTimestamp = new Date(accessConfig.endDate).getTime();

        const passes = calculateSatellitePasses(
          tleToUse,
          {
            lat: station.location.lat,
            lon: station.location.lon,
            alt: station.location.alt || 0,
          },
          startTimestamp,
          endTimestamp,
          accessConfig.minElevation
        );

        // Store TLE used for later reference in pass details
        setAccessResults(passes.map((p, i) => ({ ...p, _tleUsed: tleToUse, _index: i })));
      } catch (error) {
        console.error("Error calculating access:", error);
        setAccessResults([]);
      } finally {
        setIsCalculating(false);
      }
    }, 100);
  }, [accessConfig, satellites, station]);

  // Toggle pass expansion and calculate details
  const togglePassExpansion = useCallback(
    (passIndex, pass) => {
      setExpandedPasses((prev) => {
        const newExpanded = { ...prev };
        if (newExpanded[passIndex]) {
          delete newExpanded[passIndex];
        } else {
          newExpanded[passIndex] = true;
          // Calculate pass details if not already calculated
          if (!passDetails[passIndex]) {
            const details = calculatePassDetails(
              pass._tleUsed,
              {
                lat: station?.location?.lat,
                lon: station?.location?.lon,
                alt: station?.location?.alt || 0,
              },
              pass
            );
            setPassDetails((prev) => ({ ...prev, [passIndex]: details }));
          }
        }
        return newExpanded;
      });
    },
    [passDetails, station]
  );

  // Get selected satellite and its TLE info
  const selectedSatellite = satellites.find((s) => s.id === accessConfig.satelliteId);
  const currentTleEpoch = selectedSatellite?.tle?.line1 ? parseTleEpoch(selectedSatellite.tle.line1) : null;
  const selectedHistoryEpoch =
    accessConfig.selectedTleIndex >= 0 && selectedSatellite?.tleHistory?.[accessConfig.selectedTleIndex]
      ? parseTleEpoch(selectedSatellite.tleHistory[accessConfig.selectedTleIndex].line1)
      : null;

  // Export functions
  const formatPassForExport = (pass, index) => {
    const aosTime = new Date(pass.aos.time);
    const maxTime = new Date(pass.maxElevation.time);
    const losTime = new Date(pass.los.time);
    const duration = `${Math.floor(pass.duration / 60)}m ${Math.floor(pass.duration % 60)}s`;

    return {
      num: index + 1,
      aosDate: aosTime.toISOString().split("T")[0],
      aosTime: aosTime.toISOString().split("T")[1].split(".")[0],
      aosAz: pass.aos.azimuth.toFixed(1),
      maxTime: maxTime.toISOString().split("T")[1].split(".")[0],
      maxEl: pass.maxElevation.elevation.toFixed(1),
      losTime: losTime.toISOString().split("T")[1].split(".")[0],
      losAz: pass.los.azimuth.toFixed(1),
      duration,
    };
  };

  const getExportHeader = () => {
    const satName = selectedSatellite?.name || "Unknown";
    const gsName = station?.name || "Unknown";
    const startStr = accessConfig.startDate ? new Date(accessConfig.startDate).toISOString() : "";
    const endStr = accessConfig.endDate ? new Date(accessConfig.endDate).toISOString() : "";
    const epochStr = selectedHistoryEpoch ? selectedHistoryEpoch.toISOString() : currentTleEpoch ? currentTleEpoch.toISOString() : "N/A";

    return {
      satellite: satName,
      groundStation: gsName,
      start: startStr,
      end: endStr,
      minElevation: accessConfig.minElevation,
      tleEpoch: epochStr,
    };
  };

  const exportToClipboard = async () => {
    const header = getExportHeader();
    let text = `Access Analysis Report\n`;
    text += `======================\n`;
    text += `Satellite: ${header.satellite}\n`;
    text += `Ground Station: ${header.groundStation}\n`;
    text += `Analysis Period: ${header.start} to ${header.end}\n`;
    text += `Min Elevation: ${header.minElevation}°\n`;
    text += `TLE Epoch: ${header.tleEpoch}\n\n`;
    text += `Pass Predictions (${accessResults.length} passes)\n`;
    text += `-`.repeat(80) + `\n`;
    text += `#\tAOS Date\tAOS Time\tAOS Az\tMax El Time\tMax El\tLOS Time\tLOS Az\tDuration\n`;

    accessResults.forEach((pass, index) => {
      const p = formatPassForExport(pass, index);
      text += `${p.num}\t${p.aosDate}\t${p.aosTime}\t${p.aosAz}°\t${p.maxTime}\t${p.maxEl}°\t${p.losTime}\t${p.losAz}°\t${p.duration}\n`;
    });

    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const exportToCSV = () => {
    const header = getExportHeader();
    let csv = `"Access Analysis Report"\n`;
    csv += `"Satellite","${header.satellite}"\n`;
    csv += `"Ground Station","${header.groundStation}"\n`;
    csv += `"Start","${header.start}"\n`;
    csv += `"End","${header.end}"\n`;
    csv += `"Min Elevation","${header.minElevation}"\n`;
    csv += `"TLE Epoch","${header.tleEpoch}"\n\n`;
    csv += `"#","AOS Date","AOS Time","AOS Az","Max El Time","Max El","LOS Time","LOS Az","Duration"\n`;

    accessResults.forEach((pass, index) => {
      const p = formatPassForExport(pass, index);
      csv += `"${p.num}","${p.aosDate}","${p.aosTime}","${p.aosAz}","${p.maxTime}","${p.maxEl}","${p.losTime}","${p.losAz}","${p.duration}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access_${header.satellite}_${header.groundStation}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToTXT = () => {
    const header = getExportHeader();
    let text = `Access Analysis Report\n`;
    text += `${"=".repeat(80)}\n\n`;
    text += `Satellite:       ${header.satellite}\n`;
    text += `Ground Station:  ${header.groundStation}\n`;
    text += `Analysis Start:  ${header.start}\n`;
    text += `Analysis End:    ${header.end}\n`;
    text += `Min Elevation:   ${header.minElevation}°\n`;
    text += `TLE Epoch:       ${header.tleEpoch}\n\n`;
    text += `${"=".repeat(80)}\n`;
    text += `Pass Predictions (${accessResults.length} passes found)\n`;
    text += `${"=".repeat(80)}\n\n`;

    accessResults.forEach((pass, index) => {
      const p = formatPassForExport(pass, index);
      text += `Pass #${p.num}\n`;
      text += `  AOS:    ${p.aosDate} ${p.aosTime} UTC | Azimuth: ${p.aosAz}°\n`;
      text += `  MAX EL: ${p.maxTime} UTC | Elevation: ${p.maxEl}°\n`;
      text += `  LOS:    ${p.losTime} UTC | Azimuth: ${p.losAz}°\n`;
      text += `  Duration: ${p.duration}\n\n`;
    });

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access_${header.satellite}_${header.groundStation}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initialize form when station changes
  useEffect(() => {
    if (station) {
      const coverages = station.coverages || [
        {
          id: "cov-default",
          name: "Default Coverage",
          type: "manual",
          satelliteId: null,
          minElevation: station.antenna?.minElevation || 5,
          maxRange: station.antenna?.maxRange || 2500,
          color: station.color || PRESET_COLORS[0],
          isVisible: station.showCoverage !== false,
        },
      ];

      setFormData({
        name: station.name || "",
        lat: station.location?.lat?.toString() || "",
        lon: station.location?.lon?.toString() || "",
        alt: (station.location?.alt || 0).toString(),
        type: station.type || "tracking",
        color: station.color || PRESET_COLORS[0],
        coverages,
      });
      setHasChanges(false);
    }
  }, [station]);

  // Toggle tree node expansion
  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Handle input changes
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Handle coverage changes
  const handleCoverageChange = (index, field, value) => {
    setFormData((prev) => {
      const newCoverages = [...prev.coverages];
      newCoverages[index] = { ...newCoverages[index], [field]: value };
      return { ...prev, coverages: newCoverages };
    });
    setHasChanges(true);
  };

  // Add new coverage
  const addCoverage = () => {
    const newCov = createDefaultCoverage();
    newCov.name = `Coverage ${formData.coverages.length + 1}`;
    newCov.color = PRESET_COLORS[formData.coverages.length % PRESET_COLORS.length];
    setFormData((prev) => ({ ...prev, coverages: [...prev.coverages, newCov] }));
    setHasChanges(true);
    setSelectedNode(`coverage.${formData.coverages.length}`);
  };

  // Remove coverage
  const removeCoverage = (index) => {
    if (formData.coverages.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      coverages: prev.coverages.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
    setSelectedNode("coverages");
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Required";

    const lat = parseFloat(formData.lat);
    if (isNaN(lat) || lat < -90 || lat > 90) newErrors.lat = "Invalid (-90 to 90)";

    const lon = parseFloat(formData.lon);
    if (isNaN(lon) || lon < -180 || lon > 180) newErrors.lon = "Invalid (-180 to 180)";

    formData.coverages.forEach((cov, idx) => {
      if (cov.type === "satellite" && !cov.satelliteId) {
        newErrors[`cov-${idx}-satellite`] = "Required";
      }
      if (cov.type === "manual") {
        const minElev = parseFloat(cov.minElevation);
        if (isNaN(minElev) || minElev < 0 || minElev > 90) {
          newErrors[`cov-${idx}-minElevation`] = "Invalid (0-90)";
        }
        const maxRange = parseFloat(cov.maxRange);
        if (isNaN(maxRange) || maxRange <= 0) {
          newErrors[`cov-${idx}-maxRange`] = "Invalid";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (!validateForm()) return;

    const updatedStation = {
      ...station,
      name: formData.name.trim(),
      location: {
        lat: parseFloat(formData.lat),
        lon: parseFloat(formData.lon),
        alt: parseFloat(formData.alt) || 0,
      },
      type: formData.type,
      color: formData.color,
      coverages: formData.coverages,
      showCoverage: formData.coverages.some((c) => c.isVisible),
      antenna: {
        minElevation: formData.coverages[0]?.minElevation || 5,
        maxRange: formData.coverages[0]?.maxRange || 2500,
      },
    };

    updateGroundStation(stationId, updatedStation);
    setHasChanges(false);
  };

  // Handle cancel/close
  const handleCancel = () => {
    removeTab(`gs-${stationId}`);
  };

  if (!station) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Station not found</div>;
  }

  // Get selected coverage index if a coverage is selected
  const getCoverageIndex = () => {
    if (selectedNode.startsWith("coverage.")) {
      return parseInt(selectedNode.split(".")[1]);
    }
    return -1;
  };

  // Check if currently in Basic section
  const isBasicSection = selectedNode === "basic" || selectedNode.startsWith("basic.");

  // Render Basic form (all fields in one view)
  const renderBasicForm = () => {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-4">
          <Settings className="w-4 h-4 text-orange-400" />
          Basic Properties
        </h3>

        {/* Station Name & Type */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <Radio className="w-3.5 h-3.5 text-orange-400" />
            Station Name
          </div>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter station name"
            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              errors.name ? "border-red-500" : "border-slate-600"
            }`}
          />
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          <div>
            <label className="block text-xs text-slate-500 mb-2">Station Type</label>
            <div className="grid grid-cols-2 gap-2">
              {STATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleChange("type", type.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                    formData.type === type.id
                      ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
                      : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                  }`}
                >
                  <span>{type.icon}</span>
                  <span>{type.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <MapPin className="w-3.5 h-3.5 text-green-400" />
            Location
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Latitude (°)</label>
              <input
                type="number"
                value={formData.lat}
                onChange={(e) => handleChange("lat", e.target.value)}
                placeholder="-90 to 90"
                step="0.0001"
                min="-90"
                max="90"
                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                  errors.lat ? "border-red-500" : "border-slate-600"
                }`}
              />
              {errors.lat && <p className="text-xs text-red-400 mt-1">{errors.lat}</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Longitude (°)</label>
              <input
                type="number"
                value={formData.lon}
                onChange={(e) => handleChange("lon", e.target.value)}
                placeholder="-180 to 180"
                step="0.0001"
                min="-180"
                max="180"
                className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                  errors.lon ? "border-red-500" : "border-slate-600"
                }`}
              />
              {errors.lon && <p className="text-xs text-red-400 mt-1">{errors.lon}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Altitude (m)</label>
            <input
              type="number"
              value={formData.alt}
              onChange={(e) => handleChange("alt", e.target.value)}
              placeholder="0"
              step="1"
              min="0"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
        </div>

        {/* Color */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <Palette className="w-3.5 h-3.5 text-pink-400" />
            Station Color
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_COLORS.map((color, index) => (
              <button
                key={index}
                onClick={() => handleChange("color", color)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  formData.color.name === color.name ? "border-blue-500 bg-blue-600/20 ring-1 ring-blue-500/50" : "border-slate-600 hover:border-slate-500"
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
          <button onClick={handleCancel} className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
              hasChanges
                ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/20"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    );
  };

  // Render form content based on selected node
  const renderFormContent = () => {
    const coverageIndex = getCoverageIndex();

    switch (selectedNode) {
      case "coverages":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                Coverage Areas
              </h3>
              <button
                onClick={addCoverage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Coverage
              </button>
            </div>
            <div className="space-y-2">
              {formData.coverages.map((coverage, index) => (
                <div
                  key={coverage.id}
                  onClick={() => setSelectedNode(`coverage.${index}`)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNode === `coverage.${index}` ? "border-cyan-500/50 bg-cyan-900/20" : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border border-slate-500"
                    style={{
                      backgroundColor: `rgb(${coverage.color.r * 255}, ${coverage.color.g * 255}, ${coverage.color.b * 255})`,
                    }}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-white">{coverage.name}</p>
                    <p className="text-xs text-slate-400">{coverage.type === "satellite" ? "Satellite Mode" : "Manual Mode"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {coverage.isVisible ? <Eye className="w-4 h-4 text-green-400" /> : <Eye className="w-4 h-4 text-slate-600" />}
                    {formData.coverages.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCoverage(index);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save/Cancel for Coverages */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
              {hasChanges && (
                <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Unsaved changes
                </span>
              )}
              <button onClick={handleCancel} className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                  hasChanges
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/20"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        );

      default:
        // Coverage detail editing
        if (coverageIndex >= 0 && coverageIndex < formData.coverages.length) {
          const coverage = formData.coverages[coverageIndex];
          return (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                {coverage.name}
              </h3>

              {/* Coverage Name */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Coverage Name</label>
                <input
                  type="text"
                  value={coverage.name}
                  onChange={(e) => handleCoverageChange(coverageIndex, "name", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Coverage Type */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Coverage Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCoverageChange(coverageIndex, "type", "satellite")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                      coverage.type === "satellite"
                        ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
                        : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <Satellite className="w-4 h-4" />
                    Satellite
                  </button>
                  <button
                    onClick={() => handleCoverageChange(coverageIndex, "type", "manual")}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                      coverage.type === "manual"
                        ? "bg-green-600/30 text-green-300 border border-green-500/50"
                        : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <Circle className="w-4 h-4" />
                    Manual
                  </button>
                </div>
              </div>

              {/* Satellite Selection */}
              {coverage.type === "satellite" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Target Satellite</label>
                  <select
                    value={coverage.satelliteId || ""}
                    onChange={(e) => handleCoverageChange(coverageIndex, "satelliteId", e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      errors[`cov-${coverageIndex}-satellite`] ? "border-red-500" : "border-slate-600"
                    }`}
                  >
                    <option value="">Select satellite...</option>
                    {satellites.map((sat) => (
                      <option key={sat.id} value={sat.id}>
                        {sat.name}
                      </option>
                    ))}
                  </select>
                  {errors[`cov-${coverageIndex}-satellite`] && <p className="text-xs text-red-400 mt-1">Please select a satellite</p>}
                </div>
              )}

              {/* Manual Range Settings */}
              {coverage.type === "manual" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Min Elevation (°)</label>
                    <input
                      type="number"
                      value={coverage.minElevation}
                      onChange={(e) => handleCoverageChange(coverageIndex, "minElevation", e.target.value)}
                      placeholder="5"
                      step="1"
                      min="0"
                      max="90"
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                        errors[`cov-${coverageIndex}-minElevation`] ? "border-red-500" : "border-slate-600"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Range (km)</label>
                    <input
                      type="number"
                      value={coverage.maxRange}
                      onChange={(e) => handleCoverageChange(coverageIndex, "maxRange", e.target.value)}
                      placeholder="2500"
                      step="100"
                      min="0"
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                        errors[`cov-${coverageIndex}-maxRange`] ? "border-red-500" : "border-slate-600"
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Color Selection */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">Coverage Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((color, colorIdx) => (
                    <button
                      key={colorIdx}
                      onClick={() => handleCoverageChange(coverageIndex, "color", color)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
                        coverage.color.name === color.name ? "border-cyan-500 bg-cyan-600/20 ring-1 ring-cyan-500/50" : "border-slate-600 hover:border-slate-500"
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

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <span className="text-sm text-slate-300">Show Coverage</span>
                <button
                  onClick={() => handleCoverageChange(coverageIndex, "isVisible", !coverage.isVisible)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${coverage.isVisible ? "bg-cyan-500" : "bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${coverage.isVisible ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Save/Cancel for Coverage Detail */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-700">
                {hasChanges && (
                  <span className="text-xs text-amber-400 flex items-center gap-1 mr-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Unsaved changes
                  </span>
                )}
                <button onClick={handleCancel} className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-all font-medium ${
                    hasChanges
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/20"
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

        // Default: Show station overview
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              Station Overview
            </h3>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: `rgb(${formData.color.r * 255}, ${formData.color.g * 255}, ${formData.color.b * 255})`,
                  }}
                >
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">{formData.name || "Unnamed Station"}</p>
                  <p className="text-xs text-slate-400">{STATION_TYPES.find((t) => t.id === formData.type)?.name || "Ground Station"}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Latitude</p>
                  <p className="text-sm text-white">{formData.lat || "-"}°</p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Longitude</p>
                  <p className="text-sm text-white">{formData.lon || "-"}°</p>
                </div>
                <div className="p-2 bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-500">Altitude</p>
                  <p className="text-sm text-white">{formData.alt || "0"} m</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {formData.coverages.length} coverage area{formData.coverages.length !== 1 ? "s" : ""} configured
              </p>
            </div>
            <p className="text-xs text-slate-500 text-center">Select an item from the tree to edit properties</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
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
              <TreeItem icon={Radio} label="Station Name" isSelected={selectedNode === "basic.name"} onClick={() => setSelectedNode("basic.name")} level={1} />
              <TreeItem icon={MapPin} label="Location" isSelected={selectedNode === "basic.location"} onClick={() => setSelectedNode("basic.location")} level={1} />
              <TreeItem icon={Palette} label="Color" isSelected={selectedNode === "basic.color"} onClick={() => setSelectedNode("basic.color")} level={1} />
            </>
          )}

          {/* Coverage Areas */}
          <TreeItem
            icon={Target}
            label={`Coverages (${formData.coverages.length})`}
            isSelected={selectedNode === "coverages"}
            isExpanded={expandedNodes.coverages}
            hasChildren={true}
            onClick={() => setSelectedNode("coverages")}
            onToggle={() => toggleNode("coverages")}
          />
          {expandedNodes.coverages &&
            formData.coverages.map((coverage, index) => (
              <TreeItem
                key={coverage.id}
                icon={Circle}
                label={coverage.name}
                isSelected={selectedNode === `coverage.${index}`}
                onClick={() => setSelectedNode(`coverage.${index}`)}
                level={1}
              />
            ))}

          {/* Access Analysis */}
          <div className="mt-2 border-t border-slate-700 pt-2">
            <TreeItem icon={Eye} label="Access" isSelected={selectedNode === "access"} onClick={() => setSelectedNode("access")} />
          </div>
        </div>

        {/* Right Column - Form Input */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedNode === "access" ? (
            <div className="h-full flex flex-col">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-purple-400" />
                Access Analysis
              </h3>

              {/* 2 Column Layout: Results (3/4) | Form (1/4) */}
              <div className="flex-1 flex gap-4 min-h-0">
                {/* Left Column - Results (3/4 width) */}
                <div className="flex-[3] overflow-y-auto pr-2">
                  {/* Results Table */}
                  {accessResults.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-slate-300">Pass Predictions ({accessResults.length} passes found)</h4>
                        {/* Export Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={exportToClipboard}
                            title="Copy to Clipboard"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={exportToCSV} title="Export CSV" className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded transition-colors">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={exportToTXT} title="Export TXT" className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* TLE Info Summary */}
                      <div className="text-xs text-slate-500 p-2 bg-slate-800/30 rounded border border-slate-700/50">
                        <span className="text-slate-400">TLE Epoch used: </span>
                        <span className="font-mono text-slate-300">
                          {selectedHistoryEpoch ? selectedHistoryEpoch.toISOString() : currentTleEpoch ? currentTleEpoch.toISOString() : "N/A"}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-2 text-slate-400 font-medium w-6"></th>
                              <th className="text-left py-2 px-2 text-slate-400 font-medium">#</th>
                              <th className="text-left py-2 px-2 text-slate-400 font-medium">AOS Time</th>
                              <th className="text-center py-2 px-2 text-slate-400 font-medium">AOS Az</th>
                              <th className="text-left py-2 px-2 text-slate-400 font-medium">Max El Time</th>
                              <th className="text-center py-2 px-2 text-slate-400 font-medium">Max El</th>
                              <th className="text-left py-2 px-2 text-slate-400 font-medium">LOS Time</th>
                              <th className="text-center py-2 px-2 text-slate-400 font-medium">LOS Az</th>
                              <th className="text-center py-2 px-2 text-slate-400 font-medium">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accessResults.map((pass, index) => (
                              <React.Fragment key={index}>
                                {/* Main Pass Row */}
                                <tr
                                  onClick={() => togglePassExpansion(index, pass)}
                                  className={`border-b border-slate-800 cursor-pointer transition-colors ${expandedPasses[index] ? "bg-slate-800/70" : "hover:bg-slate-800/50"} ${
                                    pass.maxElevation?.elevation >= 45 ? "text-green-300" : pass.maxElevation?.elevation >= 20 ? "text-yellow-300" : "text-slate-300"
                                  }`}
                                >
                                  <td className="py-2 px-2">
                                    {expandedPasses[index] ? <ChevronDown className="w-3.5 h-3.5 text-purple-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                  </td>
                                  <td className="py-2 px-2">{index + 1}</td>
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    {new Date(pass.aos.time).toLocaleString("id-ID", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2 px-2 text-center">{pass.aos.azimuth.toFixed(1)}°</td>
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    {new Date(pass.maxElevation.time).toLocaleString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2 px-2 text-center font-medium">{pass.maxElevation.elevation.toFixed(1)}°</td>
                                  <td className="py-2 px-2 whitespace-nowrap">
                                    {new Date(pass.los.time).toLocaleString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                    {pass.los.partial && <span className="text-amber-400 ml-1">*</span>}
                                  </td>
                                  <td className="py-2 px-2 text-center">{pass.los.azimuth.toFixed(1)}°</td>
                                  <td className="py-2 px-2 text-center">
                                    {Math.floor(pass.duration / 60)}m {Math.floor(pass.duration % 60)}s
                                  </td>
                                </tr>

                                {/* Expanded Pass Details */}
                                {expandedPasses[index] && (
                                  <tr>
                                    <td colSpan={9} className="p-0">
                                      <div className="bg-slate-900/50 border-l-2 border-purple-500 mx-2 mb-2 rounded">
                                        <div className="px-3 py-2 border-b border-slate-700/50">
                                          <span className="text-xs font-medium text-purple-300">Pass #{index + 1} Details (5 Waypoints)</span>
                                        </div>
                                        <div className="p-2">
                                          {passDetails[index] ? (
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-slate-500">
                                                  <th className="text-left py-1 px-2">Point</th>
                                                  <th className="text-left py-1 px-2">Time (UTC)</th>
                                                  <th className="text-center py-1 px-2">Azimuth</th>
                                                  <th className="text-center py-1 px-2">Elevation</th>
                                                  <th className="text-center py-1 px-2">Range (km)</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {passDetails[index].map((detail, di) => (
                                                  <tr
                                                    key={di}
                                                    className={`border-t border-slate-800/50 ${detail.label === "Max El" ? "text-green-300 font-medium" : "text-slate-300"}`}
                                                  >
                                                    <td className="py-1.5 px-2">
                                                      <span
                                                        className={`inline-flex items-center gap-1 ${
                                                          detail.label === "AOS"
                                                            ? "text-blue-400"
                                                            : detail.label === "LOS"
                                                            ? "text-red-400"
                                                            : detail.label === "Max El"
                                                            ? "text-green-400"
                                                            : "text-slate-400"
                                                        }`}
                                                      >
                                                        {detail.label === "AOS" && "↗"}
                                                        {detail.label === "1/2 Rise" && "⬆"}
                                                        {detail.label === "Max El" && "◆"}
                                                        {detail.label === "1/2 Set" && "⬇"}
                                                        {detail.label === "LOS" && "↘"}
                                                        {detail.label}
                                                      </span>
                                                    </td>
                                                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">
                                                      {new Date(detail.time).toLocaleString("id-ID", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        second: "2-digit",
                                                      })}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">{detail.azimuth.toFixed(2)}°</td>
                                                    <td className="py-1.5 px-2 text-center">{detail.elevation.toFixed(2)}°</td>
                                                    <td className="py-1.5 px-2 text-center">{detail.range.toFixed(1)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          ) : (
                                            <div className="flex items-center justify-center py-4 text-slate-500">
                                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                              Loading details...
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-400" /> Max El ≥ 45°
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-400" /> Max El ≥ 20°
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400" /> Max El &lt; 20°
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 italic">Click row to expand details</p>
                      </div>
                    </div>
                  ) : (
                    /* Empty State */
                    <div className="h-full flex items-center justify-center">
                      <div className="p-6 bg-slate-800/30 rounded-lg border border-slate-700/50 text-center max-w-sm">
                        <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400 mb-1">No Pass Results</p>
                        <p className="text-xs text-slate-500">
                          {accessConfig.satelliteId
                            ? 'Configure the parameters and click "Calculate Access" to find satellite passes.'
                            : "Select a satellite from the form on the right to get started."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Form (1/4 width) */}
                <div className="flex-1 min-w-[280px] max-w-[320px] border-l border-slate-700 pl-4 overflow-y-auto">
                  <div className="space-y-4">
                    {/* Satellite Selection */}
                    <div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-2">
                        <Satellite className="w-3.5 h-3.5 text-blue-400" />
                        Target Satellite
                      </label>
                      <select
                        value={accessConfig.satelliteId}
                        onChange={(e) =>
                          setAccessConfig((prev) => ({
                            ...prev,
                            satelliteId: e.target.value,
                            selectedTleIndex: -1,
                          }))
                        }
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="">Select satellite...</option>
                        {satellites.map((sat) => (
                          <option key={sat.id} value={sat.id}>
                            {sat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* TLE Epoch Info & History Selection */}
                    {selectedSatellite && (
                      <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          TLE / Orbit Element
                        </div>

                        {/* Current TLE Epoch */}
                        <div className="text-xs">
                          <span className="text-slate-500">Epoch: </span>
                          <span className="text-white font-mono">
                            {currentTleEpoch
                              ? currentTleEpoch.toLocaleString("id-ID", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </span>
                        </div>

                        {/* TLE History Dropdown */}
                        {selectedSatellite.tleHistory?.length > 0 && (
                          <div>
                            <div className="relative">
                              <select
                                value={accessConfig.selectedTleIndex}
                                onChange={(e) =>
                                  setAccessConfig((prev) => ({
                                    ...prev,
                                    selectedTleIndex: parseInt(e.target.value),
                                  }))
                                }
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer"
                              >
                                <option value={-1}>Current TLE</option>
                                {selectedSatellite.tleHistory.map((tle, idx) => {
                                  const epoch = parseTleEpoch(tle.line1);
                                  const epochStr = epoch
                                    ? epoch.toLocaleString("id-ID", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : `TLE #${idx + 1}`;
                                  return (
                                    <option key={idx} value={idx}>
                                      📅 {epochStr}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        )}

                        {/* Show selected historical TLE */}
                        {accessConfig.selectedTleIndex >= 0 && selectedHistoryEpoch && (
                          <div className="text-xs p-1.5 bg-amber-900/20 rounded border border-amber-700/30 text-amber-300">Using historical TLE</div>
                        )}
                      </div>
                    )}

                    {/* Time Period */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-green-400" />
                        Time Period
                      </label>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Start (dd/mm/yyyy)</label>
                          <input
                            type="datetime-local"
                            value={accessConfig.startDate}
                            onChange={(e) => setAccessConfig((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">End (dd/mm/yyyy)</label>
                          <input
                            type="datetime-local"
                            value={accessConfig.endDate}
                            onChange={(e) => setAccessConfig((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Min Elevation */}
                    <div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-2">
                        <Target className="w-3.5 h-3.5 text-orange-400" />
                        Min Elevation (°)
                      </label>
                      <input
                        type="number"
                        value={accessConfig.minElevation}
                        onChange={(e) => setAccessConfig((prev) => ({ ...prev, minElevation: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        max="90"
                        step="1"
                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>

                    {/* Calculate Button */}
                    <button
                      onClick={calculateAccess}
                      disabled={!accessConfig.satelliteId || !accessConfig.startDate || !accessConfig.endDate || isCalculating}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        accessConfig.satelliteId && accessConfig.startDate && accessConfig.endDate && !isCalculating
                          ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-400 hover:to-purple-500 shadow-lg shadow-purple-500/20"
                          : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      {isCalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Calculate
                        </>
                      )}
                    </button>

                    {/* Ground Station Info */}
                    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <Radio className="w-3.5 h-3.5 text-orange-400" />
                        Ground Station
                      </div>
                      <p className="text-sm text-white">{station?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-500">
                        {station?.location?.lat?.toFixed(4)}°, {station?.location?.lon?.toFixed(4)}°
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isBasicSection ? (
            renderBasicForm()
          ) : (
            renderFormContent()
          )}
        </div>
      </div>
    </div>
  );
};

export default GroundStationPropertiesTab;
