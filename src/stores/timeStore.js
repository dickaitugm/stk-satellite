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

  // Smooth tick function for animation loop - called every frame
  // Returns deltaTime in ms for the frame
  tick: () => {
    const state = get();
    const now = Date.now();
    const deltaTime = now - state.lastFrameTime;

    if (state.mode === "realtime") {
      // Realtime mode: always sync to actual clock (smooth)
      set({
        currentTime: new Date(),
        lastFrameTime: now,
      });
      return deltaTime;
    }

    // Simulation mode: only advance if playing
    if (!state.isPlaying) {
      set({ lastFrameTime: now });
      return 0;
    }

    // Calculate new time based on delta, playback speed, and direction
    // deltaTime is real ms elapsed, multiply by playbackSpeed and direction
    const simDeltaMs = deltaTime * state.playbackSpeed * state.playbackDirection;
    const newTime = new Date(state.currentTime.getTime() + simDeltaMs);

    // Stop at end time (forward) or start time (backward)
    if (state.playbackDirection > 0 && newTime >= state.endTime) {
      set({
        currentTime: state.endTime,
        isPlaying: false,
        lastFrameTime: now,
      });
      return deltaTime;
    }

    if (state.playbackDirection < 0 && newTime <= state.startTime) {
      set({
        currentTime: state.startTime,
        isPlaying: false,
        lastFrameTime: now,
      });
      return deltaTime;
    }

    set({
      currentTime: newTime,
      lastFrameTime: now,
    });
    return deltaTime;
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
