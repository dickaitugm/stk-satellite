/**
 * TopNavbar Component
 * Navigation bar with simulation controls and time display
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, FastForward, Rewind, Settings, Globe, SkipBack, SkipForward, Clock, Radio, Activity, AlertTriangle } from "lucide-react";
import { useTimeStore, useScenarioStore, useTabsStore, useSatelliteStore } from "../../stores";

const TopNavbar = () => {
  // Time store
  const currentTime = useTimeStore((state) => state.currentTime);
  const isPlaying = useTimeStore((state) => state.isPlaying);
  const playbackSpeed = useTimeStore((state) => state.playbackSpeed);
  const playbackDirection = useTimeStore((state) => state.playbackDirection);
  const availableSpeeds = useTimeStore((state) => state.availableSpeeds);
  const mode = useTimeStore((state) => state.mode);
  const setMode = useTimeStore((state) => state.setMode);
  const play = useTimeStore((state) => state.play);
  const pause = useTimeStore((state) => state.pause);
  const togglePlayback = useTimeStore((state) => state.togglePlayback);
  const playForward = useTimeStore((state) => state.playForward);
  const playBackward = useTimeStore((state) => state.playBackward);
  const increaseSpeed = useTimeStore((state) => state.increaseSpeed);
  const decreaseSpeed = useTimeStore((state) => state.decreaseSpeed);
  const stepForward = useTimeStore((state) => state.stepForward);
  const stepBackward = useTimeStore((state) => state.stepBackward);
  const goToNow = useTimeStore((state) => state.goToNow);
  const getFormattedTime = useTimeStore((state) => state.getFormattedTime);
  const getElapsedTime = useTimeStore((state) => state.getElapsedTime);
  const setCurrentTime = useTimeStore((state) => state.setCurrentTime);

  // Satellite store for TLE age warnings
  const satellites = useSatelliteStore((state) => state.satellites);
  const getTleInfoForTime = useSatelliteStore((state) => state.getTleInfoForTime);

  // Check if globe tab is active
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const isGlobeActive = activeTabId === "tab-globe-main";

  // Calculate TLE age warnings for visible satellites in simulation mode
  const tleWarnings = useMemo(() => {
    if (mode !== "simulation") return [];
    
    const warnings = [];
    satellites.filter(s => s.isVisible).forEach(sat => {
      const info = getTleInfoForTime(sat.id, currentTime);
      if (info?.isOld) {
        warnings.push({
          id: sat.id,
          name: sat.name,
          ageDays: Math.round(info.ageDays),
          isFuture: info.isFuture,
        });
      }
    });
    return warnings;
  }, [mode, satellites, currentTime, getTleInfoForTime]);

  // Always tick time when globe is NOT active (Globe handles its own tick when active)
  // This ensures time keeps running in realtime mode even when viewing other tabs
  useEffect(() => {
    if (isGlobeActive) return; // Globe handles its own tick

    let frameId;
    const tick = () => {
      useTimeStore.getState().tick();
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isGlobeActive]);

  // State untuk input waktu
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [inputTime, setInputTime] = useState("");
  const inputRef = useRef(null);

  // State untuk edit scenario name
  const [isEditingName, setIsEditingName] = useState(false);
  const [inputName, setInputName] = useState("");
  const nameInputRef = useRef(null);

  // Cek apakah bisa edit waktu (mode simulation dan tidak sedang play)
  const canEditTime = mode === "simulation" && !isPlaying;

  // Handler untuk mulai edit scenario name
  const handleStartEditName = () => {
    setInputName(scenarioName);
    setIsEditingName(true);
  };

  // Handler untuk submit scenario name
  const handleSubmitName = () => {
    const trimmedName = inputName.trim();
    if (trimmedName && trimmedName !== scenarioName) {
      useScenarioStore.getState().setName(trimmedName);
    }
    setIsEditingName(false);
  };

  // Handler untuk cancel edit name
  const handleCancelEditName = () => {
    setIsEditingName(false);
  };

  // Handle keyboard events untuk name
  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmitName();
    } else if (e.key === "Escape") {
      handleCancelEditName();
    }
  };

  // Focus input saat mulai edit name
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Handler untuk mulai edit
  const handleStartEdit = () => {
    if (!canEditTime) return;
    setInputTime(getFormattedTime());
    setIsEditingTime(true);
  };

  // Handler untuk submit waktu
  const handleSubmitTime = () => {
    try {
      // Parse input: "YYYY-MM-DD HH:MM:SS.mmm" ke Date
      const parsed = inputTime.trim().replace(" ", "T") + "Z";
      const newDate = new Date(parsed);

      if (!isNaN(newDate.getTime())) {
        setCurrentTime(newDate);
      }
    } catch (error) {
      console.error("Invalid time format:", error);
    }
    setIsEditingTime(false);
  };

  // Handler untuk cancel edit
  const handleCancelEdit = () => {
    setIsEditingTime(false);
  };

  // Handle keyboard events
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmitTime();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Focus input saat mulai edit
  useEffect(() => {
    if (isEditingTime && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTime]);

  // Scenario store
  const scenarioName = useScenarioStore((state) => state.name);
  const isDirty = useScenarioStore((state) => state.isDirty);

  // Format speed display with direction
  const formatSpeed = (speed, direction) => {
    const prefix = direction < 0 ? "-" : "";
    if (speed >= 1) return `${prefix}${speed}x`;
    return `${prefix}${speed}x`;
  };

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 select-none flex-shrink-0 z-50">
      {/* Left section - Logo & Menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-wider">
          <Globe className="w-6 h-6" />
          <span>
            ORBIT<span className="text-white">SIM</span>
          </span>
        </div>

        <div className="h-6 w-px bg-slate-700 mx-2" />

        <div className="text-sm text-slate-300">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              onBlur={handleSubmitName}
              onKeyDown={handleNameKeyDown}
              className="font-medium bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
              placeholder="Scenario name"
            />
          ) : (
            <span className="font-medium cursor-pointer hover:text-white hover:underline" onClick={handleStartEditName} title="Click to edit scenario name">
              {scenarioName}
            </span>
          )}
          {isDirty && <span className="text-yellow-400 ml-1">*</span>}
        </div>

        <div className="h-6 w-px bg-slate-700 mx-2" />

        <div className="hidden md:flex gap-4 text-sm text-slate-300 font-medium">
          <button className="hover:text-white transition-colors">File</button>
          <button className="hover:text-white transition-colors">Edit</button>
          <button className="hover:text-white transition-colors">View</button>
          <button className="hover:text-white transition-colors">Insert</button>
          <button className="hover:text-white transition-colors">Analysis</button>
        </div>
      </div>

      {/* Center section - Time Controls */}
      <div className="flex items-center gap-2">
        {/* Mode Toggle - Realtime / Simulation */}
        <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 mr-2">
          <button
            onClick={() => setMode("realtime")}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-l transition-colors ${
              mode === "realtime" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
            title="Realtime mode - follows actual clock"
          >
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">Realtime</span>
          </button>
          <button
            onClick={() => setMode("simulation")}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-r transition-colors ${
              mode === "simulation" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`}
            title="Simulation mode - controlled playback"
          >
            <Activity className="w-3 h-3" />
            <span className="hidden sm:inline">Simulation</span>
          </button>
        </div>

        {/* Speed control - only show in simulation mode */}
        {mode === "simulation" && (
          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 mr-2">
            <button
              onClick={decreaseSpeed}
              disabled={playbackSpeed === availableSpeeds[0]}
              className="px-2 py-1 hover:bg-slate-700 rounded-l text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Decrease speed"
            >
              <Rewind className="w-3 h-3" />
            </button>
            <span className={`px-2 text-xs font-mono min-w-[50px] text-center ${playbackDirection < 0 ? "text-orange-400" : "text-emerald-400"}`}>
              {formatSpeed(playbackSpeed, playbackDirection)}
            </span>
            <button
              onClick={increaseSpeed}
              disabled={playbackSpeed === availableSpeeds[availableSpeeds.length - 1]}
              className="px-2 py-1 hover:bg-slate-700 rounded-r text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Increase speed"
            >
              <FastForward className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Playback controls - only show in simulation mode */}
        {mode === "simulation" && (
          <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
            {/* Play Backward button */}
            <button
              onClick={playBackward}
              className={`p-1.5 rounded text-white ${
                isPlaying && playbackDirection < 0 ? "bg-orange-600 hover:bg-orange-700" : "hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
              title="Play Backward"
            >
              <Rewind className="w-4 h-4" />
            </button>

            {/* Step backward */}
            <button onClick={() => stepBackward(60)} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Step backward 1 min">
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Pause button */}
            <button onClick={pause} className={`p-1.5 mx-1 rounded ${!isPlaying ? "bg-slate-600 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`} title="Pause">
              <Pause className="w-4 h-4" />
            </button>

            {/* Step forward */}
            <button onClick={() => stepForward(60)} className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Step forward 1 min">
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Play Forward button */}
            <button
              onClick={playForward}
              className={`p-1.5 rounded text-white ${
                isPlaying && playbackDirection > 0 ? "bg-emerald-600 hover:bg-emerald-700" : "hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
              title="Play Forward"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reset to now button */}
        <button onClick={goToNow} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white border border-slate-700" title="Go to current time">
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Right section - Time Display & Settings */}
      <div className="flex items-center gap-3">
        {/* Mode indicator */}
        <div
          className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
            mode === "realtime" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30" : "bg-blue-600/20 text-blue-400 border border-blue-600/30"
          }`}
        >
          {mode === "realtime" ? "LIVE" : isPlaying ? "RUNNING" : "PAUSED"}
        </div>

        {/* TLE Age Warning Indicator */}
        {tleWarnings.length > 0 && (
          <div 
            className="relative group"
            title={`${tleWarnings.length} satellite(s) with old TLE`}
          >
            <div className="flex items-center gap-1 px-2 py-1 bg-amber-600/20 border border-amber-600/30 rounded text-amber-400 text-[10px] cursor-help">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TLE &gt;10d</span>
              <span className="font-bold">{tleWarnings.length}</span>
            </div>
            {/* Tooltip with details */}
            <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-amber-600/30 rounded-lg shadow-xl p-2 z-50 hidden group-hover:block">
              <div className="text-xs text-amber-400 font-medium mb-1">⚠️ TLE Age Warning</div>
              <div className="text-[10px] text-slate-300 mb-2">
                The following satellites have TLE data more than 10 days old compared to simulation time. Accuracy may be degraded.
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tleWarnings.map(w => (
                  <div key={w.id} className="flex justify-between text-[10px] text-slate-400">
                    <span className="truncate">{w.name}</span>
                    <span className="text-amber-400 ml-2">
                      {w.isFuture ? `${w.ageDays}d ahead` : `${w.ageDays}d old`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-right hidden sm:block bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
          <div className="text-slate-400 text-[10px]">{mode === "realtime" ? "Current Time (UTC)" : "Simulation Time (UTC)"}</div>
          {isEditingTime ? (
            <input
              ref={inputRef}
              type="text"
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              onBlur={handleSubmitTime}
              onKeyDown={handleKeyDown}
              className="font-mono text-emerald-400 bg-slate-900 border border-emerald-500 rounded px-1 py-0.5 w-48 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="YYYY-MM-DD HH:MM:SS.mmm"
            />
          ) : (
            <div
              onClick={handleStartEdit}
              className={`font-mono text-emerald-400 ${canEditTime ? "cursor-pointer hover:text-emerald-300 hover:underline" : ""}`}
              title={canEditTime ? "Click to edit time" : ""}
            >
              {getFormattedTime()}
            </div>
          )}
        </div>
        {mode === "simulation" && (
          <div className="text-xs text-right hidden lg:block">
            <div className="text-slate-400 text-[10px]">Elapsed</div>
            <div className="font-mono text-cyan-400">{getElapsedTime()}</div>
          </div>
        )}
        <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;
