/**
 * LicenseBlockedDialog Component
 * Modal dialog shown when license is blocked (expired, revoked, deactivated)
 */

import React from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  ExternalLink,
  WifiOff,
} from "lucide-react";

/**
 * Get icon and color based on block code
 */
function getBlockInfo(code) {
  switch (code) {
    case "EXPIRED":
      return {
        icon: Clock,
        color: "red",
        title: "License Expired",
        description: "Your license has expired. Please renew to continue using the application.",
      };
    case "REVOKED":
      return {
        icon: Ban,
        color: "red",
        title: "License Revoked",
        description: "Your license has been revoked. Please contact support for assistance.",
      };
    case "DEACTIVATED":
      return {
        icon: XCircle,
        color: "orange",
        title: "Device Deactivated",
        description: "This device has been deactivated. Please reactivate or contact support.",
      };
    case "NOT_FOUND":
      return {
        icon: AlertTriangle,
        color: "orange",
        title: "License Not Found",
        description: "Your license key was not found in our system. Please verify your license.",
      };
    case "OFFLINE_EXPIRED":
      return {
        icon: WifiOff,
        color: "orange",
        title: "Offline Period Expired",
        description: "You have been offline too long. Please connect to the internet to verify your license.",
      };
    default:
      return {
        icon: Ban,
        color: "red",
        title: "License Invalid",
        description: "Your license is invalid. Please contact support for assistance.",
      };
  }
}

/**
 * License Blocked Dialog
 * Shows when license is blocked - cannot be dismissed
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is open
 * @param {string} props.code - Block reason code
 * @param {string} props.error - Error message
 * @param {string} props.expiredAt - Expiry date if applicable
 * @param {Function} props.onRetry - Callback to retry verification
 * @param {Function} props.onReactivate - Callback to show activation dialog
 */
export default function LicenseBlockedDialog({
  isOpen,
  code = "INVALID",
  error = "",
  expiredAt = null,
  onRetry,
  onReactivate,
}) {
  if (!isOpen) return null;

  const blockInfo = getBlockInfo(code);
  const IconComponent = blockInfo.icon;
  const isRed = blockInfo.color === "red";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop - no click to close */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-lg mx-4 rounded-xl shadow-2xl border ${
          isRed
            ? "bg-red-950/95 border-red-700"
            : "bg-orange-950/95 border-orange-700"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b ${
            isRed ? "border-red-800" : "border-orange-800"
          }`}
        >
          <div
            className={`p-2 rounded-full ${
              isRed ? "bg-red-900/50" : "bg-orange-900/50"
            }`}
          >
            <IconComponent
              className={`w-6 h-6 ${isRed ? "text-red-400" : "text-orange-400"}`}
            />
          </div>
          <div className="flex-1">
            <h2
              className={`text-lg font-semibold ${
                isRed ? "text-red-300" : "text-orange-300"
              }`}
            >
              {blockInfo.title}
            </h2>
            <p className="text-sm text-slate-400">{blockInfo.description}</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Error Details */}
          <div
            className={`p-4 rounded-lg border ${
              isRed
                ? "bg-red-900/30 border-red-800/50"
                : "bg-orange-900/30 border-orange-800/50"
            }`}
          >
            <p className={`text-sm ${isRed ? "text-red-200" : "text-orange-200"}`}>
              {error || blockInfo.description}
            </p>
            {expiredAt && (
              <p className="text-xs text-slate-400 mt-2">
                Expired: {new Date(expiredAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* What to do */}
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              What you can do
            </p>

            {code === "OFFLINE_EXPIRED" ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                <WifiOff className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-300">Connect to Internet</p>
                  <p className="text-xs text-slate-500">
                    Ensure you have an internet connection and retry verification.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                  <RefreshCw className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-300">Enter a New License Key</p>
                    <p className="text-xs text-slate-500">
                      If you have a valid license key, you can activate it.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
                  <Mail className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-300">Contact Support</p>
                    <p className="text-xs text-slate-500">
                      Get help with your license at support@example.com
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex gap-3 px-6 py-4 border-t ${
            isRed ? "border-red-800" : "border-orange-800"
          }`}
        >
          {code === "OFFLINE_EXPIRED" ? (
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Verification
            </button>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Retry
              </button>
              <button
                onClick={onReactivate}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  isRed
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-orange-600 hover:bg-orange-500 text-white"
                }`}
              >
                Enter New License
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
