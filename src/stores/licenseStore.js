/**
 * License Store
 * Manages license state and activation flow
 */

import { create } from "zustand";

export const useLicenseStore = create((set, get) => ({
  // State
  isVerifying: true, // Start as verifying on app load
  isActivating: false,
  showActivationDialog: false,
  showBlockedDialog: false,

  // License info
  licenseInfo: null,
  verificationResult: null,

  // Error state
  error: null,

  // Offline/Grace period info
  isOffline: false,
  gracePeriod: null, // { daysRemaining, inGracePeriod }

  // Actions

  /**
   * Verify license on app startup
   */
  verifyLicense: async () => {
    set({ isVerifying: true, error: null });

    try {
      // Check if electronAPI is available
      if (!window.electronAPI?.verifyLicense) {
        console.warn("License verification not available - not running in Electron");
        set({
          isVerifying: false,
          verificationResult: { valid: true, code: "DEV_MODE" },
        });
        return { valid: true };
      }

      const result = await window.electronAPI.verifyLicense();

      // Handle different verification results
      if (result.valid) {
        // License is valid
        set({
          isVerifying: false,
          verificationResult: result,
          licenseInfo: result.license || null,
          isOffline: result.isOffline || false,
          gracePeriod: result.gracePeriod || null,
          showActivationDialog: false,
          showBlockedDialog: false,
        });
      } else if (result.requiresActivation) {
        // Need to show activation dialog
        set({
          isVerifying: false,
          verificationResult: result,
          showActivationDialog: true,
          showBlockedDialog: false,
          error: result.error,
        });
      } else if (result.isBlocked) {
        // License is blocked (expired, revoked, etc.)
        set({
          isVerifying: false,
          verificationResult: result,
          showActivationDialog: false,
          showBlockedDialog: true,
          error: result.error,
        });
      } else {
        // Other error
        set({
          isVerifying: false,
          verificationResult: result,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      console.error("License verification failed:", error);
      set({
        isVerifying: false,
        error: error.message,
        verificationResult: { valid: false, error: error.message },
      });
      return { valid: false, error: error.message };
    }
  },

  /**
   * Activate a license key
   */
  activateLicense: async (licenseKey) => {
    set({ isActivating: true, error: null });

    try {
      if (!window.electronAPI?.activateLicense) {
        throw new Error("License activation not available");
      }

      const result = await window.electronAPI.activateLicense(licenseKey);

      if (result.success) {
        // Activation successful
        set({
          isActivating: false,
          licenseInfo: result.data,
          showActivationDialog: false,
          showBlockedDialog: false,
          verificationResult: { valid: true, code: "VALID" },
        });
        return { success: true, data: result.data };
      } else {
        // Activation failed
        set({
          isActivating: false,
          error: result.error,
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("License activation failed:", error);
      set({
        isActivating: false,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Deactivate license
   */
  deactivateLicense: async () => {
    try {
      if (!window.electronAPI?.deactivateLicense) {
        throw new Error("License deactivation not available");
      }

      const result = await window.electronAPI.deactivateLicense();

      if (result.success) {
        set({
          licenseInfo: null,
          verificationResult: null,
          showActivationDialog: true,
          showBlockedDialog: false,
        });
      }

      return result;
    } catch (error) {
      console.error("License deactivation failed:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Show activation dialog
   */
  openActivationDialog: () => {
    set({ showActivationDialog: true, error: null });
  },

  /**
   * Close activation dialog (only if license is valid)
   */
  closeActivationDialog: () => {
    const { verificationResult } = get();
    if (verificationResult?.valid) {
      set({ showActivationDialog: false });
    }
  },

  /**
   * Clear error
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * Get license info from main process
   */
  fetchLicenseInfo: async () => {
    try {
      if (!window.electronAPI?.getLicenseInfo) {
        return null;
      }

      const result = await window.electronAPI.getLicenseInfo();
      if (result.success && result.data) {
        set({ licenseInfo: result.data });
        return result.data;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch license info:", error);
      return null;
    }
  },

  /**
   * Check if app should be blocked
   */
  isAppBlocked: () => {
    const { verificationResult, showBlockedDialog } = get();
    return showBlockedDialog || (verificationResult && !verificationResult.valid && verificationResult.isBlocked);
  },

  /**
   * Check if app needs activation
   */
  needsActivation: () => {
    const { verificationResult, showActivationDialog } = get();
    return showActivationDialog || (verificationResult && verificationResult.requiresActivation);
  },

  /**
   * Reset store
   */
  reset: () => {
    set({
      isVerifying: false,
      isActivating: false,
      showActivationDialog: false,
      showBlockedDialog: false,
      licenseInfo: null,
      verificationResult: null,
      error: null,
      isOffline: false,
      gracePeriod: null,
    });
  },
}));
