/**
 * Time Store
 * Manages simulation time and playback controls
 *
 * Modes:
 * - realtime: Time follows real clock smoothly (updates every frame)
 * - simulation: Time is paused, only advances when Play is pressed with playback speed
 */

import { create } from "zustand";

export const useTimeStore = create((set, get) => ({
  // State
  currentTime: new Date(),
  startTime: new Date(),
  endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours

  // Mode: 'realtime' or 'simulation'
  mode: "realtime",

  // Playback controls (only used in simulation mode)
  isPlaying: false,
  playbackSpeed: 1, // 1x, 2x, 4x, 10x, 60x, etc.
  playbackDirection: 1, // 1 = forward, -1 = backward

  // For smooth animation - track last frame time
  lastFrameTime: Date.now(),

  // Available playback speeds
  availableSpeeds: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300, 600],

  // Mode switching
  setMode: (mode) => {
    const now = new Date();
    if (mode === "realtime") {
      // Switch to realtime - sync to current time
      set({
        mode,
        currentTime: now,
        isPlaying: false,
        lastFrameTime: Date.now(),
      });
    } else {
      // Switch to simulation - pause at current time
      set({
        mode,
        isPlaying: false,
        startTime: now,
        currentTime: now,
        lastFrameTime: Date.now(),
      });
    }
  },

  // Actions
  setCurrentTime: (time) =>
    set({
      currentTime: time instanceof Date ? time : new Date(time),
    }),

  setStartTime: (time) =>
    set({
      startTime: time instanceof Date ? time : new Date(time),
    }),

  setEndTime: (time) =>
    set({
      endTime: time instanceof Date ? time : new Date(time),
    }),

  setTimeRange: (start, end) =>
    set({
      startTime: start instanceof Date ? start : new Date(start),
      endTime: end instanceof Date ? end : new Date(end),
    }),

  // Playback controls
  play: () => {
    console.log("▶️ Play called");
    set({ isPlaying: true, lastFrameTime: Date.now() });
  },
  pause: () => {
    console.log("⏸️ Pause called");
    set({ isPlaying: false });
  },
  togglePlayback: () =>
    set((state) => {
      console.log(`⏯️ Toggle playback: ${!state.isPlaying}`);
      return {
        isPlaying: !state.isPlaying,
        lastFrameTime: Date.now(),
      };
    }),

  setPlaybackSpeed: (speed) => {
    console.log(`⏩ Speed changed to: ${speed}x`);
    set({ playbackSpeed: speed });
  },

  // Direction controls
  setPlaybackDirection: (direction) => set({ playbackDirection: direction }),
  toggleDirection: () => set((state) => ({ playbackDirection: state.playbackDirection * -1 })),
  playForward: () => {
    console.log("▶️ Play Forward called");
    set({ isPlaying: true, playbackDirection: 1, lastFrameTime: Date.now() });
  },
  playBackward: () => {
    console.log("◀️ Play Backward called");
    set({ isPlaying: true, playbackDirection: -1, lastFrameTime: Date.now() });
  },

  increaseSpeed: () =>
    set((state) => {
      const speeds = state.availableSpeeds;
      const currentIndex = speeds.indexOf(state.playbackSpeed);
      const nextIndex = Math.min(currentIndex + 1, speeds.length - 1);
      return { playbackSpeed: speeds[nextIndex] };
    }),

  decreaseSpeed: () =>
    set((state) => {
      const speeds = state.availableSpeeds;
      const currentIndex = speeds.indexOf(state.playbackSpeed);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { playbackSpeed: speeds[prevIndex] };
    }),

  // Time navigation
  stepForward: (seconds = 60) =>
    set((state) => ({
      currentTime: new Date(state.currentTime.getTime() + seconds * 1000),
    })),

  stepBackward: (seconds = 60) =>
    set((state) => ({
      currentTime: new Date(state.currentTime.getTime() - seconds * 1000),
    })),

  goToStart: () =>
    set((state) => ({
      currentTime: new Date(state.startTime),
    })),

  goToEnd: () =>
    set((state) => ({
      currentTime: new Date(state.endTime),
    })),

  goToNow: () =>
    set({
      currentTime: new Date(),
      lastFrameTime: Date.now(),
    }),

  // ============================================
  // PERFORMANCE OPTIMIZED TICK SYSTEM
  // ============================================
  // 
  // Internal time tracking (updated every frame, NOT triggering React re-renders)
  // Use getInternalTime() for high-frequency reads (e.g., WorldWind updates)
  // Use currentTime (Zustand state) for UI display (throttled to 10Hz)
  //
  // This prevents 60 FPS state updates that cause expensive React re-renders

  // Internal time (mutable, not reactive)
  _internalTime: Date.now(),
  _lastStoreUpdate: 0,
  
  // Throttle interval for Zustand state updates (ms)
  // 100ms = 10 Hz updates to React, sufficient for UI display
  STORE_UPDATE_INTERVAL: 100,

  // Get internal time without triggering re-renders
  // Use this in animation loops for smooth updates
  getInternalTime: () => {
    return get()._internalTime;
  },

  // Optimized tick function for animation loop
  // Updates internal time every frame, but only updates Zustand state at 10 Hz
  // Returns: { deltaTime, internalTime, shouldUpdateUI }
  tickOptimized: () => {
    const state = get();
    const now = Date.now();
    const deltaTime = now - state.lastFrameTime;
    const shouldUpdateUI = now - state._lastStoreUpdate >= state.STORE_UPDATE_INTERVAL;

    let newInternalTime;

    if (state.mode === "realtime") {
      // Realtime mode: sync to actual clock
      newInternalTime = now;
    } else if (!state.isPlaying) {
      // Simulation paused: keep current time
      newInternalTime = state._internalTime;
    } else {
      // Simulation playing: advance by delta * speed * direction
      const simDeltaMs = deltaTime * state.playbackSpeed * state.playbackDirection;
      newInternalTime = state._internalTime + simDeltaMs;
    }

    // Always update internal time (mutable, no re-render)
    state._internalTime = newInternalTime;

    // Only update Zustand state (and trigger re-renders) at 10 Hz
    if (shouldUpdateUI) {
      set({
        currentTime: new Date(newInternalTime),
        lastFrameTime: now,
        _lastStoreUpdate: now,
      });
    } else {
      // Just update lastFrameTime for delta calculation
      state.lastFrameTime = now;
    }

    return {
      deltaTime,
      internalTime: newInternalTime,
      shouldUpdateUI,
    };
  },

  // Legacy tick function - still works but now uses optimized path
  // Kept for backward compatibility
  tick: () => {
    const result = get().tickOptimized();
    return result.deltaTime;
  },

  // Reset to current real time
  reset: () => {
    const now = new Date();
    set({
      currentTime: now,
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      isPlaying: false,
      playbackSpeed: 1,
      playbackDirection: 1,
      mode: "realtime",
      lastFrameTime: Date.now(),
    });
  },

  // Formatted time strings - includes milliseconds for smooth display
  getFormattedTime: () => {
    const time = get().currentTime;
    const iso = time.toISOString();
    // Format: YYYY-MM-DD HH:MM:SS.mmm (tanpa UTC, sudah ada di label)
    return iso.replace("T", " ").substring(0, 23);
  },

  // Short format without milliseconds
  getFormattedTimeShort: () => {
    const time = get().currentTime;
    return time.toISOString().replace("T", " ").substring(0, 19);
  },

  getElapsedTime: () => {
    const state = get();
    const elapsed = state.currentTime - state.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  },

  // Get mode label
  getModeLabel: () => {
    const mode = get().mode;
    return mode === "realtime" ? "REALTIME" : "SIMULATION";
  },
}));
