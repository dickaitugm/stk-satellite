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
import {
  UpdateRequiredDialog,
  LicenseActivationDialog,
  LicenseBlockedDialog,
} from "./components/ui";

// Stores
import { useSatelliteStore, useVersionStore, useLicenseStore } from "./stores";

// Loading Screen Component
function LoadingScreen({ message = "Verifying license..." }) {
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">{message}</p>
      </div>
    </div>
  );
}

// Offline Warning Banner
function OfflineWarning({ gracePeriod }) {
  if (!gracePeriod) return null;

  return (
    <div className="bg-amber-900/80 border-b border-amber-700 px-4 py-2 text-center">
      <p className="text-sm text-amber-200">
        ⚠️ Offline mode: {gracePeriod.daysRemaining} days remaining to verify license
      </p>
    </div>
  );
}

/**
 * Main App Component
 */
export default function App() {
  const [cursorCoords, setCursorCoords] = useState({ lat: 0, lon: 0 });

  // Stores
  const satellites = useSatelliteStore((state) => state.satellites);

  // License store
  const {
    isVerifying,
    isActivating,
    showActivationDialog,
    showBlockedDialog,
    verificationResult,
    error: licenseError,
    isOffline,
    gracePeriod,
    verifyLicense,
    activateLicense,
    closeActivationDialog,
  } = useLicenseStore();

  // Version check store
  const {
    showDialog: showUpdateDialog,
    updateInfo,
    checkForUpdates,
    dismissDialog: dismissUpdateDialog,
    openDownloadPage,
  } = useVersionStore();

  // Verify license on mount (before version check)
  useEffect(() => {
    verifyLicense();
  }, [verifyLicense]);

  // Check for updates after license is verified
  useEffect(() => {
    if (!isVerifying && verificationResult?.valid) {
      checkForUpdates();
    }
  }, [isVerifying, verificationResult?.valid, checkForUpdates]);

  // Handle license activation
  const handleActivate = async (licenseKey) => {
    const result = await activateLicense(licenseKey);
    if (result.success) {
      // Re-verify and check for updates
      await verifyLicense();
      checkForUpdates();
    }
  };

  // Handle retry verification
  const handleRetryVerification = () => {
    verifyLicense();
  };

  // Handle reactivate (show activation dialog from blocked state)
  const handleReactivate = () => {
    useLicenseStore.setState({
      showBlockedDialog: false,
      showActivationDialog: true,
    });
  };

  // Show loading while verifying license
  if (isVerifying) {
    return <LoadingScreen message="Verifying license..." />;
  }

  // Show blocked dialog if license is blocked
  if (showBlockedDialog && verificationResult) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
        <LicenseBlockedDialog
          isOpen={true}
          code={verificationResult.code}
          error={verificationResult.error}
          expiredAt={verificationResult.expiredAt}
          onRetry={handleRetryVerification}
          onReactivate={handleReactivate}
        />
      </div>
    );
  }

  // Show activation dialog if license requires activation
  if (showActivationDialog) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
        <LicenseActivationDialog
          isOpen={true}
          isActivating={isActivating}
          error={licenseError}
          onActivate={handleActivate}
          onClose={closeActivationDialog}
          canClose={verificationResult?.valid || false}
        />
      </div>
    );
  }

  // If version update blocked, only show update dialog
  if (updateInfo.isBlocked && updateInfo.hasUpdate) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
        <UpdateRequiredDialog
          isOpen={true}
          updateInfo={updateInfo}
          onDismiss={dismissUpdateDialog}
          onDownload={openDownloadPage}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Offline Warning Banner */}
      {isOffline && <OfflineWarning gracePeriod={gracePeriod} />}

      {/* Update Dialog */}
      <UpdateRequiredDialog
        isOpen={showUpdateDialog}
        updateInfo={updateInfo}
        onDismiss={dismissUpdateDialog}
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
