/**
 * Sidebar Component
 * Left sidebar with collapse/extend toggle and object tree
 */

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Layers, FileText, Settings, PanelLeftClose, PanelLeft, Download, Upload, Check, X, Loader2, FilePlus2, Trash2 } from "lucide-react";

import ObjectTree from "./ObjectTree";
import { useScenarioStore, useSatelliteStore, useGroundStationStore, useTimeStore } from "../../stores";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("objects"); // 'objects' | 'properties' | 'settings'
  const [backupStatus, setBackupStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // null | 'new' | 'clear'

  const scenarioName = useScenarioStore((state) => state.name);
  const scenarioDescription = useScenarioStore((state) => state.description);

  // New Scenario handler
  const handleNewScenario = () => {
    setConfirmAction("new");
  };

  // Clear Configuration handler
  const handleClearConfig = () => {
    setConfirmAction("clear");
  };

  // Confirm action handler
  const handleConfirmAction = () => {
    if (confirmAction === "new") {
      // Clear localStorage first to ensure complete removal
      localStorage.removeItem("satellite-storage");
      localStorage.removeItem("ground-station-storage");
      localStorage.removeItem("scenario-storage");
      localStorage.removeItem("target-area-storage");

      // Reset scenario to default name, but empty satellites and ground stations
      useScenarioStore.getState().newScenario();
      useSatelliteStore.setState({ satellites: [], selectedSatelliteId: null, positions: {} });
      useGroundStationStore.setState({ groundStations: [], selectedStationId: null });
      useTimeStore.getState().reset();

      setBackupStatus("success");
      setStatusMessage("New scenario created!");
    } else if (confirmAction === "clear") {
      // Clear localStorage first to ensure complete removal
      localStorage.removeItem("satellite-storage");
      localStorage.removeItem("ground-station-storage");
      localStorage.removeItem("scenario-storage");
      localStorage.removeItem("target-area-storage");

      // Clear all data (empty state)
      useScenarioStore.getState().newScenario();
      useSatelliteStore.setState({ satellites: [], selectedSatelliteId: null, positions: {} });
      useGroundStationStore.setState({ groundStations: [], selectedStationId: null });
      useTimeStore.getState().reset();

      setBackupStatus("success");
      setStatusMessage("Configuration cleared!");
    }

    setConfirmAction(null);

    // Clear status after 3 seconds
    setTimeout(() => {
      setBackupStatus(null);
      setStatusMessage("");
    }, 3000);
  };

  // Cancel confirm
  const handleCancelConfirm = () => {
    setConfirmAction(null);
  };

  // Backup handler
  const handleBackup = async () => {
    setBackupStatus("loading");
    setStatusMessage("Backing up...");

    try {
      // Get scenario name for filename
      const currentScenarioName = useScenarioStore.getState().name || "Untitled";

      // Collect all configuration data from stores
      const configData = {
        scenario: useScenarioStore.getState().exportData(),
        satellites: {
          satellites: useSatelliteStore.getState().satellites,
          selectedSatelliteId: useSatelliteStore.getState().selectedSatelliteId,
        },
        groundStations: {
          groundStations: useGroundStationStore.getState().groundStations,
          selectedStationId: useGroundStationStore.getState().selectedStationId,
        },
        time: {
          mode: useTimeStore.getState().mode,
          playbackSpeed: useTimeStore.getState().playbackSpeed,
        },
      };

      const result = await window.electronAPI.backupConfig(configData, currentScenarioName);

      if (result.success) {
        setBackupStatus("success");
        setStatusMessage("Backup saved!");
      } else {
        setBackupStatus("error");
        setStatusMessage(result.error || "Backup failed");
      }
    } catch (error) {
      setBackupStatus("error");
      setStatusMessage(error.message);
    }

    // Clear status after 3 seconds
    setTimeout(() => {
      setBackupStatus(null);
      setStatusMessage("");
    }, 3000);
  };

  // Restore handler
  const handleRestore = async () => {
    setBackupStatus("loading");
    setStatusMessage("Restoring...");

    try {
      const result = await window.electronAPI.restoreConfig();

      if (result.success && result.data) {
        const { scenario, satellites, groundStations, time } = result.data;

        // Restore scenario
        if (scenario) {
          useScenarioStore.getState().importData(scenario);
        }

        // Restore satellites
        if (satellites?.satellites) {
          useSatelliteStore.setState({
            satellites: satellites.satellites,
            selectedSatelliteId: satellites.selectedSatelliteId || satellites.satellites[0]?.id,
          });
        }

        // Restore ground stations
        if (groundStations?.groundStations) {
          useGroundStationStore.setState({
            groundStations: groundStations.groundStations,
            selectedStationId: groundStations.selectedStationId,
          });
        }

        // Restore time settings
        if (time) {
          if (time.mode) useTimeStore.getState().setMode(time.mode);
          if (time.playbackSpeed) useTimeStore.getState().setPlaybackSpeed(time.playbackSpeed);
        }

        setBackupStatus("success");
        setStatusMessage("Restored successfully!");
      } else {
        setBackupStatus("error");
        setStatusMessage(result.error || "Restore failed");
      }
    } catch (error) {
      setBackupStatus("error");
      setStatusMessage(error.message);
    }

    // Clear status after 3 seconds
    setTimeout(() => {
      setBackupStatus(null);
      setStatusMessage("");
    }, 3000);
  };

  const tabs = [
    { id: "objects", icon: Layers, label: "Objects" },
    { id: "properties", icon: FileText, label: "Properties" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className={`h-full flex flex-col bg-slate-900/95 backdrop-blur-sm border-r border-slate-700 transition-all duration-300 shadow-xl ${isCollapsed ? "w-10" : "w-72"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/50 min-h-[40px]">
        {!isCollapsed && (
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-sm font-semibold text-slate-200 truncate">{scenarioName}</h2>
            {scenarioDescription && <p className="text-[10px] text-slate-500 truncate">{scenarioDescription}</p>}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex ${isCollapsed ? "flex-col" : ""} border-b border-slate-700 bg-slate-800/30`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 p-2 transition-colors ${isCollapsed ? "justify-center" : "flex-1 justify-center"} ${
              activeTab === tab.id ? "bg-slate-700/50 text-blue-400 border-b-2 border-blue-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
            title={tab.label}
          >
            <tab.icon className="w-4 h-4" />
            {!isCollapsed && <span className="text-xs font-medium">{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {activeTab === "objects" && <ObjectTree />}

          {activeTab === "properties" && (
            <div className="text-sm text-slate-500 text-center py-8">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select an object to view properties</p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="text-sm space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Scenario Name</label>
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:border-blue-500 focus:outline-none"
                  value={scenarioName}
                  onChange={(e) => useScenarioStore.getState().setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:border-blue-500 focus:outline-none resize-none"
                  rows={3}
                  value={scenarioDescription}
                  onChange={(e) => useScenarioStore.getState().setDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed state - show active tab icon */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4">
          {activeTab === "objects" && <Layers className="w-4 h-4 text-blue-400" />}
          {activeTab === "properties" && <FileText className="w-4 h-4 text-blue-400" />}
          {activeTab === "settings" && <Settings className="w-4 h-4 text-blue-400" />}
        </div>
      )}

      {/* Floating Backup/Restore Buttons */}
      <div className={`border-t border-slate-700 bg-slate-800/50 ${isCollapsed ? "p-1" : "p-2"}`}>
        {/* Confirm Dialog */}
        {confirmAction && !isCollapsed && (
          <div className="mb-2 p-2 rounded bg-amber-600/20 border border-amber-600/30">
            <p className="text-xs text-amber-400 mb-2">
              {confirmAction === "new" ? "Create new scenario? This will reset to defaults." : "Clear all configuration? This cannot be undone."}
            </p>
            <div className="flex gap-1">
              <button onClick={handleConfirmAction} className="flex-1 px-2 py-1 rounded text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors">
                Confirm
              </button>
              <button onClick={handleCancelConfirm} className="flex-1 px-2 py-1 rounded text-xs font-medium bg-slate-600 hover:bg-slate-500 text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {backupStatus && !isCollapsed && !confirmAction && (
          <div
            className={`mb-2 px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
              backupStatus === "loading" ? "bg-blue-600/20 text-blue-400" : backupStatus === "success" ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
            }`}
          >
            {backupStatus === "loading" && <Loader2 className="w-3 h-3 animate-spin" />}
            {backupStatus === "success" && <Check className="w-3 h-3" />}
            {backupStatus === "error" && <X className="w-3 h-3" />}
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        {/* Action Buttons - Row 1: New & Clear */}
        <div className={`flex ${isCollapsed ? "flex-col" : ""} gap-1 mb-1`}>
          <button
            onClick={handleNewScenario}
            disabled={backupStatus === "loading" || confirmAction !== null}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
              bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-600/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isCollapsed ? "w-full" : "flex-1"}`}
            title="New Scenario"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            {!isCollapsed && <span>New</span>}
          </button>
          <button
            onClick={handleClearConfig}
            disabled={backupStatus === "loading" || confirmAction !== null}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
              bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isCollapsed ? "w-full" : "flex-1"}`}
            title="Clear Configuration"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Clear</span>}
          </button>
        </div>

        {/* Action Buttons - Row 2: Backup & Restore */}
        <div className={`flex ${isCollapsed ? "flex-col" : ""} gap-1`}>
          <button
            onClick={handleBackup}
            disabled={backupStatus === "loading" || confirmAction !== null}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
              bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isCollapsed ? "w-full" : "flex-1"}`}
            title="Backup Configuration"
          >
            <Download className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Backup</span>}
          </button>
          <button
            onClick={handleRestore}
            disabled={backupStatus === "loading" || confirmAction !== null}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
              bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isCollapsed ? "w-full" : "flex-1"}`}
            title="Restore Configuration"
          >
            <Upload className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Restore</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
