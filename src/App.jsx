/**
 * App.jsx
 * Main application entry point - Layout orchestrator with tabbed content
 */

import React, { useState, useEffect } from "react";

// Layout components
import { TopNavbar, BottomNavbar } from "./components/layout";

// Globe components
import { Globe2D } from "./components/globe";

// Sidebar components
import { Sidebar } from "./components/sidebar";

// Panels
import { PropertiesPanel } from "./components/panels";

// UI components
import { UpdateRequiredDialog } from "./components/ui";

// Stores
import { useSatelliteStore, useVersionStore } from "./stores";

/**
 * Main App Component
 */
export default function App() {
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lon: 0 });

  // Stores
  const satellites = useSatelliteStore((state) => state.satellites);

  // Version check store
  const {
    showDialog,
    updateInfo,
    checkForUpdates,
    dismissDialog,
    openDownloadPage,
  } = useVersionStore();

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  // If blocked, only show update dialog
  if (updateInfo.isBlocked && updateInfo.hasUpdate) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
        <UpdateRequiredDialog
          isOpen={true}
          updateInfo={updateInfo}
          onDismiss={dismissDialog}
          onDownload={openDownloadPage}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Update Dialog */}
      <UpdateRequiredDialog
        isOpen={showDialog}
        updateInfo={updateInfo}
        onDismiss={dismissDialog}
        onDownload={openDownloadPage}
      />

      {/* TOP MENU */}
      <TopNavbar />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        {/* MAIN CONTENT with Tabs - Starts after collapsed sidebar width (40px) */}
        <div className="absolute left-10 top-0 right-0 bottom-0 flex flex-col z-10">
          <PropertiesPanel globeComponent={<Globe2D onMouseMove={setCursorCoords} />} />
        </div>

        {/* LEFT SIDEBAR - Floating over content */}
        <div className="absolute left-0 top-0 bottom-0 z-20">
          <Sidebar />
        </div>
      </div>

      {/* BOTTOM MENU */}
      <BottomNavbar cursorCoords={cursorCoords} activeSatellite={satellites.length > 0} />
    </div>
  );
}
