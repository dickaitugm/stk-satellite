/**
 * Version Store
 * Manages version check state and update notifications
 */

import { create } from "zustand";

export const useVersionStore = create((set, get) => ({
  // State
  isChecking: false,
  hasChecked: false,
  showDialog: false,
  updateInfo: {
    hasUpdate: false,
    currentVersion: "",
    latestVersion: "",
    releaseUrl: "",
    releaseNotes: "",
    publishedAt: "",
    daysRemaining: 7,
    isBlocked: false,
    error: null,
  },

  // Actions
  checkForUpdates: async () => {
    // Prevent multiple simultaneous checks
    if (get().isChecking) return;

    set({ isChecking: true });

    try {
      // Check if electronAPI is available (running in Electron)
      if (!window.electronAPI?.checkForUpdates) {
        console.warn("Version check not available - not running in Electron");
        set({
          isChecking: false,
          hasChecked: true,
          updateInfo: {
            ...get().updateInfo,
            hasUpdate: false,
            error: "Not running in Electron",
          },
        });
        return;
      }

      const result = await window.electronAPI.checkForUpdates();

      if (result.success) {
        set({
          isChecking: false,
          hasChecked: true,
          showDialog: result.hasUpdate,
          updateInfo: {
            hasUpdate: result.hasUpdate,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            releaseUrl: result.releaseUrl || "",
            releaseNotes: result.releaseNotes || "",
            publishedAt: result.publishedAt || "",
            daysRemaining: result.daysRemaining ?? 7,
            isBlocked: result.isBlocked || false,
            error: null,
          },
        });
      } else {
        // API call failed, but allow app to continue
        set({
          isChecking: false,
          hasChecked: true,
          showDialog: false,
          updateInfo: {
            ...get().updateInfo,
            hasUpdate: false,
            error: result.error,
          },
        });
      }
    } catch (error) {
      console.error("Version check failed:", error);
      set({
        isChecking: false,
        hasChecked: true,
        showDialog: false,
        updateInfo: {
          ...get().updateInfo,
          hasUpdate: false,
          error: error.message,
        },
      });
    }
  },

  // Dismiss dialog (only works if not blocked)
  dismissDialog: () => {
    const { updateInfo } = get();
    if (!updateInfo.isBlocked) {
      set({ showDialog: false });
    }
  },

  // Open download page in browser
  openDownloadPage: async () => {
    const { updateInfo } = get();
    if (updateInfo.releaseUrl && window.electronAPI?.openReleasePage) {
      await window.electronAPI.openReleasePage(updateInfo.releaseUrl);
    }
  },

  // Reset store (for testing)
  reset: () =>
    set({
      isChecking: false,
      hasChecked: false,
      showDialog: false,
      updateInfo: {
        hasUpdate: false,
        currentVersion: "",
        latestVersion: "",
        releaseUrl: "",
        releaseNotes: "",
        publishedAt: "",
        daysRemaining: 7,
        isBlocked: false,
        error: null,
      },
    }),
}));
