/**
 * Time Store
 * Manages simulation time and playback controls
 * 
 * Modes:
 * - realtime: Time follows real clock, updates every second automatically
 * - simulation: Time is paused, only advances when Play is pressed with playback speed
 */

import { create } from 'zustand';

export const useTimeStore = create((set, get) => ({
  // State
  currentTime: new Date(),
  startTime: new Date(),
  endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 hours
  
  // Mode: 'realtime' or 'simulation'
  mode: 'realtime',
  
  // Playback controls (only used in simulation mode)
  isPlaying: false,
  playbackSpeed: 1, // 1x, 2x, 4x, 10x, 60x, etc.
  timeStep: 1000, // ms per update (1 second)
  
  // For realtime mode - track last update time
  lastRealtimeUpdate: Date.now(),
  
  // Available playback speeds
  availableSpeeds: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300, 600],
  
  // Mode switching
  setMode: (mode) => {
    const now = new Date();
    if (mode === 'realtime') {
      // Switch to realtime - sync to current time
      set({ 
        mode, 
        currentTime: now,
        isPlaying: false,
        lastRealtimeUpdate: Date.now()
      });
    } else {
      // Switch to simulation - pause at current time
      set({ 
        mode, 
        isPlaying: false,
        startTime: now,
        currentTime: now
      });
    }
  },
  
  // Actions
  setCurrentTime: (time) => set({ 
    currentTime: time instanceof Date ? time : new Date(time) 
  }),
  
  setStartTime: (time) => set({ 
    startTime: time instanceof Date ? time : new Date(time) 
  }),
  
  setEndTime: (time) => set({ 
    endTime: time instanceof Date ? time : new Date(time) 
  }),
  
  setTimeRange: (start, end) => set({
    startTime: start instanceof Date ? start : new Date(start),
    endTime: end instanceof Date ? end : new Date(end)
  }),
  
  // Playback controls
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  increaseSpeed: () => set((state) => {
    const speeds = state.availableSpeeds;
    const currentIndex = speeds.indexOf(state.playbackSpeed);
    const nextIndex = Math.min(currentIndex + 1, speeds.length - 1);
    return { playbackSpeed: speeds[nextIndex] };
  }),
  
  decreaseSpeed: () => set((state) => {
    const speeds = state.availableSpeeds;
    const currentIndex = speeds.indexOf(state.playbackSpeed);
    const prevIndex = Math.max(currentIndex - 1, 0);
    return { playbackSpeed: speeds[prevIndex] };
  }),
  
  // Time navigation
  stepForward: (seconds = 60) => set((state) => ({
    currentTime: new Date(state.currentTime.getTime() + seconds * 1000)
  })),
  
  stepBackward: (seconds = 60) => set((state) => ({
    currentTime: new Date(state.currentTime.getTime() - seconds * 1000)
  })),
  
  goToStart: () => set((state) => ({ 
    currentTime: new Date(state.startTime) 
  })),
  
  goToEnd: () => set((state) => ({ 
    currentTime: new Date(state.endTime) 
  })),
  
  goToNow: () => set({ 
    currentTime: new Date() 
  }),
  
  // Tick function for animation loop
  tick: () => set((state) => {
    const now = Date.now();
    
    if (state.mode === 'realtime') {
      // Realtime mode: sync to actual clock
      return { 
        currentTime: new Date(),
        lastRealtimeUpdate: now
      };
    }
    
    // Simulation mode: only advance if playing
    if (!state.isPlaying) return state;
    
    const newTime = new Date(
      state.currentTime.getTime() + state.timeStep * state.playbackSpeed
    );
    
    // Stop at end time
    if (newTime >= state.endTime) {
      return { 
        currentTime: state.endTime,
        isPlaying: false 
      };
    }
    
    return { currentTime: newTime };
  }),
  
  // Reset to current real time
  reset: () => {
    const now = new Date();
    set({
      currentTime: now,
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      isPlaying: false,
      playbackSpeed: 1,
      mode: 'realtime',
      lastRealtimeUpdate: Date.now()
    });
  },
  
  // Formatted time strings
  getFormattedTime: () => {
    const time = get().currentTime;
    return time.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  },
  
  getElapsedTime: () => {
    const state = get();
    const elapsed = state.currentTime - state.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },
  
  // Get mode label
  getModeLabel: () => {
    const mode = get().mode;
    return mode === 'realtime' ? 'REALTIME' : 'SIMULATION';
  }
}));
