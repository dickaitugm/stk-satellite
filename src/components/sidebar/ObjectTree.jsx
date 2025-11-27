/**
 * ObjectTree Component
 * Tree view for satellites, ground stations, target areas
 */

import React, { useState } from "react";
import { Satellite, Radio, Target, Plus, FolderOpen, Folder, Camera, Compass, Antenna, Edit, Circle, MapPin, Orbit, Settings2, Box, FileDown } from "lucide-react";

import TreeNode from "./TreeNode";
import ContextMenu from "./ContextMenu";
import { GroundStationDialog, SatelliteDialog } from "../ui";

import { useSatelliteStore, useGroundStationStore, useTargetAreaStore, useTimeStore } from "../../stores";

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

  // Close context menu
  const closeContextMenu = () => setContextMenu(null);

  // Handle export orbit to KMZ
  const handleExportOrbit = async (sat) => {
    if (exportStatus[sat.id] === "loading") return; // Prevent multiple exports

    setExportStatus((prev) => ({ ...prev, [sat.id]: "loading" }));

    try {
      // Get current time
      const currentTime = useTimeStore.getState().currentTime;

      // Generate orbit path (100 points for one orbit)
      const result = await window.electronAPI.generateOrbitPath(sat.tle, currentTime.getTime(), 100);

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
        openEditSatDialog(sat);
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
        openEditGsDialog(gs);
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
                  {/* Orbit Elements */}
                  <TreeNode
                    key={`${sat.id}-orbit`}
                    item={{
                      id: `${sat.id}-orbit`,
                      name: "Orbit Elements",
                      isVisible: undefined,
                    }}
                    icon={Orbit}
                    level={2}
                    renderLabel={() => (
                      <span className="flex items-center gap-1">
                        Orbit Elements
                        <span className="text-xs text-slate-500">({sat.orbitSource === "keplerian" ? "Keplerian" : "TLE"})</span>
                      </span>
                    )}
                  />

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
                          Export Orbit KMl
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
