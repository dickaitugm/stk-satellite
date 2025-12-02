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
} from "lucide-react";
import { useSatelliteStore } from "../../stores";

// Preset colors for satellites
const PRESET_COLORS = [
  { name: "Cyan", r: 0, g: 1, b: 1 },
  { name: "Green", r: 0.2, g: 0.8, b: 0.2 },
  { name: "Yellow", r: 1, g: 0.9, b: 0.2 },
  { name: "Orange", r: 1, g: 0.5, b: 0 },
  { name: "Red", r: 1, g: 0.2, b: 0.2 },
  { name: "Purple", r: 0.7, g: 0.3, b: 0.9 },
  { name: "Blue", r: 0.2, g: 0.5, b: 1 },
  { name: "Pink", r: 1, g: 0.4, b: 0.7 },
  { name: "White", r: 1, g: 1, b: 1 },
];

// Axis options for object orientation
const AXIS_OPTIONS = [
  { id: "+x", name: "+X" },
  { id: "-x", name: "-X" },
  { id: "+y", name: "+Y" },
  { id: "-y", name: "-Y" },
  { id: "+z", name: "+Z (Nadir)" },
  { id: "-z", name: "-Z (Zenith)" },
];

// Default object configuration
const createDefaultObject = () => ({
  id: `obj-${Date.now()}`,
  name: "Object 1",
  type: "sensor", // general sensor type
  axis: "+z",
  // Scanning parameters
  scanWidth: 100, // km - swath width on ground
  scanLength: 0, // km - length of scan (0 = continuous)
  scanAngle: 0, // degrees - off-nadir angle
  // Field of view
  fovCrossTrack: 30, // degrees - cross-track FOV
  fovAlongTrack: 30, // degrees - along-track FOV
  // Visual settings
  color: PRESET_COLORS[0],
  isVisible: true,
  showSwath: true, // Show scanning width on ground
  showLabel: true,
  labelSize: 10,
  // Custom parameters (for user-defined properties)
  customParams: {},
});

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
    showCoverage: true,
    objects: [],
    tleLine1: "",
    tleLine2: "",
    orbitSource: "tle-manual",
  });

  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState(null);

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
      setFormData({
        name: satellite.name || "",
        noradId: satellite.noradId || "",
        color: satellite.color || PRESET_COLORS[0],
        showCoverage: satellite.showCoverage !== false,
        objects: satellite.objects || [],
        tleLine1: satellite.tle?.line1 || "",
        tleLine2: satellite.tle?.line2 || "",
        orbitSource: satellite.orbitSource || "tle-manual",
      });
      setHasChanges(false);
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

  // Add new object
  const addObject = () => {
    const newObject = createDefaultObject();
    newObject.name = `Object ${formData.objects.length + 1}`;
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

  // Refresh TLE from source
  const refreshTLE = async () => {
    if (!satellite.tleUrl) {
      setRefreshStatus({ type: "error", message: "No TLE URL configured" });
      return;
    }

    setLoading(true);
    setRefreshStatus(null);

    try {
      if (window.electronAPI?.fetchTLE) {
        const result = await window.electronAPI.fetchTLE(satellite.tleUrl);
        if (!result.success) {
          throw new Error(result.error);
        }

        const lines = result.data
          .split("\n")
          .map((l) => l.trimEnd())
          .filter((l) => l.trim());

        // Find TLE for this satellite
        const searchName = formData.name.trim().toUpperCase();
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

            if (line2.startsWith("2 ") && (name.toUpperCase().includes(searchName) || searchName.includes(name.toUpperCase().replace(/\s+/g, "")))) {
              setFormData((prev) => ({
                ...prev,
                tleLine1: line1,
                tleLine2: line2,
              }));
              setHasChanges(true);
              setRefreshStatus({ type: "success", message: "TLE updated" });
              setLoading(false);
              return;
            }
          }
        }
        throw new Error("Satellite not found in TLE source");
      } else {
        throw new Error("TLE fetch not available");
      }
    } catch (error) {
      setRefreshStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.tleLine1.trim()) {
      newErrors.tleLine1 = "TLE Line 1 is required";
    }

    if (!formData.tleLine2.trim()) {
      newErrors.tleLine2 = "TLE Line 2 is required";
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

    const satelliteData = {
      name: formData.name.trim(),
      noradId: formData.noradId,
      color: formData.color,
      showCoverage: formData.showCoverage,
      objects: formData.objects,
      tle: {
        line1: formData.tleLine1.trim(),
        line2: formData.tleLine2.trim(),
      },
    };

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

          {/* Show Coverage Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <span className="text-sm text-slate-300 flex items-center gap-2">
              {formData.showCoverage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Show Coverage Area
            </span>
            <button
              onClick={() => handleChange("showCoverage", !formData.showCoverage)}
              className={`relative w-10 h-5 rounded-full transition-colors ${formData.showCoverage ? "bg-cyan-500" : "bg-slate-600"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${formData.showCoverage ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
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

          {/* Show Coverage Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <span className="text-sm text-slate-300 flex items-center gap-2">
              {formData.showCoverage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Show Coverage Area
            </span>
            <button
              onClick={() => handleChange("showCoverage", !formData.showCoverage)}
              className={`relative w-10 h-5 rounded-full transition-colors ${formData.showCoverage ? "bg-cyan-500" : "bg-slate-600"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${formData.showCoverage ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
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
            Orbit Elements (TLE)
          </h3>

          {/* Refresh TLE Button */}
          {satellite.tleUrl && (
            <button
              onClick={refreshTLE}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors disabled:opacity-50 w-full justify-center border border-cyan-500/30"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh TLE from Source
            </button>
          )}

          {refreshStatus && (
            <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${refreshStatus.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {refreshStatus.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {refreshStatus.message}
            </div>
          )}

          {/* TLE Line 1 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">TLE Line 1</label>
            <input
              type="text"
              value={formData.tleLine1}
              onChange={(e) => handleChange("tleLine1", e.target.value)}
              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                errors.tleLine1 ? "border-red-500" : "border-slate-600"
              }`}
              placeholder="1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN..."
            />
            {errors.tleLine1 && <p className="text-xs text-red-400 mt-1">{errors.tleLine1}</p>}
          </div>

          {/* TLE Line 2 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">TLE Line 2</label>
            <input
              type="text"
              value={formData.tleLine2}
              onChange={(e) => handleChange("tleLine2", e.target.value)}
              className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                errors.tleLine2 ? "border-red-500" : "border-slate-600"
              }`}
              placeholder="2 NNNNN NNN.NNNN NNN.NNNN..."
            />
            {errors.tleLine2 && <p className="text-xs text-red-400 mt-1">{errors.tleLine2}</p>}
          </div>

          {/* Orbit Info Display */}
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
      return (
        <div className="space-y-4">
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

          <div className="space-y-2">
            {formData.objects.length === 0 ? (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                <p className="text-sm text-slate-400">No objects configured</p>
                <p className="text-xs text-slate-500 mt-1">Add sensor objects to define scanning areas</p>
              </div>
            ) : (
              formData.objects.map((obj) => (
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
              Scanning Parameters
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Swath Width (km)</label>
                <input
                  type="number"
                  value={selectedObject.scanWidth}
                  onChange={(e) => updateObject(selectedObject.id, "scanWidth", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  min="0"
                  step="10"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Off-Nadir Angle (°)</label>
                <input
                  type="number"
                  value={selectedObject.scanAngle}
                  onChange={(e) => updateObject(selectedObject.id, "scanAngle", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  min="-60"
                  max="60"
                  step="1"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">Swath width defines the ground coverage. Off-nadir tilts the sensor from vertical.</p>
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
                icon={Box}
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
