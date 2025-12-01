/**
 * LicenseActivationDialog Component
 * Modal dialog for entering and activating license key
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Key,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  Monitor,
  Cpu,
  Network,
  Globe,
  Copy,
  Check,
} from "lucide-react";

/**
 * License Activation Dialog
 * Shows on first run or when license is invalid
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is open
 * @param {boolean} props.isActivating - Whether activation is in progress
 * @param {string} props.error - Error message if any
 * @param {Function} props.onActivate - Callback with license key
 * @param {Function} props.onClose - Callback to close (only if license valid)
 * @param {boolean} props.canClose - Whether dialog can be closed
 */
export default function LicenseActivationDialog({
  isOpen,
  isActivating = false,
  error = null,
  onActivate,
  onClose,
  canClose = false,
}) {
  const [licenseKey, setLicenseKey] = useState("");
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [showHardwareInfo, setShowHardwareInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Fetch hardware info on mount
  useEffect(() => {
    if (isOpen && window.electronAPI?.getHardwareInfo) {
      window.electronAPI.getHardwareInfo().then((result) => {
        if (result.success) {
          setHardwareInfo(result.data);
        }
      });
    }
  }, [isOpen]);

  // Format license key as user types
  const handleKeyChange = (e) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Insert dashes every 4 characters
    if (value.length > 0) {
      const parts = [];
      for (let i = 0; i < value.length && i < 16; i += 4) {
        parts.push(value.slice(i, i + 4));
      }
      value = parts.join("-");
    }

    setLicenseKey(value);
    setLocalError(null);
  };

  // Handle activation
  const handleActivate = async () => {
    if (!licenseKey || licenseKey.length < 19) {
      setLocalError("Please enter a valid license key");
      return;
    }

    if (onActivate) {
      onActivate(licenseKey);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !isActivating) {
      handleActivate();
    }
  };

  // Copy hardware fingerprint
  const copyFingerprint = () => {
    if (hardwareInfo?.fingerprint) {
      navigator.clipboard.writeText(hardwareInfo.fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  const displayError = error || localError;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={canClose ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl shadow-2xl bg-slate-900/95 border border-slate-700">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
          <div className="p-2 rounded-full bg-cyan-900/50">
            <Key className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">License Activation</h2>
            <p className="text-sm text-slate-400">
              Enter your license key to activate STK Satellite
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* License Key Input */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              License Key
            </label>
            <div className="relative">
              <input
                type="text"
                value={licenseKey}
                onChange={handleKeyChange}
                onKeyPress={handleKeyPress}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                maxLength={19}
                disabled={isActivating}
                className={`w-full px-4 py-3 rounded-lg bg-slate-800 border text-white font-mono text-lg tracking-wider text-center
                  focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors
                  ${displayError ? "border-red-500" : "border-slate-600"}
                  ${isActivating ? "opacity-50 cursor-not-allowed" : ""}
                `}
              />
              {isActivating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Format: XXXX-XXXX-XXXX-XXXX
            </p>
          </div>

          {/* Error Message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-200">{displayError}</p>
            </div>
          )}

          {/* Hardware Info Toggle */}
          <button
            onClick={() => setShowHardwareInfo(!showHardwareInfo)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <Monitor className="w-4 h-4" />
            {showHardwareInfo ? "Hide" : "Show"} Device Information
          </button>

          {/* Hardware Info Panel */}
          {showHardwareInfo && hardwareInfo && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Device Fingerprint
                </span>
                <button
                  onClick={copyFingerprint}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  {copied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs font-mono text-slate-400 break-all">
                {hardwareInfo.fingerprint}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-400 truncate">
                    {hardwareInfo.cpuModel?.split(" ").slice(0, 3).join(" ") || "Unknown CPU"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-400">
                    {hardwareInfo.hostname}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-400">
                    {hardwareInfo.macAddress || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-400">
                    {hardwareInfo.publicIp || hardwareInfo.localIp || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
            <Shield className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-500">
              <p>Your license key is linked to this device's hardware.</p>
              <p className="mt-1">
                If you need to transfer your license to another device, please
                deactivate it first.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          {canClose && (
            <button
              onClick={onClose}
              disabled={isActivating}
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleActivate}
            disabled={isActivating || licenseKey.length < 19}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors
              ${
                isActivating || licenseKey.length < 19
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-500 text-white"
              }
            `}
          >
            {isActivating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Activate License
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
