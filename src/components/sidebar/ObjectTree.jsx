/**
 * ObjectTree Component
 * Tree view for satellites, ground stations, target areas
 */

import React, { useState } from "react";
import { Satellite, Radio, Target, Plus, FolderOpen, Folder, Camera, Compass, Antenna, Edit, Circle, MapPin, Orbit, Settings2, Box, FileDown, Clock, Trash2, RefreshCw, Loader2, Eye, EyeOff } from "lucide-react";

import TreeNode from "./TreeNode";
import ContextMenu from "./ContextMenu";
import { GroundStationDialog, SatelliteDialog } from "../ui";

import { useSatelliteStore, useGroundStationStore, useTargetAreaStore, useTimeStore, useTabsStore } from "../../stores";

const ObjectTree = () => {
  // Stores
  const satellites = useSatelliteStore((state) => state.satellites);
  const selectedSatelliteId = useSatelliteStore((state) => state.selectedSatelliteId);
  const selectSatellite = useSatelliteStore((state) => state.selectSatellite);
  const toggleSatelliteVisibility = useSatelliteStore((state) => state.toggleVisibility);
  const removeSatellite = useSatelliteStore((state) => state.removeSatellite);
  const updateSatellite = useSatelliteStore((state) => state.updateSatellite);
  const addSatellite = useSatelliteStore((state) => state.addSatellite);

  const groundStations = useGroundStationStore((state) => state.groundStations);
  const selectedStationId = useGroundStationStore((state) => state.selectedStationId);
  const selectStation = useGroundStationStore((state) => state.selectStation);
  const toggleStationVisibility = useGroundStationStore((state) => state.toggleVisibility);
  const removeGroundStation = useGroundStationStore((state) => state.removeGroundStation);
  const addGroundStation = useGroundStationStore((state) => state.addGroundStation);
  const updateGroundStation = useGroundStationStore((state) => state.updateGroundStation);
  const getStationById = useGroundStationStore((state) => state.getStationById);
  const togglePassVisibility = useGroundStationStore((state) => state.togglePassVisibility);
  const removePass = useGroundStationStore((state) => state.removePass);
  const clearPasses = useGroundStationStore((state) => state.clearPasses);

  // Toggle coverage visibility within a ground station
  const toggleCoverageVisibility = (gsId, covId) => {
    const gs = groundStations.find((g) => g.id === gsId);
    if (!gs || !gs.coverages) return;

    const updatedCoverages = gs.coverages.map((cov) => (cov.id === covId ? { ...cov, isVisible: !cov.isVisible } : cov));
    updateGroundStation(gsId, { coverages: updatedCoverages });
  };

  const targetAreas = useTargetAreaStore((state) => state.targetAreas);
  const selectedAreaId = useTargetAreaStore((state) => state.selectedAreaId);
  const selectArea = useTargetAreaStore((state) => state.selectArea);
  const toggleAreaVisibility = useTargetAreaStore((state) => state.toggleVisibility);
  const removeTargetArea = useTargetAreaStore((state) => state.removeTargetArea);

  // Tabs store for property panels and sidebar control
  const addTab = useTabsStore((state) => state.addTab);
  const setSidebarCollapsed = useTabsStore((state) => state.setSidebarCollapsed);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Ground station dialog state
  const [gsDialogOpen, setGsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);

  // Satellite dialog state
  const [satDialogOpen, setSatDialogOpen] = useState(false);
  const [editingSatellite, setEditingSatellite] = useState(null);

  // Export status state: { [satelliteId]: "loading" | "success" | "error" | null }
  const [exportStatus, setExportStatus] = useState({});

  // TLE update status state: { [satelliteId]: "loading" | "success" | "error" | null }
  const [tleUpdateStatus, setTleUpdateStatus] = useState({});

  // Close context menu
  const closeContextMenu = () => setContextMenu(null);

  // Handle export orbit to KMZ
  const handleExportOrbit = async (sat) => {
    if (exportStatus[sat.id] === "loading") return; // Prevent multiple exports

    setExportStatus((prev) => ({ ...prev, [sat.id]: "loading" }));

    try {
      // Get current time from time store (simulation or realtime)
      const currentTime = useTimeStore.getState().currentTime;
      const mode = useTimeStore.getState().mode;

      console.log(`📤 Export KML - Mode: ${mode}, Time: ${currentTime.toISOString()}`);

      // Generate orbit path using the simulation/realtime time
      const result = await window.electronAPI.generateOrbitPath(sat.tle, currentTime.getTime(), 100);

      console.log(`📤 Generated ${result.path?.length || 0} orbit points starting from ${new Date(result.path?.[0]?.time).toISOString()}`);

      if (!result.success || !result.path || result.path.length === 0) {
        console.error("Failed to generate orbit path for export");
        setExportStatus((prev) => ({ ...prev, [sat.id]: "error" }));
        setTimeout(() => setExportStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
        return;
      }

      // Get current position from store
      const currentPosition = useSatelliteStore.getState().positions[sat.id] || result.path[0];

      // Export to KMZ via IPC
      const exportResult = await window.electronAPI.exportOrbitKmz({
        satelliteName: sat.name,
        color: sat.color,
        orbitPoints: result.path,
        currentPosition: {
          ...currentPosition,
          time: currentTime.getTime(),
        },
        simulationTime: currentTime.getTime(),
      });

      if (exportResult.success) {
        console.log(`✅ Orbit exported to: ${exportResult.filePath}`);
        setExportStatus((prev) => ({ ...prev, [sat.id]: "success" }));
        setTimeout(() => setExportStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
      } else if (exportResult.error === "Export cancelled") {
        setExportStatus((prev) => ({ ...prev, [sat.id]: null }));
      } else {
        console.error("Export failed:", exportResult.error);
        setExportStatus((prev) => ({ ...prev, [sat.id]: "error" }));
        setTimeout(() => setExportStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
      }
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus((prev) => ({ ...prev, [sat.id]: "error" }));
      setTimeout(() => setExportStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
    }
  };

  // Handle save ground station
  const handleSaveGroundStation = (stationData, isEdit) => {
    if (isEdit) {
      updateGroundStation(stationData.id, stationData);
    } else {
      addGroundStation(stationData);
    }
  };

  // Handle save satellite
  const handleSaveSatellite = (satelliteData, isEdit) => {
    if (isEdit) {
      updateSatellite(satelliteData.id, satelliteData);
    } else {
      addSatellite(satelliteData);
    }
  };

  // Handle TLE update from sidebar
  const handleUpdateTLE = async (sat) => {
    if (tleUpdateStatus[sat.id] === "loading") return;
    
    // Check if satellite has TLE URL source
    if (sat.orbitSource !== "tle-url" && sat.orbitSource !== "tle-url-history") {
      console.log("TLE update only available for URL-based sources");
      return;
    }

    const tleUrl = sat.tleUrl;
    if (!tleUrl) {
      setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: "error" }));
      setTimeout(() => setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
      return;
    }

    setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: "loading" }));

    try {
      let text;
      if (window.electronAPI?.fetchTLE) {
        const result = await window.electronAPI.fetchTLE(tleUrl);
        if (!result.success) throw new Error(result.error);
        text = result.data;
      } else {
        const response = await fetch(tleUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        text = await response.text();
      }

      const lines = text.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());

      // Parse all TLEs from the file
      const allTLEs = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("1 ") && lines[i + 1]?.startsWith("2 ")) {
          const name = i > 0 && !lines[i - 1].startsWith("1 ") && !lines[i - 1].startsWith("2 ") 
            ? lines[i - 1].trim() 
            : "UNKNOWN";
          allTLEs.push({ name, line1: lines[i], line2: lines[i + 1] });
          i++;
        }
      }

      if (allTLEs.length === 0) {
        throw new Error("No valid TLE found in response");
      }

      // Find matching TLE
      const searchName = sat.name.trim().toUpperCase();
      const matchingTLEs = allTLEs.filter(
        (tle) =>
          tle.name.toUpperCase().includes(searchName) ||
          searchName.includes(tle.name.toUpperCase().replace(/\s+/g, ""))
      );

      if (matchingTLEs.length > 0) {
        const latestTle = matchingTLEs[0];
        
        // Update satellite with new TLE
        updateSatellite(sat.id, {
          tle: { line1: latestTle.line1, line2: latestTle.line2 },
          tleHistory: sat.orbitSource === "tle-url-history" 
            ? matchingTLEs.map(t => ({
                line1: t.line1,
                line2: t.line2,
                epoch: extractEpochFromTLE(t.line1),
                fetchedAt: new Date().toISOString()
              }))
            : sat.tleHistory
        });

        setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: "success" }));
        setTimeout(() => setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
      } else {
        throw new Error(`No matching TLE found for "${sat.name}"`);
      }
    } catch (error) {
      console.error("TLE update error:", error);
      setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: "error" }));
      setTimeout(() => setTleUpdateStatus((prev) => ({ ...prev, [sat.id]: null })), 3000);
    }
  };

  // Helper to extract epoch from TLE line 1
  const extractEpochFromTLE = (line1) => {
    try {
      const epochStr = line1.substring(18, 32).trim();
      const year = parseInt(epochStr.substring(0, 2));
      const dayOfYear = parseFloat(epochStr.substring(2));
      const fullYear = year > 56 ? 1900 + year : 2000 + year;
      const date = new Date(Date.UTC(fullYear, 0, 1));
      date.setTime(date.getTime() + (dayOfYear - 1) * 24 * 60 * 60 * 1000);
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  // Toggle object visibility within a satellite
  const toggleObjectVisibility = (satId, objId) => {
    const sat = satellites.find((s) => s.id === satId);
    if (!sat || !sat.objects) return;

    const updatedObjects = sat.objects.map((obj) => 
      obj.id === objId ? { ...obj, isVisible: !obj.isVisible } : obj
    );
    updateSatellite(satId, { objects: updatedObjects });
  };

  // Open add satellite dialog
  const openAddSatDialog = () => {
    setEditingSatellite(null);
    setSatDialogOpen(true);
  };

  // Open edit satellite dialog
  const openEditSatDialog = (sat) => {
    setEditingSatellite(sat);
    setSatDialogOpen(true);
  };

  // Open add ground station dialog
  const openAddGsDialog = () => {
    setEditingStation(null);
    setGsDialogOpen(true);
  };

  // Open edit ground station dialog
  const openEditGsDialog = (gs) => {
    setEditingStation(gs);
    setGsDialogOpen(true);
  };

  // Satellite context menu items
  const getSatelliteContextMenu = (sat) => [
    {
      label: "Edit Satellite",
      icon: <Edit className="w-4 h-4" />,
      onClick: () => {
        openEditSatDialog(sat);
      },
    },
    {
      label: "Add Sensor",
      icon: <Camera className="w-4 h-4" />,
      onClick: () => {
        const sensors = sat.sensors || [];
        updateSatellite(sat.id, {
          sensors: [
            ...sensors,
            {
              id: `sensor-${Date.now()}`,
              name: `Sensor ${sensors.length + 1}`,
              type: "optical",
              fov: 30, // degrees
              isActive: true,
            },
          ],
        });
      },
    },
    {
      label: "Add Antenna",
      icon: <Antenna className="w-4 h-4" />,
      onClick: () => {
        const antennas = sat.antennas || [];
        updateSatellite(sat.id, {
          antennas: [
            ...antennas,
            {
              id: `antenna-${Date.now()}`,
              name: `Antenna ${antennas.length + 1}`,
              type: "parabolic",
              gain: 30, // dB
              frequency: 8000, // MHz
              isActive: true,
            },
          ],
        });
      },
    },
    {
      label: "Edit Attitude",
      icon: <Compass className="w-4 h-4" />,
      onClick: () => {
        // TODO: Open attitude editor modal
        console.log("Edit attitude for:", sat.name);
      },
    },
    { separator: true },
    {
      label: "Properties",
      onClick: () => {
        // Open properties in tab panel and collapse sidebar
        addTab("satellite", sat.id, sat.name);
        setSidebarCollapsed(true);
      },
    },
    { separator: true },
    {
      label: "Delete",
      danger: true,
      onClick: () => removeSatellite(sat.id),
    },
  ];

  // Ground station context menu items
  const getGroundStationContextMenu = (gs) => [
    {
      label: "Edit Station",
      icon: <Edit className="w-4 h-4" />,
      onClick: () => {
        openEditGsDialog(gs);
      },
    },
    {
      label: "Add Antenna",
      icon: <Antenna className="w-4 h-4" />,
      onClick: () => {
        console.log("Add antenna to:", gs.name);
      },
    },
    { separator: true },
    {
      label: "Properties",
      onClick: () => {
        // Open properties in tab panel and collapse sidebar
        addTab("groundStation", gs.id, gs.name);
        setSidebarCollapsed(true);
      },
    },
    { separator: true },
    {
      label: "Delete",
      danger: true,
      onClick: () => removeGroundStation(gs.id),
    },
  ];

  // Target area context menu items
  const getTargetAreaContextMenu = (ta) => [
    {
      label: "Properties",
      onClick: () => {
        console.log("Properties for:", ta.name);
      },
    },
    { separator: true },
    {
      label: "Delete",
      danger: true,
      onClick: () => removeTargetArea(ta.id),
    },
  ];

  // Handle context menu
  const handleContextMenu = (e, item, type) => {
    let items = [];
    switch (type) {
      case "satellite":
        items = getSatelliteContextMenu(item);
        break;
      case "groundStation":
        items = getGroundStationContextMenu(item);
        break;
      case "targetArea":
        items = getTargetAreaContextMenu(item);
        break;
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  // Category expand states
  const [expandedCategories, setExpandedCategories] = useState({
    satellites: true,
    groundStations: true,
    targetAreas: true,
  });

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="text-sm">
      {/* Context Menu */}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={closeContextMenu} />}

      {/* Satellites */}
      <div className="mb-2">
        <div
          className="flex items-center gap-2 py-1.5 px-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-800 border border-slate-700/50"
          onClick={() => toggleCategory("satellites")}
        >
          {expandedCategories.satellites ? <FolderOpen className="w-4 h-4 text-cyan-400" /> : <Folder className="w-4 h-4 text-cyan-400" />}
          <span className="font-medium flex-1 text-slate-200">Satellites</span>
          <span className="text-xs text-slate-500">{satellites.length}</span>
          <button
            className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              openAddSatDialog();
            }}
            title="Add Satellite"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {expandedCategories.satellites && (
          <div className="mt-1">
            {satellites.map((sat) => (
              <div key={sat.id}>
                <TreeNode
                  item={sat}
                  icon={Satellite}
                  isSelected={selectedSatelliteId === sat.id}
                  onSelect={selectSatellite}
                  onToggleVisibility={toggleSatelliteVisibility}
                  onContextMenu={(e, item) => handleContextMenu(e, item, "satellite")}
                  level={1}
                >
                  {/* Orbit Elements with Update Button */}
                  <div
                    className="flex items-center gap-1 py-1 px-1 rounded cursor-pointer transition-colors text-slate-300 hover:bg-slate-800"
                    style={{ paddingLeft: "36px" }}
                  >
                    <span className="w-4" />
                    <Orbit className="w-4 h-4 flex-shrink-0 text-slate-400" />
                    <span className="flex-1 text-sm truncate flex items-center gap-1">
                      Orbit Elements
                      <span className="text-xs text-slate-500">
                        ({sat.orbitSource === "keplerian" ? "Keplerian" : "TLE"})
                      </span>
                    </span>
                    {/* Update TLE button - only for URL-based sources */}
                    {(sat.orbitSource === "tle-url" || sat.orbitSource === "tle-url-history") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateTLE(sat);
                        }}
                        disabled={tleUpdateStatus[sat.id] === "loading"}
                        className={`p-0.5 rounded transition-colors ${
                          tleUpdateStatus[sat.id] === "loading"
                            ? "text-slate-500"
                            : tleUpdateStatus[sat.id] === "success"
                            ? "text-green-400"
                            : tleUpdateStatus[sat.id] === "error"
                            ? "text-red-400"
                            : "text-cyan-400 hover:bg-cyan-600/20"
                        }`}
                        title="Update TLE"
                      >
                        {tleUpdateStatus[sat.id] === "loading" ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Objects (Sensors/Coverage) */}
                  {sat.objects && sat.objects.length > 0 && (
                    <TreeNode
                      key={`${sat.id}-objects`}
                      item={{
                        id: `${sat.id}-objects`,
                        name: `Objects (${sat.objects.length})`,
                        isVisible: undefined,
                      }}
                      icon={Box}
                      level={2}
                    >
                      {sat.objects.map((obj) => (
                        <div
                          key={obj.id}
                          className="flex items-center gap-1 py-1 px-1 rounded cursor-pointer transition-colors text-slate-300 hover:bg-slate-800"
                          style={{ paddingLeft: "68px" }}
                        >
                          <span className="w-4" />
                          <Box 
                            className="w-4 h-4 flex-shrink-0"
                            style={{
                              color: obj.color 
                                ? `rgba(${Math.round(obj.color.r * 255)}, ${Math.round(obj.color.g * 255)}, ${Math.round(obj.color.b * 255)}, 1)` 
                                : undefined,
                            }}
                          />
                          <span className="flex-1 text-sm truncate">
                            {obj.name}
                            {obj.isDefaultCoverage && (
                              <span className="text-xs text-slate-500 ml-1">(Coverage)</span>
                            )}
                          </span>
                          {/* Visibility toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleObjectVisibility(sat.id, obj.id);
                            }}
                            className="p-0.5 hover:bg-slate-700 rounded opacity-60 hover:opacity-100"
                            title={obj.isVisible !== false ? "Hide" : "Show"}
                          >
                            {obj.isVisible !== false ? (
                              <Eye className="w-3 h-3 text-green-400" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-slate-600" />
                            )}
                          </button>
                        </div>
                      ))}
                    </TreeNode>
                  )}

                  {/* Payloads */}
                  {sat.payloads && sat.payloads.length > 0 && (
                    <TreeNode
                      key={`${sat.id}-payloads`}
                      item={{
                        id: `${sat.id}-payloads`,
                        name: `Payloads (${sat.payloads.length})`,
                        isVisible: undefined,
                      }}
                      icon={Box}
                      level={2}
                    >
                      {sat.payloads.map((payload) => (
                        <TreeNode
                          key={payload.id}
                          item={{
                            ...payload,
                            isVisible: undefined,
                          }}
                          icon={payload.type === "camera" ? Camera : Radio}
                          level={3}
                          renderLabel={() => (
                            <span className="flex items-center gap-1">
                              {payload.name}
                              <span className="text-xs text-slate-500">
                                ({payload.type === "camera" ? payload.cameraType?.toUpperCase() || "RGB" : `${payload.frequency || 162} MHz`})
                              </span>
                            </span>
                          )}
                        />
                      ))}
                    </TreeNode>
                  )}

                  {/* Sensors (legacy) */}
                  {sat.sensors?.map((sensor) => (
                    <TreeNode key={sensor.id} item={{ ...sensor, isVisible: sensor.isActive }} icon={Camera} level={2} renderLabel={(item) => `${item.name} (${item.type})`} />
                  ))}
                  {/* Antennas (legacy) */}
                  {sat.antennas?.map((antenna) => (
                    <TreeNode key={antenna.id} item={{ ...antenna, isVisible: antenna.isActive }} icon={Antenna} level={2} renderLabel={(item) => `${item.name}`} />
                  ))}

                  {/* Export Orbit KMZ Button */}
                  <div className="ml-6 mt-1 mb-1">
                    <button
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                        exportStatus[sat.id] === "loading"
                          ? "bg-slate-700 text-slate-400 cursor-wait"
                          : exportStatus[sat.id] === "success"
                          ? "bg-green-600/20 text-green-400 border border-green-600/30"
                          : exportStatus[sat.id] === "error"
                          ? "bg-red-600/20 text-red-400 border border-red-600/30"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/30"
                      }`}
                      onClick={() => handleExportOrbit(sat)}
                      disabled={exportStatus[sat.id] === "loading"}
                      title="Export current orbit to KML for Google Earth"
                    >
                      {exportStatus[sat.id] === "loading" ? (
                        <>
                          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          Exporting...
                        </>
                      ) : exportStatus[sat.id] === "success" ? (
                        <>
                          <FileDown className="w-3 h-3" />
                          Exported!
                        </>
                      ) : exportStatus[sat.id] === "error" ? (
                        <>
                          <FileDown className="w-3 h-3" />
                          Export Failed
                        </>
                      ) : (
                        <>
                          <FileDown className="w-3 h-3" />
                          Export Orbit KML
                        </>
                      )}
                    </button>
                  </div>
                </TreeNode>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ground Stations */}
      <div className="mb-2">
        <div
          className="flex items-center gap-2 py-1.5 px-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-800 border border-slate-700/50"
          onClick={() => toggleCategory("groundStations")}
        >
          {expandedCategories.groundStations ? <FolderOpen className="w-4 h-4 text-orange-400" /> : <Folder className="w-4 h-4 text-orange-400" />}
          <span className="font-medium flex-1 text-slate-200">Ground Stations</span>
          <span className="text-xs text-slate-500">{groundStations.length}</span>
          <button
            className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              openAddGsDialog();
            }}
            title="Add Ground Station"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {expandedCategories.groundStations && (
          <div className="mt-1">
            {groundStations.map((gs) => (
              <TreeNode
                key={gs.id}
                item={gs}
                icon={Radio}
                isSelected={selectedStationId === gs.id}
                onSelect={selectStation}
                onToggleVisibility={toggleStationVisibility}
                onContextMenu={(e, item) => handleContextMenu(e, item, "groundStation")}
                level={1}
              >
                {/* Location info */}
                <TreeNode
                  key={`${gs.id}-loc`}
                  item={{
                    id: `${gs.id}-loc`,
                    name: `${gs.location?.lat?.toFixed(4)}°, ${gs.location?.lon?.toFixed(4)}°`,
                    isVisible: undefined, // No visibility toggle for info
                  }}
                  icon={MapPin}
                  level={2}
                />
                {/* Coverage areas */}
                {gs.coverages?.map((coverage) => {
                  // Get satellite color if this is a satellite tracking coverage
                  let displayColor = coverage.color;
                  let satName = null;
                  if (coverage.type === "satellite" && coverage.satelliteId) {
                    const trackedSat = satellites.find((s) => s.id === coverage.satelliteId);
                    if (trackedSat) {
                      displayColor = trackedSat.color;
                      satName = trackedSat.name;
                    }
                  }

                  return (
                    <TreeNode
                      key={coverage.id}
                      item={{
                        ...coverage,
                        color: displayColor,
                      }}
                      icon={Circle}
                      level={2}
                      onToggleVisibility={() => toggleCoverageVisibility(gs.id, coverage.id)}
                      renderLabel={(item) => (
                        <span className="flex items-center gap-1">
                          {item.name}
                          <span className="text-xs text-slate-500">({item.type === "satellite" ? satName || "Satellite" : `${item.maxRange}km`})</span>
                        </span>
                      )}
                    />
                  );
                })}

                {/* Passes - Access Analysis Results */}
                {gs.passes && gs.passes.length > 0 && (
                  <>
                    <div className="ml-6 mt-1 flex items-center justify-between pr-2">
                      <span className="text-xs text-purple-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Passes ({gs.passes.length})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearPasses(gs.id);
                        }}
                        className="p-0.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                        title="Clear all passes"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {gs.passes.map((pass, passIndex) => {
                      // Format pass label: "Pass #1 - SAT_NAME (AOS time)"
                      const aosDate = new Date(pass.aos?.time);
                      const aosTimeStr = aosDate.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                      const passLabel = `#${passIndex + 1} ${pass.satelliteName || ""}`;
                      const passSubLabel = `AOS ${aosTimeStr} - ${pass.maxElevation?.elevation?.toFixed(0) || "?"}°`;

                      return (
                        <TreeNode
                          key={pass.id}
                          item={{
                            id: pass.id,
                            name: passLabel,
                            isVisible: pass.isVisible,
                            color: pass.color || { r: 0.7, g: 0.3, b: 0.9, a: 1 }, // Purple default
                          }}
                          icon={Clock}
                          level={2}
                          onToggleVisibility={() => togglePassVisibility(gs.id, pass.id)}
                          onDelete={() => removePass(gs.id, pass.id)}
                          renderLabel={() => (
                            <div className="flex flex-col leading-tight">
                              <span className="text-slate-200">{passLabel}</span>
                              <span className="text-xs text-slate-500">{passSubLabel}</span>
                            </div>
                          )}
                        />
                      );
                    })}
                  </>
                )}
              </TreeNode>
            ))}
          </div>
        )}
      </div>

      {/* Target Areas */}
      <div className="mb-2">
        <div
          className="flex items-center gap-2 py-1.5 px-2 bg-slate-800/50 rounded cursor-pointer hover:bg-slate-800 border border-slate-700/50"
          onClick={() => toggleCategory("targetAreas")}
        >
          {expandedCategories.targetAreas ? <FolderOpen className="w-4 h-4 text-green-400" /> : <Folder className="w-4 h-4 text-green-400" />}
          <span className="font-medium flex-1 text-slate-200">Target Areas</span>
          <span className="text-xs text-slate-500">{targetAreas.length}</span>
          <button
            className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Open add target area dialog
            }}
            title="Add Target Area"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {expandedCategories.targetAreas && (
          <div className="mt-1">
            {targetAreas.map((ta) => (
              <TreeNode
                key={ta.id}
                item={ta}
                icon={Target}
                isSelected={selectedAreaId === ta.id}
                onSelect={selectArea}
                onToggleVisibility={toggleAreaVisibility}
                onContextMenu={(e, item) => handleContextMenu(e, item, "targetArea")}
                level={1}
                renderLabel={(item) => `${item.name} (${item.type})`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ground Station Dialog */}
      <GroundStationDialog
        isOpen={gsDialogOpen}
        onClose={() => setGsDialogOpen(false)}
        onSave={handleSaveGroundStation}
        editStation={editingStation}
        title={editingStation ? "Edit Ground Station" : "Add Ground Station"}
      />

      {/* Satellite Dialog */}
      <SatelliteDialog
        isOpen={satDialogOpen}
        onClose={() => setSatDialogOpen(false)}
        onSave={handleSaveSatellite}
        editSatellite={editingSatellite}
        title={editingSatellite ? "Edit Satellite" : "Add Satellite"}
      />
    </div>
  );
};

export default ObjectTree;
