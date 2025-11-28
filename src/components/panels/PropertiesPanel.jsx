/**
 * PropertiesPanel Component
 * Dynamic tabbed panel for displaying entity properties
 * Positioned at bottom-right, above the bottom navbar
 */

import React, { useState, useEffect, useRef } from "react";
import { X, Satellite, Radio, Minimize2, Maximize2, GripVertical } from "lucide-react";
import { useTabsStore } from "../../stores";
import GroundStationPropertiesTab from "./GroundStationPropertiesTab";
import SatellitePropertiesTab from "./SatellitePropertiesTab";

const PropertiesPanel = ({ sidebarWidth = 288 }) => {
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const removeTab = useTabsStore((state) => state.removeTab);

  // Panel state
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelHeight, setPanelHeight] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const resizeRef = useRef(null);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const windowHeight = window.innerHeight;
      const navbarHeight = 56 + 32; // TopNavbar (h-14) + BottomNavbar (h-8)
      const maxHeight = windowHeight - navbarHeight - 50;
      const minHeight = 150;

      // Calculate new height based on mouse position from bottom
      const bottomNavHeight = 32;
      const newHeight = windowHeight - e.clientY - bottomNavHeight;

      setPanelHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Don't render if no tabs
  if (tabs.length === 0) {
    return null;
  }

  // Get active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  // Handle tab close
  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  // Handle close all
  const handleCloseAll = () => {
    tabs.forEach((tab) => removeTab(tab.id));
  };

  return (
    <div
      ref={panelRef}
      className="absolute z-30 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-t-lg shadow-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        bottom: 32, // Above BottomNavbar (h-8)
        left: sidebarWidth + 8, // Right of sidebar with gap
        right: 8,
        height: isMinimized ? 36 : panelHeight,
        maxWidth: 600,
      }}
    >
      {/* Resize Handle */}
      {!isMinimized && (
        <div
          ref={resizeRef}
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize flex items-center justify-center bg-slate-800/50 hover:bg-cyan-500/30 transition-colors"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="w-8 h-1 rounded-full bg-slate-600" />
        </div>
      )}

      {/* Tab Headers */}
      <div className="flex items-center bg-slate-800/80 border-b border-slate-700 min-h-[36px]">
        {/* Tabs */}
        <div className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-slate-600">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const Icon = tab.type === "satellite" ? Satellite : Radio;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-all border-b-2 ${
                  isActive ? "bg-slate-700/50 text-white border-cyan-400" : "text-slate-400 hover:text-white hover:bg-slate-700/30 border-transparent"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (tab.type === "satellite" ? "text-cyan-400" : "text-orange-400") : "text-slate-500"}`} />
                <span className="max-w-[120px] truncate">{tab.title}</span>
                <button onClick={(e) => handleCloseTab(e, tab.id)} className="ml-1 p-0.5 rounded hover:bg-slate-600 opacity-60 hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </button>
            );
          })}
        </div>

        {/* Panel Controls */}
        <div className="flex items-center gap-0.5 px-2 border-l border-slate-700">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleCloseAll} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Close All">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {!isMinimized && activeTab && (
        <div className="flex-1 overflow-hidden">
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
  );
};

export default PropertiesPanel;
