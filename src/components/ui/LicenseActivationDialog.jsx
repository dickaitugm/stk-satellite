/**
 * LicenseActivationDialog Component
 * Modal dialog for entering and activating license key
 * or requesting a new license via email
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
  Mail,
  Send,
  User,
  Building,
  MapPin,
  FileText,
  Sparkles,
} from "lucide-react";
import { LICENSE_REQUEST_EMAIL, FREE_TIER_LIMITS } from "../../utils/licenseConstants";

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
 * @param {Function} props.onContinueFree - Callback to continue with free tier
 */
export default function LicenseActivationDialog({
  isOpen,
  isActivating = false,
  error = null,
  onActivate,
  onClose,
  canClose = false,
  onContinueFree,
}) {
  const [activeTab, setActiveTab] = useState("activate"); // "activate" | "request"
  const [licenseKey, setLicenseKey] = useState("");
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [showHardwareInfo, setShowHardwareInfo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState(null);
  
  // Request form state
  const [requestForm, setRequestForm] = useState({
    fullName: "",
    email: "",
    institution: "",
    country: "",
    purpose: "",
    userType: "academic", // "academic" | "commercial" | "personal" | "government"
  });

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

  // Update request form
  const handleRequestFormChange = (field, value) => {
    setRequestForm(prev => ({ ...prev, [field]: value }));
  };

  // Generate email body for license request
  const generateEmailBody = () => {
    const lines = [
      "Dear STK Satellite Team,",
      "",
      "I would like to request a license for STK Satellite application.",
      "",
      "=== APPLICANT INFORMATION ===",
      `Full Name: ${requestForm.fullName}`,
      `Email: ${requestForm.email}`,
      `Institution/Organization: ${requestForm.institution}`,
      `Country: ${requestForm.country}`,
      `User Type: ${requestForm.userType.charAt(0).toUpperCase() + requestForm.userType.slice(1)}`,
      "",
      "=== PURPOSE ===",
      requestForm.purpose,
      "",
      "=== DEVICE INFORMATION ===",
      `Hostname: ${hardwareInfo?.hostname || "N/A"}`,
      `CPU: ${hardwareInfo?.cpuModel || "N/A"}`,
      `MAC Address: ${hardwareInfo?.macAddress || "N/A"}`,
      `Device Fingerprint: ${hardwareInfo?.fingerprint || "N/A"}`,
      "",
      "Thank you for your consideration.",
      "",
      `Best regards,`,
      requestForm.fullName,
    ];
    return lines.join("\n");
  };

  // Send license request via email
  const handleSendRequest = () => {
    // Validate form
    if (!requestForm.fullName || !requestForm.email || !requestForm.institution) {
      setLocalError("Please fill in all required fields");
      return;
    }

    const subject = encodeURIComponent(`${LICENSE_REQUEST_EMAIL.subject} - ${requestForm.fullName}`);
    const body = encodeURIComponent(generateEmailBody());
    const mailtoLink = `mailto:${LICENSE_REQUEST_EMAIL.to}?subject=${subject}&body=${body}`;
    
    // Open default email client
    window.open(mailtoLink, "_blank");
  };

  // Validate request form
  const isRequestFormValid = () => {
    return requestForm.fullName && requestForm.email && requestForm.institution && requestForm.purpose;
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
      <div className="relative w-full max-w-lg mx-4 rounded-xl shadow-2xl bg-slate-900/95 border border-slate-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="p-2 rounded-full bg-cyan-900/50">
            <Key className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">License Activation</h2>
            <p className="text-sm text-slate-400">
              Activate your license or request a new one
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          <button
            onClick={() => setActiveTab("activate")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === "activate" 
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/30" 
                : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
          >
            <Key className="w-4 h-4" />
            Activate License
          </button>
          <button
            onClick={() => setActiveTab("request")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === "request" 
                ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/30" 
                : "text-slate-400 hover:text-slate-300 hover:bg-slate-800/30"
              }`}
          >
            <Mail className="w-4 h-4" />
            Request License
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {activeTab === "activate" ? (
            <>
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
            </>
          ) : (
            <>
              {/* Request Form */}
              <div className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <User className="w-3.5 h-3.5" />
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={requestForm.fullName}
                    onChange={(e) => handleRequestFormChange("fullName", e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={requestForm.email}
                    onChange={(e) => handleRequestFormChange("email", e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  />
                </div>

                {/* Institution */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <Building className="w-3.5 h-3.5" />
                    Institution/Organization <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={requestForm.institution}
                    onChange={(e) => handleRequestFormChange("institution", e.target.value)}
                    placeholder="Your university, company, or organization"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Country
                  </label>
                  <input
                    type="text"
                    value={requestForm.country}
                    onChange={(e) => handleRequestFormChange("country", e.target.value)}
                    placeholder="Your country"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  />
                </div>

                {/* User Type */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <User className="w-3.5 h-3.5" />
                    User Type
                  </label>
                  <select
                    value={requestForm.userType}
                    onChange={(e) => handleRequestFormChange("userType", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  >
                    <option value="academic">Academic / Research</option>
                    <option value="commercial">Commercial / Business</option>
                    <option value="government">Government / Military</option>
                    <option value="personal">Personal / Hobbyist</option>
                  </select>
                </div>

                {/* Purpose */}
                <div>
                  <label className="flex items-center gap-1 text-sm text-slate-400 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    Purpose / Use Case <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={requestForm.purpose}
                    onChange={(e) => handleRequestFormChange("purpose", e.target.value)}
                    placeholder="Describe how you plan to use STK Satellite..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm
                      focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Error Message */}
              {localError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800/50">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-200">{localError}</p>
                </div>
              )}

              {/* Device Info Note */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <Shield className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-500">
                  <p>Your device information will be included in the request to generate a license tied to this computer.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Free Tier Info */}
        {onContinueFree && (
          <div className="px-6 py-3 bg-gradient-to-r from-amber-950/30 to-amber-900/20 border-t border-amber-800/30 shrink-0">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-200 font-medium">Free Tier Available</p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  Limited to {FREE_TIER_LIMITS.maxSatellites} satellite and {FREE_TIER_LIMITS.maxGroundStations} ground station. 
                  Some features like export and simulation are disabled.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          {onContinueFree && (
            <button
              onClick={onContinueFree}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-700/50 hover:bg-amber-600/50 text-amber-200 font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Free Tier
            </button>
          )}
          {canClose && (
            <button
              onClick={onClose}
              disabled={isActivating}
              className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {activeTab === "activate" ? (
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
          ) : (
            <button
              onClick={handleSendRequest}
              disabled={!isRequestFormValid()}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors
                ${
                  !isRequestFormValid()
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-cyan-600 hover:bg-cyan-500 text-white"
                }
              `}
            >
              <Send className="w-4 h-4" />
              Send Request via Email
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
