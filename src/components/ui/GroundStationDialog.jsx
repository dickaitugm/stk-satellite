/**
 * GroundStationDialog Component
 * Modal dialog for adding/editing ground stations with multi-coverage support
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    X,
    MapPin,
    Radio,
    Palette,
    Target,
    Plus,
    Trash2,
    Satellite,
    Circle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useSatelliteStore } from "../../stores";

// Preset colors for ground stations
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
const createDefaultCoverage = (satellites = []) => ({
    id: `cov-${Date.now()}`,
    name: "Coverage 1",
    type: "manual", // 'satellite' or 'manual'
    satelliteId: satellites[0]?.id || null,
    minElevation: 5,
    maxRange: 2500,
    color: PRESET_COLORS[0],
    isVisible: true,
});

const GroundStationDialog = ({
    isOpen,
    onClose,
    onSave,
    editStation = null,
    title = "Add Ground Station",
}) => {
    // Get satellites from store
    const satellites = useSatelliteStore((state) => state.satellites);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        lat: "",
        lon: "",
        alt: "0",
        type: "tracking",
        color: PRESET_COLORS[0],
        coverages: [createDefaultCoverage(satellites)],
    });

    const [errors, setErrors] = useState({});
    const [expandedCoverage, setExpandedCoverage] = useState(0);

    // Initialize form when editing
    useEffect(() => {
        if (editStation) {
            // Convert old format to new format if needed
            const coverages = editStation.coverages || [
                {
                    id: "cov-default",
                    name: "Default Coverage",
                    type: "manual",
                    satelliteId: null,
                    minElevation: editStation.antenna?.minElevation || 5,
                    maxRange: editStation.antenna?.maxRange || 2500,
                    color: editStation.color || PRESET_COLORS[0],
                    isVisible: editStation.showCoverage !== false,
                },
            ];

            setFormData({
                name: editStation.name || "",
                lat: editStation.location?.lat?.toString() || "",
                lon: editStation.location?.lon?.toString() || "",
                alt: (editStation.location?.alt || 0).toString(),
                type: editStation.type || "tracking",
                color: editStation.color || PRESET_COLORS[0],
                coverages,
            });
        } else {
            setFormData({
                name: "",
                lat: "",
                lon: "",
                alt: "0",
                type: "tracking",
                color: PRESET_COLORS[0],
                coverages: [createDefaultCoverage(satellites)],
            });
        }
        setErrors({});
        setExpandedCoverage(0);
    }, [editStation, isOpen, satellites]);

    // Handle input changes
    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: null }));
        }
    };

    // Handle coverage changes
    const handleCoverageChange = (index, field, value) => {
        setFormData((prev) => ({
            ...prev,
            coverages: prev.coverages.map((cov, i) =>
                i === index ? { ...cov, [field]: value } : cov
            ),
        }));
    };

    // Add new coverage
    const addCoverage = () => {
        const newCoverage = {
            ...createDefaultCoverage(satellites),
            id: `cov-${Date.now()}`,
            name: `Coverage ${formData.coverages.length + 1}`,
            color: PRESET_COLORS[formData.coverages.length % PRESET_COLORS.length],
        };
        setFormData((prev) => ({
            ...prev,
            coverages: [...prev.coverages, newCoverage],
        }));
        setExpandedCoverage(formData.coverages.length);
    };

    // Remove coverage
    const removeCoverage = (index) => {
        if (formData.coverages.length <= 1) return;
        setFormData((prev) => ({
            ...prev,
            coverages: prev.coverages.filter((_, i) => i !== index),
        }));
        if (expandedCoverage >= index && expandedCoverage > 0) {
            setExpandedCoverage(expandedCoverage - 1);
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = "Name is required";
        }

        const lat = parseFloat(formData.lat);
        if (isNaN(lat) || lat < -90 || lat > 90) {
            newErrors.lat = "Invalid latitude (-90 to 90)";
        }

        const lon = parseFloat(formData.lon);
        if (isNaN(lon) || lon < -180 || lon > 180) {
            newErrors.lon = "Invalid longitude (-180 to 180)";
        }

        const alt = parseFloat(formData.alt);
        if (isNaN(alt) || alt < 0) {
            newErrors.alt = "Invalid altitude";
        }

        // Validate coverages
        formData.coverages.forEach((cov, index) => {
            if (cov.type === "manual") {
                const minEl = parseFloat(cov.minElevation);
                if (isNaN(minEl) || minEl < 0 || minEl > 90) {
                    newErrors[`cov-${index}-minElevation`] = "Invalid (0-90)";
                }
                const maxRange = parseFloat(cov.maxRange);
                if (isNaN(maxRange) || maxRange <= 0) {
                    newErrors[`cov-${index}-maxRange`] = "Must be > 0";
                }
            } else if (cov.type === "satellite" && !cov.satelliteId) {
                newErrors[`cov-${index}-satellite`] = "Select a satellite";
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle save
    const handleSave = () => {
        if (!validateForm()) return;

        const stationData = {
            id: editStation?.id || `gs-${Date.now()}`,
            name: formData.name.trim(),
            location: {
                lat: parseFloat(formData.lat),
                lon: parseFloat(formData.lon),
                alt: parseFloat(formData.alt),
            },
            type: formData.type,
            color: { ...formData.color, a: 1 },
            isActive: true,
            isVisible: true,
            coverages: formData.coverages.map((cov) => ({
                ...cov,
                minElevation: parseFloat(cov.minElevation) || 5,
                maxRange: parseFloat(cov.maxRange) || 2500,
                color: { ...cov.color, a: 1 },
            })),
            // Legacy support
            showCoverage: formData.coverages.some((c) => c.isVisible),
            antenna: {
                minElevation: parseFloat(formData.coverages[0]?.minElevation) || 5,
                maxRange: parseFloat(formData.coverages[0]?.maxRange) || 2500,
            },
        };

        onSave(stationData, !!editStation);
        onClose();
    };

    if (!isOpen) return null;

    // Use portal to render dialog at document.body level (outside sidebar)
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog - centered */}
            <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl shadow-2xl border border-slate-600/50 w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/90">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/20 rounded-lg">
                            <Radio className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">{title}</h2>
                            <p className="text-xs text-slate-400">
                                Configure ground station parameters
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                        {/* Station Name & Type Row */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Station Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange("name", e.target.value)}
                                    placeholder="e.g. Jakarta GS"
                                    className={`w-full px-3 py-2.5 bg-slate-900/80 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all ${
                                        errors.name ? "border-red-500" : "border-slate-600"
                                    }`}
                                />
                                {errors.name && (
                                    <p className="text-red-400 text-xs mt-1">{errors.name}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Type
                                </label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => handleChange("type", e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                                >
                                    {STATION_TYPES.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.icon} {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Location Row */}
                        <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <MapPin className="w-4 h-4 text-green-400" />
                                <span className="text-sm font-medium text-slate-300">Location</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        Latitude (°)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.lat}
                                        onChange={(e) => handleChange("lat", e.target.value)}
                                        placeholder="-6.535"
                                        step="0.0001"
                                        className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                                            errors.lat ? "border-red-500" : "border-slate-600"
                                        }`}
                                    />
                                    {errors.lat && (
                                        <p className="text-red-400 text-xs mt-1">{errors.lat}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        Longitude (°)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.lon}
                                        onChange={(e) => handleChange("lon", e.target.value)}
                                        placeholder="106.701"
                                        step="0.0001"
                                        className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                                            errors.lon ? "border-red-500" : "border-slate-600"
                                        }`}
                                    />
                                    {errors.lon && (
                                        <p className="text-red-400 text-xs mt-1">{errors.lon}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">
                                        Altitude (km)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.alt}
                                        onChange={(e) => handleChange("alt", e.target.value)}
                                        placeholder="0.1"
                                        step="0.01"
                                        className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                                            errors.alt ? "border-red-500" : "border-slate-600"
                                        }`}
                                    />
                                    {errors.alt && (
                                        <p className="text-red-400 text-xs mt-1">{errors.alt}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Station Color */}
                        <div className="flex items-center gap-3">
                            <Palette className="w-4 h-4 text-pink-400" />
                            <span className="text-sm font-medium text-slate-300">
                                Station Color
                            </span>
                            <div className="flex-1 flex gap-1.5 justify-end">
                                {PRESET_COLORS.map((color, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleChange("color", color)}
                                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                                            formData.color.name === color.name
                                                ? "border-white scale-110 ring-2 ring-white/30"
                                                : "border-slate-600/50"
                                        }`}
                                        style={{
                                            backgroundColor: `rgb(${color.r * 255}, ${
                                                color.g * 255
                                            }, ${color.b * 255})`,
                                        }}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Coverages Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-medium text-slate-300">
                                    Coverage Areas
                                </span>
                                <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                                    {formData.coverages.length}
                                </span>
                            </div>
                            <button
                                onClick={addCoverage}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Coverage
                            </button>
                        </div>

                        {/* Coverage List */}
                        <div className="space-y-2">
                            {formData.coverages.map((coverage, index) => (
                                <div
                                    key={coverage.id}
                                    className={`border rounded-lg overflow-hidden transition-all ${
                                        expandedCoverage === index
                                            ? "border-cyan-500/50 bg-slate-800/50"
                                            : "border-slate-700 bg-slate-900/30"
                                    }`}
                                >
                                    {/* Coverage Header */}
                                    <div
                                        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-700/30"
                                        onClick={() =>
                                            setExpandedCoverage(
                                                expandedCoverage === index ? -1 : index
                                            )
                                        }
                                    >
                                        <div
                                            className="w-3 h-3 rounded-full border border-slate-500"
                                            style={{
                                                backgroundColor: `rgb(${coverage.color.r * 255}, ${
                                                    coverage.color.g * 255
                                                }, ${coverage.color.b * 255})`,
                                            }}
                                        />
                                        <input
                                            type="text"
                                            value={coverage.name}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleCoverageChange(index, "name", e.target.value);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 bg-transparent text-sm text-white border-none focus:outline-none focus:ring-0"
                                            placeholder="Coverage name"
                                        />
                                        <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                                            {coverage.type === "satellite" ? "Satellite" : "Manual"}
                                        </span>
                                        {formData.coverages.length > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeCoverage(index);
                                                }}
                                                className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {expandedCoverage === index ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        )}
                                    </div>

                                    {/* Coverage Details */}
                                    {expandedCoverage === index && (
                                        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50">
                                            {/* Coverage Type Toggle */}
                                            <div className="flex gap-2 pt-3">
                                                <button
                                                    onClick={() =>
                                                        handleCoverageChange(
                                                            index,
                                                            "type",
                                                            "satellite"
                                                        )
                                                    }
                                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                                        coverage.type === "satellite"
                                                            ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
                                                            : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                                                    }`}
                                                >
                                                    <Satellite className="w-4 h-4" />
                                                    Track Satellite
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleCoverageChange(
                                                            index,
                                                            "type",
                                                            "manual"
                                                        )
                                                    }
                                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                                        coverage.type === "manual"
                                                            ? "bg-green-600/30 text-green-300 border border-green-500/50"
                                                            : "bg-slate-800 text-slate-400 border border-slate-600 hover:border-slate-500"
                                                    }`}
                                                >
                                                    <Circle className="w-4 h-4" />
                                                    Manual Range
                                                </button>
                                            </div>

                                            {/* Satellite Selection */}
                                            {coverage.type === "satellite" && (
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">
                                                        Target Satellite
                                                    </label>
                                                    <select
                                                        value={coverage.satelliteId || ""}
                                                        onChange={(e) =>
                                                            handleCoverageChange(
                                                                index,
                                                                "satelliteId",
                                                                e.target.value
                                                            )
                                                        }
                                                        className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                                                            errors[`cov-${index}-satellite`]
                                                                ? "border-red-500"
                                                                : "border-slate-600"
                                                        }`}
                                                    >
                                                        <option value="">
                                                            Select satellite...
                                                        </option>
                                                        {satellites.map((sat) => (
                                                            <option key={sat.id} value={sat.id}>
                                                                {sat.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {errors[`cov-${index}-satellite`] && (
                                                        <p className="text-red-400 text-xs mt-1">
                                                            {errors[`cov-${index}-satellite`]}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-500 mt-1.5">
                                                        Coverage radius will be calculated based on
                                                        satellite altitude
                                                    </p>
                                                </div>
                                            )}

                                            {/* Manual Range Settings */}
                                            {coverage.type === "manual" && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">
                                                            Min Elevation (°)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={coverage.minElevation}
                                                            onChange={(e) =>
                                                                handleCoverageChange(
                                                                    index,
                                                                    "minElevation",
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="5"
                                                            step="1"
                                                            min="0"
                                                            max="90"
                                                            className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                                                                errors[`cov-${index}-minElevation`]
                                                                    ? "border-red-500"
                                                                    : "border-slate-600"
                                                            }`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">
                                                            Max Range (km)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={coverage.maxRange}
                                                            onChange={(e) =>
                                                                handleCoverageChange(
                                                                    index,
                                                                    "maxRange",
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="2500"
                                                            step="100"
                                                            min="0"
                                                            className={`w-full px-2.5 py-2 bg-slate-800 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                                                                errors[`cov-${index}-maxRange`]
                                                                    ? "border-red-500"
                                                                    : "border-slate-600"
                                                            }`}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Coverage Color & Visibility */}
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">
                                                        Color:
                                                    </span>
                                                    <div className="flex gap-1">
                                                        {PRESET_COLORS.slice(0, 6).map(
                                                            (color, colorIdx) => (
                                                                <button
                                                                    key={colorIdx}
                                                                    onClick={() =>
                                                                        handleCoverageChange(
                                                                            index,
                                                                            "color",
                                                                            color
                                                                        )
                                                                    }
                                                                    className={`w-5 h-5 rounded-full border transition-all hover:scale-110 ${
                                                                        coverage.color.name ===
                                                                        color.name
                                                                            ? "border-white scale-110"
                                                                            : "border-slate-600/50"
                                                                    }`}
                                                                    style={{
                                                                        backgroundColor: `rgb(${
                                                                            color.r * 255
                                                                        }, ${color.g * 255}, ${
                                                                            color.b * 255
                                                                        })`,
                                                                    }}
                                                                />
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">
                                                        Visible
                                                    </span>
                                                    <button
                                                        onClick={() =>
                                                            handleCoverageChange(
                                                                index,
                                                                "isVisible",
                                                                !coverage.isVisible
                                                            )
                                                        }
                                                        className={`relative w-8 h-4 rounded-full transition-colors ${
                                                            coverage.isVisible
                                                                ? "bg-cyan-500"
                                                                : "bg-slate-600"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                                                coverage.isVisible
                                                                    ? "translate-x-4"
                                                                    : "translate-x-0"
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700 bg-slate-800/90">
                    <p className="text-xs text-slate-500">
                        {formData.coverages.length} coverage
                        {formData.coverages.length > 1 ? "s" : ""} configured
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-400 hover:to-orange-500 transition-all font-medium shadow-lg shadow-orange-500/20"
                        >
                            {editStation ? "Update Station" : "Add Station"}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GroundStationDialog;
