/**
 * SatellitePropertiesTab Component
 * Tab content for viewing/editing satellite properties
 */

import React, { useState, useEffect } from "react";
import { Satellite, Palette, Orbit, Camera, Radio, Plus, Trash2, ChevronDown, ChevronUp, Save, Eye, EyeOff, RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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

// Camera types
const CAMERA_TYPES = [
  { id: "rgb", name: "Digital RGB" },
  { id: "multispectral", name: "Multispectral" },
  { id: "sar", name: "SAR" },
];

// Axis options
const AXIS_OPTIONS = [
  { id: "+x", name: "+X" },
  { id: "-x", name: "-X" },
  { id: "+y", name: "+Y" },
  { id: "-y", name: "-Y" },
  { id: "+z", name: "+Z (Nadir)" },
  { id: "-z", name: "-Z (Zenith)" },
];

const SatellitePropertiesTab = ({ satelliteId }) => {
  // Get satellite from store
  const satellite = useSatelliteStore((state) => state.satellites.find((sat) => sat.id === satelliteId));
  const updateSatellite = useSatelliteStore((state) => state.updateSatellite);
  const positions = useSatelliteStore((state) => state.positions);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    noradId: "",
    color: PRESET_COLORS[0],
    showCoverage: true,
    payloads: [],
    tleLine1: "",
    tleLine2: "",
  });

  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedSection, setExpandedSection] = useState("basic");
  const [loading, setLoading] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState(null);

  // Current position
  const currentPosition = positions[satelliteId];

  // Initialize form when satellite changes
  useEffect(() => {
    if (satellite) {
      setFormData({
        name: satellite.name || "",
        noradId: satellite.noradId || "",
        color: satellite.color || PRESET_COLORS[0],
        showCoverage: satellite.showCoverage !== false,
        payloads: satellite.payloads || [],
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

  // Add new payload
  const addPayload = (type) => {
    const newPayload = {
      id: `payload-${Date.now()}`,
      name: type === "camera" ? `Camera ${formData.payloads.length + 1}` : `AIS ${formData.payloads.length + 1}`,
      type,
      cameraType: type === "camera" ? "rgb" : undefined,
      axis: "+z",
      fov: type === "camera" ? 30 : undefined,
      frequency: type === "ais" ? 162.0 : undefined,
      antennaAxis: type === "ais" ? "+z" : undefined,
    };
    setFormData((prev) => ({
      ...prev,
      payloads: [...prev.payloads, newPayload],
    }));
    setHasChanges(true);
  };

  // Update payload
  const updatePayload = (payloadId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      payloads: prev.payloads.map((p) => (p.id === payloadId ? { ...p, [field]: value } : p)),
    }));
    setHasChanges(true);
  };

  // Remove payload
  const removePayload = (payloadId) => {
    setFormData((prev) => ({
      ...prev,
      payloads: prev.payloads.filter((p) => p.id !== payloadId),
    }));
    setHasChanges(true);
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
    if (!validateForm()) return;

    const satelliteData = {
      name: formData.name.trim(),
      noradId: formData.noradId,
      color: formData.color,
      showCoverage: formData.showCoverage,
      payloads: formData.payloads,
      tle: {
        line1: formData.tleLine1.trim(),
        line2: formData.tleLine2.trim(),
      },
    };

    updateSatellite(satelliteId, satelliteData);
    setHasChanges(false);
  };

  if (!satellite) {
    return <div className="p-4 text-center text-slate-400">Satellite not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Current Position Display */}
        {currentPosition && (
          <div className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">Current Position</span>
              <span className="text-xs text-cyan-400">{currentPosition.altitude?.toFixed(1)} km</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>Lat: {currentPosition.latitude?.toFixed(4)}°</div>
              <div>Lon: {currentPosition.longitude?.toFixed(4)}°</div>
              <div>Vel: {currentPosition.velocity?.toFixed(2)} km/s</div>
              <div>Inc: {satellite.tle ? "—" : "—"}</div>
            </div>
          </div>
        )}

        {/* Basic Info Section */}
        <div className="space-y-2">
          <button
            onClick={() => setExpandedSection(expandedSection === "basic" ? "" : "basic")}
            className="flex items-center justify-between w-full text-xs font-medium text-slate-300 py-1"
          >
            <div className="flex items-center gap-2">
              <Satellite className="w-3.5 h-3.5" />
              Basic Information
            </div>
            {expandedSection === "basic" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expandedSection === "basic" && (
            <div className="space-y-2 pl-5">
              {/* Name */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`w-full px-2 py-1.5 bg-slate-800 border rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                    errors.name ? "border-red-500" : "border-slate-600"
                  }`}
                />
              </div>

              {/* NORAD ID */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">NORAD ID</label>
                <input
                  type="text"
                  value={formData.noradId}
                  onChange={(e) => handleChange("noradId", e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Color */}
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-xs text-slate-500">Color</span>
                <div className="flex-1 flex gap-1 justify-end">
                  {PRESET_COLORS.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => handleChange("color", color)}
                      className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                        formData.color.name === color.name ? "border-white scale-110 ring-2 ring-white/30" : "border-slate-600/50"
                      }`}
                      style={{
                        backgroundColor: `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Show Coverage Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  {formData.showCoverage ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  Show Coverage
                </span>
                <button
                  onClick={() => handleChange("showCoverage", !formData.showCoverage)}
                  className={`relative w-7 h-3.5 rounded-full transition-colors ${formData.showCoverage ? "bg-cyan-500" : "bg-slate-600"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${formData.showCoverage ? "translate-x-3.5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Orbit Elements Section */}
        <div className="space-y-2">
          <button
            onClick={() => setExpandedSection(expandedSection === "orbit" ? "" : "orbit")}
            className="flex items-center justify-between w-full text-xs font-medium text-slate-300 py-1"
          >
            <div className="flex items-center gap-2">
              <Orbit className="w-3.5 h-3.5" />
              Orbit Elements ({formData.orbitSource === "keplerian" ? "Keplerian" : "TLE"})
            </div>
            {expandedSection === "orbit" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expandedSection === "orbit" && (
            <div className="space-y-2 pl-5">
              {/* Refresh TLE Button */}
              {satellite.tleUrl && (
                <button
                  onClick={refreshTLE}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh TLE
                </button>
              )}

              {refreshStatus && (
                <div className={`flex items-center gap-1.5 text-xs ${refreshStatus.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {refreshStatus.type === "success" ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {refreshStatus.message}
                </div>
              )}

              {/* TLE Line 1 */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">TLE Line 1</label>
                <input
                  type="text"
                  value={formData.tleLine1}
                  onChange={(e) => handleChange("tleLine1", e.target.value)}
                  className={`w-full px-2 py-1.5 bg-slate-800 border rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                    errors.tleLine1 ? "border-red-500" : "border-slate-600"
                  }`}
                />
              </div>

              {/* TLE Line 2 */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">TLE Line 2</label>
                <input
                  type="text"
                  value={formData.tleLine2}
                  onChange={(e) => handleChange("tleLine2", e.target.value)}
                  className={`w-full px-2 py-1.5 bg-slate-800 border rounded-lg text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                    errors.tleLine2 ? "border-red-500" : "border-slate-600"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Payloads Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpandedSection(expandedSection === "payloads" ? "" : "payloads")}
              className="flex items-center gap-2 text-xs font-medium text-slate-300 py-1"
            >
              <Camera className="w-3.5 h-3.5" />
              Payloads
              <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">{formData.payloads.length}</span>
              {expandedSection === "payloads" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expandedSection === "payloads" && (
              <div className="flex gap-1">
                <button
                  onClick={() => addPayload("camera")}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30"
                  title="Add Camera"
                >
                  <Camera className="w-3 h-3" />
                </button>
                <button
                  onClick={() => addPayload("ais")}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
                  title="Add AIS"
                >
                  <Radio className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {expandedSection === "payloads" && (
            <div className="space-y-1.5 pl-5">
              {formData.payloads.length === 0 ? (
                <p className="text-xs text-slate-500">No payloads configured</p>
              ) : (
                formData.payloads.map((payload) => (
                  <div key={payload.id} className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {payload.type === "camera" ? <Camera className="w-3 h-3 text-blue-400" /> : <Radio className="w-3 h-3 text-green-400" />}
                        <input
                          type="text"
                          value={payload.name}
                          onChange={(e) => updatePayload(payload.id, "name", e.target.value)}
                          className="bg-transparent text-xs text-white border-none focus:outline-none"
                        />
                      </div>
                      <button onClick={() => removePayload(payload.id)} className="p-0.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {payload.type === "camera" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Type</label>
                          <select
                            value={payload.cameraType}
                            onChange={(e) => updatePayload(payload.id, "cameraType", e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                          >
                            {CAMERA_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Axis</label>
                          <select
                            value={payload.axis}
                            onChange={(e) => updatePayload(payload.id, "axis", e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                          >
                            {AXIS_OPTIONS.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {payload.type === "ais" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Freq (MHz)</label>
                          <input
                            type="number"
                            value={payload.frequency}
                            onChange={(e) => updatePayload(payload.id, "frequency", parseFloat(e.target.value))}
                            className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Axis</label>
                          <select
                            value={payload.antennaAxis}
                            onChange={(e) => updatePayload(payload.id, "antennaAxis", e.target.value)}
                            className="w-full px-1.5 py-1 bg-slate-700 border border-slate-600 rounded text-white text-xs"
                          >
                            {AXIS_OPTIONS.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Save Button */}
      {hasChanges && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/90 flex items-center justify-between">
          <p className="text-xs text-amber-400">Unsaved changes</p>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all font-medium shadow-lg shadow-cyan-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default SatellitePropertiesTab;
