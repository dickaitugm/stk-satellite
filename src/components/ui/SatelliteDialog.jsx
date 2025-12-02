/**
 * SatelliteDialog Component
 * Modal dialog for adding/editing satellites with TLE or Keplerian elements
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Satellite,
    Palette,
    Link,
    FileText,
    Globe,
    ChevronDown,
    ChevronUp,
    Download,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Loader2,
    Search,
    Calendar,
    Orbit,
    Camera,
    Radio,
    Plus,
    Trash2,
    Settings,
    ChevronRight,
    Eye,
    EyeOff,
} from "lucide-react";
import {
    PRESET_COLORS,
    AXIS_OPTIONS,
    ORBIT_SOURCE_TYPES,
    TLE_SOURCES,
    ORBIT_PRESETS,
    CAMERA_TYPES,
    PAYLOAD_TYPES,
    EARTH_RADIUS_KM,
    EARTH_MU,
    calculateMeanMotion,
    calculateOrbitalPeriod,
    calculateAltitude,
    keplerianToTLE,
    extractNoradId,
} from "../../utils/satelliteConstants";

// Virtualized TLE History Picker Component
const ITEMS_PER_PAGE = 50;

const TleHistoryPicker = ({ tleHistory, selectedIndex, onSelect }) => {
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const listRef = useRef(null);
    const containerRef = useRef(null);

    // Filter TLEs based on search term (search by date)
    const filteredTLEs = searchTerm
        ? tleHistory.filter((tle) => {
              const dateStr = new Date(tle.epoch).toLocaleString().toLowerCase();
              return dateStr.includes(searchTerm.toLowerCase());
          })
        : tleHistory;

    // Reset display count when search changes
    useEffect(() => {
        setDisplayCount(ITEMS_PER_PAGE);
    }, [searchTerm]);

    // Handle scroll to load more
    const handleScroll = useCallback(
        (e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.target;
            if (scrollHeight - scrollTop - clientHeight < 100) {
                setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredTLEs.length));
            }
        },
        [filteredTLEs.length]
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedTle = tleHistory[selectedIndex];
    const displayedTLEs = filteredTLEs.slice(0, displayCount);

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-xs text-slate-400 mb-1">
                Select TLE Epoch ({tleHistory.length.toLocaleString()} available)
            </label>

            {/* Selected value display / trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-left focus:outline-none focus:border-cyan-500 flex items-center justify-between"
            >
                <span className="truncate">
                    {selectedTle ? (
                        <>
                            <Calendar className="w-3 h-3 inline mr-2 text-cyan-400" />
                            {new Date(selectedTle.epoch).toLocaleString()}
                        </>
                    ) : (
                        "Select TLE..."
                    )}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by date..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                                autoFocus
                            />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            Showing {displayedTLEs.length.toLocaleString()} of{" "}
                            {filteredTLEs.length.toLocaleString()}
                        </div>
                    </div>

                    {/* Virtualized list */}
                    <div ref={listRef} onScroll={handleScroll} className="max-h-60 overflow-y-auto">
                        {displayedTLEs.map((tle, idx) => {
                            const originalIndex = tleHistory.indexOf(tle);
                            const isSelected = originalIndex === selectedIndex;
                            return (
                                <button
                                    key={originalIndex}
                                    type="button"
                                    onClick={() => {
                                        onSelect(originalIndex);
                                        setIsOpen(false);
                                        setSearchTerm("");
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2 ${
                                        isSelected
                                            ? "bg-cyan-500/20 text-cyan-400"
                                            : "text-slate-300"
                                    }`}
                                >
                                    <Calendar className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">
                                        {new Date(tle.epoch).toLocaleString()}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Load more indicator */}
                        {displayCount < filteredTLEs.length && (
                            <div className="px-3 py-2 text-xs text-slate-500 text-center">
                                Scroll for more... ({filteredTLEs.length - displayCount} remaining)
                            </div>
                        )}

                        {filteredTLEs.length === 0 && (
                            <div className="px-3 py-4 text-sm text-slate-500 text-center">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const SatelliteDialog = ({
    isOpen,
    onClose,
    onSave,
    editSatellite = null,
    title = "Add Satellite",
}) => {
    // Form state
    const [formData, setFormData] = useState({
        name: "",
        noradId: "",
        orbitSource: "tle-url",
        tleSource: "celestrak",
        tleUrl: "",
        tleLine1: "",
        tleLine2: "",
        tleHistory: [], // Array of {epoch, line1, line2}
        selectedTleIndex: 0,
        // Keplerian elements
        orbitPreset: "custom", // Preset orbit selection
        semiMajorAxis: "6978.137", // km (600km altitude default)
        eccentricity: "0.001",
        inclination: "5", // degrees (near-equatorial)
        raan: "0", // Right Ascension of Ascending Node
        argOfPerigee: "0", // Argument of Perigee
        meanAnomaly: "0",
        epoch: new Date().toISOString().slice(0, 16),
        // Visual
        color: PRESET_COLORS[0],
        showCoverage: true, // Toggle coverage visibility
        // Payloads
        payloads: [],
    });

    // Component tree state
    const [selectedComponent, setSelectedComponent] = useState("orbit"); // 'orbit' | 'payload' | payload-id

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [fetchStatus, setFetchStatus] = useState(null); // 'success', 'error', null
    const [fetchMessage, setFetchMessage] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Initialize form when editing
    useEffect(() => {
        if (editSatellite) {
            setFormData({
                name: editSatellite.name || "",
                noradId: editSatellite.noradId || "",
                orbitSource: editSatellite.orbitSource || "tle-manual",
                tleSource: editSatellite.tleSource || "celestrak",
                tleUrl: editSatellite.tleUrl || "",
                tleLine1: editSatellite.tle?.line1 || "",
                tleLine2: editSatellite.tle?.line2 || "",
                tleHistory: editSatellite.tleHistory || [],
                selectedTleIndex: 0,
                semiMajorAxis: editSatellite.keplerian?.semiMajorAxis?.toString() || "6878.137",
                eccentricity: editSatellite.keplerian?.eccentricity?.toString() || "0.0001",
                inclination: editSatellite.keplerian?.inclination?.toString() || "51.6",
                raan: editSatellite.keplerian?.raan?.toString() || "0",
                argOfPerigee: editSatellite.keplerian?.argOfPerigee?.toString() || "0",
                meanAnomaly: editSatellite.keplerian?.meanAnomaly?.toString() || "0",
                epoch: editSatellite.keplerian?.epoch || new Date().toISOString().slice(0, 16),
                color: editSatellite.color || PRESET_COLORS[0],
                showCoverage: editSatellite.showCoverage !== false, // default true
                payloads: editSatellite.payloads || [],
            });
            setSelectedComponent("orbit");
        } else {
            // Reset form for new satellite
            setFormData({
                name: "",
                noradId: "",
                orbitSource: "tle-url",
                tleSource: "celestrak",
                tleUrl: "",
                tleLine1: "",
                tleLine2: "",
                tleHistory: [],
                selectedTleIndex: 0,
                semiMajorAxis: "6878.137",
                eccentricity: "0.0001",
                inclination: "51.6",
                raan: "0",
                argOfPerigee: "0",
                meanAnomaly: "0",
                epoch: new Date().toISOString().slice(0, 16),
                color: PRESET_COLORS[0],
                showCoverage: true,
                payloads: [],
            });
            setSelectedComponent("orbit");
        }
        setErrors({});
        setFetchStatus(null);
        setFetchMessage("");
    }, [editSatellite, isOpen]);

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

            // Use Electron IPC if available (bypasses CORS), otherwise use fetch
            if (window.electronAPI?.fetchTLE) {
                const result = await window.electronAPI.fetchTLE(url);
                if (!result.success) {
                    throw new Error(result.error);
                }
                text = result.data;
            } else {
                // Fallback to regular fetch (may have CORS issues)
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

            // Parse all TLEs from the file (3-line format: name, line1, line2)
            const allTLEs = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Check if this line looks like a TLE line 1
                if (line.startsWith("1 ") && i + 1 < lines.length) {
                    const line1 = line;
                    const line2 = lines[i + 1].trim();

                    // Get the name from the previous line (if exists and doesn't start with 1 or 2)
                    let name = "";
                    if (i > 0) {
                        const prevLine = lines[i - 1].trim();
                        if (!prevLine.startsWith("1 ") && !prevLine.startsWith("2 ")) {
                            name = prevLine;
                        }
                    }

                    if (line2.startsWith("2 ")) {
                        // Extract epoch from line1 (format: YYDDD.DDDDDDDD)
                        // TLE Line 1 columns 19-32 contain the epoch
                        const epochStr = line1.substring(18, 32).trim();
                        const epochYear = parseInt(epochStr.substring(0, 2));
                        const epochDayFull = parseFloat(epochStr.substring(2));

                        // Separate integer day and fractional part
                        const epochDayInt = Math.floor(epochDayFull);
                        const epochDayFrac = epochDayFull - epochDayInt;

                        // Convert fractional day to hours, minutes, seconds, milliseconds
                        const totalSecondsFloat = epochDayFrac * 86400; // 24 * 60 * 60
                        const hours = Math.floor(totalSecondsFloat / 3600);
                        const minutes = Math.floor((totalSecondsFloat % 3600) / 60);
                        const seconds = Math.floor(totalSecondsFloat % 60);
                        const milliseconds = Math.round((totalSecondsFloat % 1) * 1000);

                        const fullYear = epochYear > 56 ? 1900 + epochYear : 2000 + epochYear;

                        // Create date using UTC components directly
                        const epochDate = new Date(
                            Date.UTC(
                                fullYear,
                                0, // January
                                epochDayInt, // Day of year (1-based works here since Jan 1 = day 1)
                                hours,
                                minutes,
                                seconds,
                                milliseconds
                            )
                        );

                        allTLEs.push({
                            name: name.trim(),
                            line1,
                            line2,
                            epoch: epochDate.toISOString(),
                            noradId: line1.substring(2, 7).trim(),
                        });

                        i++; // Skip line2 since we already processed it
                    }
                }
            }

            if (allTLEs.length === 0) {
                throw new Error("No valid TLE data found in the file");
            }

            // Search for the satellite by name (case-insensitive, partial match)
            const searchName = formData.name.trim().toUpperCase();
            const matchingTLEs = allTLEs.filter(
                (tle) =>
                    tle.name.toUpperCase().includes(searchName) ||
                    searchName.includes(tle.name.toUpperCase().replace(/\s+/g, ""))
            );

            if (formData.orbitSource === "tle-url-history") {
                // Return all matching TLEs as history
                if (matchingTLEs.length > 0) {
                    // Sort by epoch (newest first)
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
                    setFetchStatus("success");
                    setFetchMessage(
                        `Found ${matchingTLEs.length} TLE records for "${formData.name}"`
                    );
                } else {
                    // Show all available satellites
                    const availableNames = [...new Set(allTLEs.map((t) => t.name))].slice(0, 10);
                    throw new Error(
                        `Satellite "${formData.name}" not found. Available: ${availableNames.join(
                            ", "
                        )}${allTLEs.length > 10 ? "..." : ""}`
                    );
                }
            } else {
                // Single TLE - get the first (or newest) match
                if (matchingTLEs.length > 0) {
                    // Sort by epoch and get the newest
                    matchingTLEs.sort((a, b) => new Date(b.epoch) - new Date(a.epoch));
                    const tle = matchingTLEs[0];

                    setFormData((prev) => ({
                        ...prev,
                        tleLine1: tle.line1,
                        tleLine2: tle.line2,
                        noradId: tle.noradId,
                        tleUrl: url,
                    }));
                    setFetchStatus("success");
                    setFetchMessage(
                        `TLE found for "${tle.name}" (Epoch: ${new Date(
                            tle.epoch
                        ).toLocaleDateString()})`
                    );
                } else {
                    // Show all available satellites
                    const availableNames = [...new Set(allTLEs.map((t) => t.name))].slice(0, 10);
                    throw new Error(
                        `Satellite "${formData.name}" not found. Available: ${availableNames.join(
                            ", "
                        )}${allTLEs.length > 10 ? "..." : ""}`
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

    // Handle input changes
    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => ({ ...prev, [field]: null }));
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
        }
    };

    // Add new payload
    const addPayload = (type) => {
        const newPayload = {
            id: `payload-${Date.now()}`,
            name:
                type === "camera"
                    ? `Camera ${formData.payloads.length + 1}`
                    : `AIS ${formData.payloads.length + 1}`,
            type,
            // Camera specific
            cameraType: type === "camera" ? "rgb" : undefined,
            axis: "+z",
            fov: type === "camera" ? 30 : undefined,
            // AIS specific
            frequency: type === "ais" ? 162.0 : undefined,
            antennaAxis: type === "ais" ? "+z" : undefined,
        };
        setFormData((prev) => ({
            ...prev,
            payloads: [...prev.payloads, newPayload],
        }));
        setSelectedComponent(newPayload.id);
    };

    // Update payload
    const updatePayload = (payloadId, field, value) => {
        setFormData((prev) => ({
            ...prev,
            payloads: prev.payloads.map((p) => (p.id === payloadId ? { ...p, [field]: value } : p)),
        }));
    };

    // Remove payload
    const removePayload = (payloadId) => {
        setFormData((prev) => ({
            ...prev,
            payloads: prev.payloads.filter((p) => p.id !== payloadId),
        }));
        setSelectedComponent("orbit");
    };

    // Get selected payload
    const getSelectedPayload = () => {
        if (selectedComponent.startsWith("payload-")) {
            return formData.payloads.find((p) => p.id === selectedComponent);
        }
        return null;
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
        if (!validateForm()) return;

        const satelliteData = {
            id: editSatellite?.id || `sat-${Date.now()}`,
            name: formData.name.trim(),
            noradId: formData.noradId || extractNoradId(formData.tleLine1),
            orbitSource: formData.orbitSource,
            tleSource: formData.tleSource,
            tleUrl: formData.tleUrl,
            color: formData.color,
            showCoverage: formData.showCoverage,
            isActive: true,
            isVisible: true,
            payloads: formData.payloads,
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

        onSave(satelliteData, !!editSatellite);
        onClose();
    };

    if (!isOpen) return null;

    // Get selected payload for editing
    const selectedPayload = getSelectedPayload();

    const dialogContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <Satellite className="w-5 h-5 text-cyan-400" />
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
                    {/* Basic Info Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Satellite className="w-4 h-4" />
                            Basic Information
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Name */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Satellite Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange("name", e.target.value)}
                                    placeholder="e.g., LAPAN-A2"
                                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                        ${errors.name ? "border-red-500" : "border-slate-600"}
                                        focus:outline-none focus:border-cyan-500`}
                                />
                                {errors.name && (
                                    <p className="text-xs text-red-400 mt-1">{errors.name}</p>
                                )}
                            </div>

                            {/* NORAD ID */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    NORAD ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.noradId}
                                    onChange={(e) => handleChange("noradId", e.target.value)}
                                    placeholder="e.g., 40931"
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">
                                <Palette className="w-3 h-3 inline mr-1" />
                                Color
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color.name}
                                        onClick={() => handleChange("color", color)}
                                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                            formData.color.name === color.name
                                                ? "border-white scale-110"
                                                : "border-transparent hover:border-slate-500"
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

                        {/* Coverage Visibility Toggle */}
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-400 flex items-center gap-1">
                                {formData.showCoverage ? (
                                    <Eye className="w-3 h-3" />
                                ) : (
                                    <EyeOff className="w-3 h-3" />
                                )}
                                Show Coverage Area
                            </label>
                            <button
                                type="button"
                                onClick={() => handleChange("showCoverage", !formData.showCoverage)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${
                                    formData.showCoverage ? "bg-cyan-500" : "bg-slate-600"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        formData.showCoverage ? "translate-x-5" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Component Tree + Form Section (2-column layout) */}
                    <div className="flex gap-4 min-h-[400px]">
                        {/* Left: Component Tree */}
                        <div className="w-48 flex-shrink-0 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-2 border-b border-slate-700 bg-slate-800">
                                <h4 className="text-xs font-medium text-slate-400 uppercase">
                                    Components
                                </h4>
                            </div>
                            <div className="p-2 space-y-1">
                                {/* Orbit Elements */}
                                <button
                                    onClick={() => setSelectedComponent("orbit")}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                                        selectedComponent === "orbit"
                                            ? "bg-cyan-500/20 text-cyan-400"
                                            : "text-slate-300 hover:bg-slate-700"
                                    }`}
                                >
                                    <Orbit className="w-4 h-4" />
                                    <span>Orbit Elements</span>
                                </button>

                                {/* Payloads Header */}
                                <div className="pt-2 mt-2 border-t border-slate-700">
                                    <div className="flex items-center justify-between px-2 py-1">
                                        <span className="text-xs font-medium text-slate-400 uppercase">
                                            Payloads
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => addPayload("camera")}
                                                className="p-0.5 hover:bg-slate-600 rounded text-slate-400 hover:text-cyan-400"
                                                title="Add Camera"
                                            >
                                                <Camera className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => addPayload("ais")}
                                                className="p-0.5 hover:bg-slate-600 rounded text-slate-400 hover:text-cyan-400"
                                                title="Add AIS"
                                            >
                                                <Radio className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Payload List */}
                                {formData.payloads.length === 0 ? (
                                    <div className="px-2 py-2 text-xs text-slate-500 italic">
                                        No payloads added
                                    </div>
                                ) : (
                                    formData.payloads.map((payload) => {
                                        const PayloadIcon =
                                            payload.type === "camera" ? Camera : Radio;
                                        return (
                                            <button
                                                key={payload.id}
                                                onClick={() => setSelectedComponent(payload.id)}
                                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors group ${
                                                    selectedComponent === payload.id
                                                        ? "bg-cyan-500/20 text-cyan-400"
                                                        : "text-slate-300 hover:bg-slate-700"
                                                }`}
                                            >
                                                <PayloadIcon className="w-4 h-4 flex-shrink-0" />
                                                <span className="truncate flex-1">
                                                    {payload.name}
                                                </span>
                                                <Trash2
                                                    className="w-3.5 h-3.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removePayload(payload.id);
                                                    }}
                                                />
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right: Form Panel */}
                        <div className="flex-1 bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    {selectedComponent === "orbit" && (
                                        <>
                                            <Orbit className="w-4 h-4 text-cyan-400" />
                                            Orbit Elements
                                        </>
                                    )}
                                    {selectedPayload && (
                                        <>
                                            {selectedPayload.type === "camera" ? (
                                                <Camera className="w-4 h-4 text-cyan-400" />
                                            ) : (
                                                <Radio className="w-4 h-4 text-cyan-400" />
                                            )}
                                            {selectedPayload.name}
                                        </>
                                    )}
                                </h4>
                            </div>

                            <div className="p-4 overflow-y-auto max-h-[340px] space-y-4">
                                {/* Orbit Elements Panel */}
                                {selectedComponent === "orbit" && (
                                    <>
                                        {/* Orbit Source Selection */}
                                        <div className="space-y-3">
                                            <h5 className="text-xs font-medium text-slate-400 uppercase">
                                                Source Type
                                            </h5>
                                            <div className="grid grid-cols-2 gap-2">
                                                {ORBIT_SOURCE_TYPES.map((source) => {
                                                    // Map iconName to actual icon component
                                                    const iconMap = { Link, FileText, Globe };
                                                    const Icon = iconMap[source.iconName] || Globe;
                                                    return (
                                                        <button
                                                            key={source.id}
                                                            onClick={() =>
                                                                handleChange(
                                                                    "orbitSource",
                                                                    source.id
                                                                )
                                                            }
                                                            className={`flex items-start gap-2 p-2 rounded-lg border transition-all text-left ${
                                                                formData.orbitSource === source.id
                                                                    ? "border-cyan-500 bg-cyan-500/10"
                                                                    : "border-slate-600 hover:border-slate-500"
                                                            }`}
                                                        >
                                                            <Icon
                                                                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                                                    formData.orbitSource ===
                                                                    source.id
                                                                        ? "text-cyan-400"
                                                                        : "text-slate-400"
                                                                }`}
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="text-xs text-white truncate">
                                                                    {source.name}
                                                                </div>
                                                                <div className="text-xs text-slate-500 truncate">
                                                                    {source.description}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* TLE from URL */}
                                        {(formData.orbitSource === "tle-url" ||
                                            formData.orbitSource === "tle-url-history") && (
                                            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                <h5 className="text-xs font-medium text-slate-400 uppercase">
                                                    TLE Source
                                                </h5>

                                                {/* Source selection */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {TLE_SOURCES.map((source) => (
                                                        <button
                                                            key={source.id}
                                                            onClick={() =>
                                                                handleChange("tleSource", source.id)
                                                            }
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
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            TLE URL
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.tleUrl}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "tleUrl",
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="https://..."
                                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                                        />
                                                    </div>
                                                )}

                                                {/* Preview URL */}
                                                {formData.tleSource !== "custom" &&
                                                    formData.name && (
                                                        <div className="text-xs text-slate-500 break-all">
                                                            URL: {buildTleUrl()}
                                                        </div>
                                                    )}

                                                {/* Fetch button */}
                                                <button
                                                    onClick={fetchTLE}
                                                    disabled={
                                                        loading ||
                                                        (!formData.name &&
                                                            formData.tleSource !== "custom")
                                                    }
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
                                                >
                                                    {loading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                    {loading ? "Fetching..." : "Fetch TLE"}
                                                </button>

                                                {/* Status message */}
                                                {fetchStatus && (
                                                    <div
                                                        className={`flex items-center gap-2 text-xs ${
                                                            fetchStatus === "success"
                                                                ? "text-green-400"
                                                                : "text-red-400"
                                                        }`}
                                                    >
                                                        {fetchStatus === "success" ? (
                                                            <CheckCircle className="w-4 h-4" />
                                                        ) : (
                                                            <AlertCircle className="w-4 h-4" />
                                                        )}
                                                        {fetchMessage}
                                                    </div>
                                                )}

                                                {/* TLE History selection */}
                                                {formData.orbitSource === "tle-url-history" &&
                                                    formData.tleHistory.length > 0 && (
                                                        <TleHistoryPicker
                                                            tleHistory={formData.tleHistory}
                                                            selectedIndex={
                                                                formData.selectedTleIndex
                                                            }
                                                            onSelect={selectTleFromHistory}
                                                        />
                                                    )}
                                            </div>
                                        )}

                                        {/* Manual TLE Input */}
                                        {(formData.orbitSource === "tle-manual" ||
                                            formData.tleLine1) &&
                                            formData.orbitSource !== "keplerian" && (
                                                <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                    <h5 className="text-xs font-medium text-slate-400 uppercase">
                                                        TLE Data
                                                    </h5>

                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Line 1 *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.tleLine1}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "tleLine1",
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN"
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-xs font-mono
                                                            ${
                                                                errors.tleLine1
                                                                    ? "border-red-500"
                                                                    : "border-slate-600"
                                                            }
                                                            focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.tleLine1 && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.tleLine1}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Line 2 *
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.tleLine2}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "tleLine2",
                                                                    e.target.value
                                                                )
                                                            }
                                                            placeholder="2 NNNNN NNN.NNNN NNN.NNNN NNNNNNN NNN.NNNN NNN.NNNN NN.NNNNNNNNNNNNNN"
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-xs font-mono
                                                            ${
                                                                errors.tleLine2
                                                                    ? "border-red-500"
                                                                    : "border-slate-600"
                                                            }
                                                            focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.tleLine2 && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.tleLine2}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {/* Keplerian Elements */}
                                        {formData.orbitSource === "keplerian" && (
                                            <div className="space-y-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                <h5 className="text-xs font-medium text-slate-400 uppercase">
                                                    Keplerian Elements
                                                </h5>

                                                {/* Orbit Preset Selector */}
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Orbit Preset
                                                    </label>
                                                    <select
                                                        value={formData.orbitPreset}
                                                        onChange={(e) => {
                                                            const preset = ORBIT_PRESETS.find(p => p.id === e.target.value);
                                                            if (preset && preset.values) {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    orbitPreset: e.target.value,
                                                                    ...preset.values
                                                                }));
                                                            } else {
                                                                handleChange("orbitPreset", e.target.value);
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                                    >
                                                        {ORBIT_PRESETS.map(preset => (
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
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Altitude (km)
                                                        </label>
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
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Auto-calculates Semi-major Axis
                                                        </p>
                                                    </div>

                                                    {/* Semi-major axis */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Semi-major Axis (km) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            value={formData.semiMajorAxis}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "semiMajorAxis",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.semiMajorAxis
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.semiMajorAxis && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.semiMajorAxis}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Eccentricity */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Eccentricity *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.0001"
                                                            value={formData.eccentricity}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "eccentricity",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.eccentricity
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.eccentricity && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.eccentricity}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Inclination */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Inclination (°) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.inclination}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "inclination",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.inclination
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.inclination && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.inclination}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* RAAN */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            RAAN (°) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.raan}
                                                            onChange={(e) =>
                                                                handleChange("raan", e.target.value)
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.raan
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.raan && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.raan}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Argument of Perigee */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Arg. of Perigee (°) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.argOfPerigee}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "argOfPerigee",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.argOfPerigee
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.argOfPerigee && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.argOfPerigee}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Mean Anomaly */}
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">
                                                            Mean Anomaly (°) *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.meanAnomaly}
                                                            onChange={(e) =>
                                                                handleChange(
                                                                    "meanAnomaly",
                                                                    e.target.value
                                                                )
                                                            }
                                                            className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white text-sm
                                                                ${
                                                                    errors.meanAnomaly
                                                                        ? "border-red-500"
                                                                        : "border-slate-600"
                                                                }
                                                                focus:outline-none focus:border-cyan-500`}
                                                        />
                                                        {errors.meanAnomaly && (
                                                            <p className="text-xs text-red-400 mt-1">
                                                                {errors.meanAnomaly}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Epoch */}
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        Epoch *
                                                    </label>
                                                    <input
                                                        type="datetime-local"
                                                        value={formData.epoch}
                                                        onChange={(e) =>
                                                            handleChange("epoch", e.target.value)
                                                        }
                                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Payload Panel - Camera */}
                                {selectedPayload && selectedPayload.type === "camera" && (
                                    <div className="space-y-4">
                                        {/* Payload Name */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Payload Name
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedPayload.name}
                                                onChange={(e) =>
                                                    updatePayload(
                                                        selectedPayload.id,
                                                        "name",
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        {/* Camera Type */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Camera Type
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {CAMERA_TYPES.map((type) => (
                                                    <button
                                                        key={type.id}
                                                        onClick={() =>
                                                            updatePayload(
                                                                selectedPayload.id,
                                                                "cameraType",
                                                                type.id
                                                            )
                                                        }
                                                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                            selectedPayload.cameraType === type.id
                                                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                                                : "border-slate-600 text-slate-300 hover:border-slate-500"
                                                        }`}
                                                    >
                                                        {type.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Mounting Axis */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Mounting Axis (Boresight)
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {AXIS_OPTIONS.map((axis) => (
                                                    <button
                                                        key={axis.id}
                                                        onClick={() =>
                                                            updatePayload(
                                                                selectedPayload.id,
                                                                "axis",
                                                                axis.id
                                                            )
                                                        }
                                                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                            selectedPayload.axis === axis.id
                                                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                                                : "border-slate-600 text-slate-300 hover:border-slate-500"
                                                        }`}
                                                    >
                                                        {axis.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Field of View */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Field of View (°)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                max="180"
                                                value={selectedPayload.fov || 30}
                                                onChange={(e) =>
                                                    updatePayload(
                                                        selectedPayload.id,
                                                        "fov",
                                                        parseFloat(e.target.value)
                                                    )
                                                }
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Payload Panel - AIS */}
                                {selectedPayload && selectedPayload.type === "ais" && (
                                    <div className="space-y-4">
                                        {/* Payload Name */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Payload Name
                                            </label>
                                            <input
                                                type="text"
                                                value={selectedPayload.name}
                                                onChange={(e) =>
                                                    updatePayload(
                                                        selectedPayload.id,
                                                        "name",
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        {/* AIS Frequency */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                AIS Frequency (MHz)
                                            </label>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <button
                                                    onClick={() =>
                                                        updatePayload(
                                                            selectedPayload.id,
                                                            "frequency",
                                                            161.975
                                                        )
                                                    }
                                                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                        selectedPayload.frequency === 161.975
                                                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                                            : "border-slate-600 text-slate-300 hover:border-slate-500"
                                                    }`}
                                                >
                                                    AIS 1 (161.975)
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        updatePayload(
                                                            selectedPayload.id,
                                                            "frequency",
                                                            162.025
                                                        )
                                                    }
                                                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                        selectedPayload.frequency === 162.025
                                                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                                            : "border-slate-600 text-slate-300 hover:border-slate-500"
                                                    }`}
                                                >
                                                    AIS 2 (162.025)
                                                </button>
                                            </div>
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="150"
                                                max="170"
                                                value={selectedPayload.frequency || 162.0}
                                                onChange={(e) =>
                                                    updatePayload(
                                                        selectedPayload.id,
                                                        "frequency",
                                                        parseFloat(e.target.value)
                                                    )
                                                }
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                                placeholder="Custom frequency"
                                            />
                                        </div>

                                        {/* Antenna Axis */}
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">
                                                Antenna Axis
                                            </label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {AXIS_OPTIONS.map((axis) => (
                                                    <button
                                                        key={axis.id}
                                                        onClick={() =>
                                                            updatePayload(
                                                                selectedPayload.id,
                                                                "antennaAxis",
                                                                axis.id
                                                            )
                                                        }
                                                        className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                                                            selectedPayload.antennaAxis === axis.id
                                                                ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                                                                : "border-slate-600 text-slate-300 hover:border-slate-500"
                                                        }`}
                                                    >
                                                        {axis.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
                    >
                        {editSatellite ? "Update" : "Add"} Satellite
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(dialogContent, document.body);
};

export default SatelliteDialog;
