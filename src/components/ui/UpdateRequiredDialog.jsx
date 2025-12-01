/**
 * UpdateRequiredDialog Component
 * Modal dialog for showing update notifications with grace period
 */

import React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Download,
  X,
  Clock,
  Shield,
  RefreshCw,
  ExternalLink,
  Ban,
} from "lucide-react";

/**
 * Update Required Dialog
 * Shows warning or blocking modal based on grace period status
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether dialog is open
 * @param {Object} props.updateInfo - Update information from version store
 * @param {Function} props.onDismiss - Callback to dismiss dialog (only works if not blocked)
 * @param {Function} props.onDownload - Callback to open download page
 */
export default function UpdateRequiredDialog({
  isOpen,
  updateInfo,
  onDismiss,
  onDownload,
}) {
  if (!isOpen) return null;

  const {
    currentVersion,
    latestVersion,
    releaseNotes,
    daysRemaining,
    isBlocked,
  } = updateInfo;

  // Format release notes (first 500 chars)
  const formattedNotes = releaseNotes
    ? releaseNotes.length > 500
      ? releaseNotes.substring(0, 500) + "..."
      : releaseNotes
    : "No release notes available.";

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${
          isBlocked
            ? "bg-black/80 backdrop-blur-md"
            : "bg-black/60 backdrop-blur-sm"
        }`}
        onClick={isBlocked ? undefined : onDismiss}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-lg mx-4 rounded-xl shadow-2xl border ${
          isBlocked
            ? "bg-red-950/95 border-red-700"
            : "bg-slate-900/95 border-amber-600"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-6 py-4 border-b ${
            isBlocked ? "border-red-800" : "border-amber-700/50"
          }`}
        >
          <div
            className={`p-2 rounded-full ${
              isBlocked ? "bg-red-900/50" : "bg-amber-900/50"
            }`}
          >
            {isBlocked ? (
              <Ban className="w-6 h-6 text-red-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h2
              className={`text-lg font-semibold ${
                isBlocked ? "text-red-300" : "text-amber-300"
              }`}
            >
              {isBlocked ? "Update Required" : "Update Available"}
            </h2>
            <p className="text-sm text-slate-400">
              {isBlocked
                ? "Your version has expired"
                : "A new version is available"}
            </p>
          </div>
          {!isBlocked && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Version Info */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Current
              </p>
              <p className="text-lg font-mono text-slate-300">
                v{currentVersion}
              </p>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">→</span>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Latest
              </p>
              <p className="text-lg font-mono text-cyan-400">v{latestVersion}</p>
            </div>
          </div>

          {/* Grace Period Warning */}
          {!isBlocked && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
              <Clock className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-amber-200">
                  <strong>{daysRemaining}</strong> hari tersisa untuk update
                </p>
                <p className="text-xs text-amber-400/70 mt-1">
                  Aplikasi akan diblokir jika tidak diupdate dalam waktu
                  tersebut.
                </p>
              </div>
            </div>
          )}

          {/* Blocked Warning */}
          {isBlocked && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
              <Shield className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-200">
                  Masa grace period telah berakhir
                </p>
                <p className="text-xs text-red-400/70 mt-1">
                  Silakan download versi terbaru untuk melanjutkan menggunakan
                  aplikasi.
                </p>
              </div>
            </div>
          )}

          {/* Release Notes */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Release Notes
            </p>
            <div className="p-3 rounded-lg bg-slate-800/30 max-h-32 overflow-y-auto">
              <p className="text-sm text-slate-400 whitespace-pre-wrap">
                {formattedNotes}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex gap-3 px-6 py-4 border-t ${
            isBlocked ? "border-red-800" : "border-slate-700"
          }`}
        >
          {!isBlocked && (
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors"
            >
              Lanjutkan ({daysRemaining} hari)
            </button>
          )}
          <button
            onClick={onDownload}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
              isBlocked
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
          >
            <Download className="w-4 h-4" />
            Download Update
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
