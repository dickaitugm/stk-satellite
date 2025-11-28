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
} from "lucide-react";
import { useGroundStationStore, useSatelliteStore, useTabsStore, useTimeStore } from "../../stores";
import { calculateSatellitePasses } from "../../services/satelliteCalculator";

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
  });
  const [accessResults, setAccessResults] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);

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

    setIsCalculating(true);
    setAccessResults([]);

    // Run calculation (could be async in future)
    setTimeout(() => {
      try {
        const startTimestamp = new Date(accessConfig.startDate).getTime();
        const endTimestamp = new Date(accessConfig.endDate).getTime();

        const passes = calculateSatellitePasses(
          selectedSat.tle,
          {
            lat: station.location.lat,
            lon: station.location.lon,
            alt: station.location.alt || 0,
          },
          startTimestamp,
          endTimestamp,
          accessConfig.minElevation
        );

        setAccessResults(passes);
      } catch (error) {
        console.error("Error calculating access:", error);
        setAccessResults([]);
      } finally {
        setIsCalculating(false);
      }
    }, 100);
  }, [accessConfig, satellites, station]);

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
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
                <Eye className="w-4 h-4 text-purple-400" />
                Access Analysis
              </h3>

              {/* Access Configuration Form */}
              <div className="space-y-4">
                {/* Satellite Selection */}
                <div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-2">
                    <Satellite className="w-3.5 h-3.5 text-blue-400" />
                    Target Satellite
                  </label>
                  <select
                    value={accessConfig.satelliteId}
                    onChange={(e) => setAccessConfig((prev) => ({ ...prev, satelliteId: e.target.value }))}
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

                {/* Time Period */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-green-400" />
                    Time Period
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Start</label>
                      <input
                        type="datetime-local"
                        value={accessConfig.startDate}
                        onChange={(e) => setAccessConfig((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">End</label>
                      <input
                        type="datetime-local"
                        value={accessConfig.endDate}
                        onChange={(e) => setAccessConfig((prev) => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Min Elevation */}
                <div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 font-medium mb-2">
                    <Target className="w-3.5 h-3.5 text-orange-400" />
                    Minimum Elevation (°)
                  </label>
                  <input
                    type="number"
                    value={accessConfig.minElevation}
                    onChange={(e) => setAccessConfig((prev) => ({ ...prev, minElevation: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="90"
                    step="1"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
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
                      Calculate Access
                    </>
                  )}
                </button>
              </div>

              {/* Results Table */}
              {accessResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-slate-300">Pass Predictions ({accessResults.length} passes found)</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
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
                          <tr
                            key={index}
                            className={`border-b border-slate-800 hover:bg-slate-800/50 ${
                              pass.maxElevation?.elevation >= 45 ? "text-green-300" : pass.maxElevation?.elevation >= 20 ? "text-yellow-300" : "text-slate-300"
                            }`}
                          >
                            <td className="py-2 px-2">{index + 1}</td>
                            <td className="py-2 px-2 whitespace-nowrap">
                              {new Date(pass.aos.time).toLocaleString("id-ID", {
                                month: "short",
                                day: "2-digit",
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
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                </div>
              )}

              {/* Empty State */}
              {!isCalculating && accessResults.length === 0 && accessConfig.satelliteId && (
                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50 text-center">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No passes calculated yet. Click "Calculate Access" to find satellite passes.</p>
                </div>
              )}
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
