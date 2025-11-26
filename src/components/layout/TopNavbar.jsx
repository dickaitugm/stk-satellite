/**
 * TopNavbar Component
 * Navigation bar with simulation controls and time display
 */

import React from 'react';
import { 
  Play, Pause, FastForward, Rewind, 
  Settings, Globe, SkipBack, SkipForward,
  Clock, Radio, Activity
} from 'lucide-react';
import { useTimeStore, useScenarioStore } from '../../stores';

const TopNavbar = () => {
  // Time store
  const currentTime = useTimeStore(state => state.currentTime);
  const isPlaying = useTimeStore(state => state.isPlaying);
  const playbackSpeed = useTimeStore(state => state.playbackSpeed);
  const availableSpeeds = useTimeStore(state => state.availableSpeeds);
  const mode = useTimeStore(state => state.mode);
  const setMode = useTimeStore(state => state.setMode);
  const play = useTimeStore(state => state.play);
  const pause = useTimeStore(state => state.pause);
  const togglePlayback = useTimeStore(state => state.togglePlayback);
  const increaseSpeed = useTimeStore(state => state.increaseSpeed);
  const decreaseSpeed = useTimeStore(state => state.decreaseSpeed);
  const stepForward = useTimeStore(state => state.stepForward);
  const stepBackward = useTimeStore(state => state.stepBackward);
  const goToNow = useTimeStore(state => state.goToNow);
  const getFormattedTime = useTimeStore(state => state.getFormattedTime);
  const getElapsedTime = useTimeStore(state => state.getElapsedTime);
  
  // Scenario store
  const scenarioName = useScenarioStore(state => state.name);
  const isDirty = useScenarioStore(state => state.isDirty);

  // Format speed display
  const formatSpeed = (speed) => {
    if (speed >= 1) return `${speed}x`;
    return `${speed}x`;
  };

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 select-none flex-shrink-0 z-50">
      {/* Left section - Logo & Menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-blue-400 font-bold tracking-wider">
          <Globe className="w-6 h-6" />
          <span>ORBIT<span className="text-white">SIM</span></span>
        </div>
        
        <div className="h-6 w-px bg-slate-700 mx-2" />
        
        <div className="text-sm text-slate-300">
          <span className="font-medium">{scenarioName}</span>
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
            onClick={() => setMode('realtime')}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-l transition-colors ${
              mode === 'realtime' 
                ? 'bg-emerald-600 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Realtime mode - follows actual clock"
          >
            <Radio className="w-3 h-3" />
            <span className="hidden sm:inline">Realtime</span>
          </button>
          <button
            onClick={() => setMode('simulation')}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-r transition-colors ${
              mode === 'simulation' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Simulation mode - controlled playback"
          >
            <Activity className="w-3 h-3" />
            <span className="hidden sm:inline">Simulation</span>
          </button>
        </div>

        {/* Speed control - only show in simulation mode */}
        {mode === 'simulation' && (
          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 mr-2">
            <button 
              onClick={decreaseSpeed}
              disabled={playbackSpeed === availableSpeeds[0]}
              className="px-2 py-1 hover:bg-slate-700 rounded-l text-slate-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Decrease speed"
            >
              <Rewind className="w-3 h-3" />
            </button>
            <span className="px-2 text-xs font-mono text-emerald-400 min-w-[40px] text-center">
              {formatSpeed(playbackSpeed)}
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
        {mode === 'simulation' && (
          <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
            <button 
              onClick={() => stepBackward(60)}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Step backward 1 min"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button 
              onClick={togglePlayback}
              className={`p-1.5 mx-1 rounded text-white ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button 
              onClick={() => stepForward(60)}
              className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
              title="Step forward 1 min"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Reset to now button */}
        <button 
          onClick={goToNow}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white border border-slate-700"
          title="Go to current time"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Right section - Time Display & Settings */}
      <div className="flex items-center gap-3">
        {/* Mode indicator */}
        <div className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
          mode === 'realtime' 
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' 
            : 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
        }`}>
          {mode === 'realtime' ? 'LIVE' : isPlaying ? 'RUNNING' : 'PAUSED'}
        </div>
        
        <div className="text-xs text-right hidden sm:block bg-slate-800 px-3 py-1.5 rounded border border-slate-700">
          <div className="text-slate-400 text-[10px]">
            {mode === 'realtime' ? 'Current Time (UTC)' : 'Simulation Time (UTC)'}
          </div>
          <div className="font-mono text-emerald-400">{getFormattedTime()}</div>
        </div>
        {mode === 'simulation' && (
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
