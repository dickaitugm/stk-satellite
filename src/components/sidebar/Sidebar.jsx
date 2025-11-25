/**
 * Sidebar Component
 * Left sidebar with collapse/extend toggle and object tree
 */

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  FileText,
  Settings,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';

import ObjectTree from './ObjectTree';
import { useScenarioStore } from '../../stores';

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('objects'); // 'objects' | 'properties' | 'settings'
  
  const scenarioName = useScenarioStore(state => state.name);
  const scenarioDescription = useScenarioStore(state => state.description);

  const tabs = [
    { id: 'objects', icon: Layers, label: 'Objects' },
    { id: 'properties', icon: FileText, label: 'Properties' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div 
      className={`h-full flex flex-col bg-slate-900/95 backdrop-blur-sm border-r border-slate-700 transition-all duration-300 shadow-xl ${
        isCollapsed ? 'w-10' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800/50 min-h-[40px]">
        {!isCollapsed && (
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-sm font-semibold text-slate-200 truncate">{scenarioName}</h2>
            {scenarioDescription && (
              <p className="text-[10px] text-slate-500 truncate">{scenarioDescription}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex ${isCollapsed ? 'flex-col' : ''} border-b border-slate-700 bg-slate-800/30`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 p-2 transition-colors ${
              isCollapsed ? 'justify-center' : 'flex-1 justify-center'
            } ${
              activeTab === tab.id 
                ? 'bg-slate-700/50 text-blue-400 border-b-2 border-blue-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={tab.label}
          >
            <tab.icon className="w-4 h-4" />
            {!isCollapsed && <span className="text-xs font-medium">{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {activeTab === 'objects' && <ObjectTree />}
          
          {activeTab === 'properties' && (
            <div className="text-sm text-slate-500 text-center py-8">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Select an object to view properties</p>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="text-sm space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Scenario Name</label>
                <input 
                  type="text" 
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:border-blue-500 focus:outline-none"
                  value={scenarioName}
                  onChange={(e) => useScenarioStore.getState().setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea 
                  className="w-full px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:border-blue-500 focus:outline-none resize-none"
                  rows={3}
                  value={scenarioDescription}
                  onChange={(e) => useScenarioStore.getState().setDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed state - show active tab icon */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4">
          {activeTab === 'objects' && <Layers className="w-4 h-4 text-blue-400" />}
          {activeTab === 'properties' && <FileText className="w-4 h-4 text-blue-400" />}
          {activeTab === 'settings' && <Settings className="w-4 h-4 text-blue-400" />}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
