/**
 * PropertiesPanel Component
 * Full-screen tabbed panel for Globe and entity properties
 * Tab headers positioned at bottom
 */

import React from "react";
import { X, Satellite, Radio, Globe } from "lucide-react";
import { useTabsStore } from "../../stores";
import GroundStationPropertiesTab from "./GroundStationPropertiesTab";
import SatellitePropertiesTab from "./SatellitePropertiesTab";

const PropertiesPanel = ({ globeComponent }) => {
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const removeTab = useTabsStore((state) => state.removeTab);

  // Get active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const isGlobeActive = activeTab?.type === "globe";

  // Handle tab close
  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  // Get icon for tab type
  const getTabIcon = (type) => {
    switch (type) {
      case "globe":
        return Globe;
      case "satellite":
        return Satellite;
      case "groundStation":
        return Radio;
      default:
        return Globe;
    }
  };

  // Get icon color for tab type
  const getTabIconColor = (type, isActive) => {
    if (!isActive) return "text-slate-500";
    switch (type) {
      case "globe":
        return "text-blue-400";
      case "satellite":
        return "text-cyan-400";
      case "groundStation":
        return "text-orange-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Main Content Area - Full height */}
      <div className="flex-1 overflow-hidden relative bg-slate-950">
        {/* Globe View - shown when globe tab is active */}
        {isGlobeActive && globeComponent}

        {/* Properties Content - shown when other tabs are active */}
        {!isGlobeActive && activeTab && (
          <div className="h-full overflow-hidden bg-slate-900">
            {activeTab.type === "satellite" ? (
              <SatellitePropertiesTab satelliteId={activeTab.entityId} />
            ) : activeTab.type === "groundStation" ? (
              <GroundStationPropertiesTab stationId={activeTab.entityId} />
            ) : (
              <div className="p-4 text-center text-slate-400">Unknown tab type</div>
            )}
          </div>
        )}
      </div>

      {/* Tab Bar - Fixed at bottom */}
      <div className="flex items-center bg-slate-800 border-t border-slate-700 min-h-[32px]">
        {/* Tabs */}
        <div className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = getTabIcon(tab.type);
            const iconColor = getTabIconColor(tab.type, isActive);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap transition-all border-t-2 ${
                  isActive ? "bg-slate-700/50 text-white border-cyan-400" : "text-slate-400 hover:text-white hover:bg-slate-700/30 border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                <span className="max-w-[120px] truncate">{tab.title}</span>
                {/* Close button - only for non-main tabs */}
                {!tab.isMain && (
                  <button onClick={(e) => handleCloseTab(e, tab.id)} className="ml-1 p-0.5 rounded hover:bg-slate-600 opacity-60 hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
