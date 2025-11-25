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
  Settings
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
      className={`flex flex-col bg-base-200 border-r border-base-300 transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-base-300 bg-base-300">
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold truncate">{scenarioName}</h2>
            {scenarioDescription && (
              <p className="text-xs text-slate-500 truncate">{scenarioDescription}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-base-100 rounded transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex ${isCollapsed ? 'flex-col' : ''} border-b border-base-300`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 p-2 transition-colors ${
              isCollapsed ? 'justify-center' : 'flex-1 justify-center'
            } ${
              activeTab === tab.id 
                ? 'bg-primary/20 text-primary border-b-2 border-primary' 
                : 'hover:bg-base-300'
            }`}
            title={tab.label}
          >
            <tab.icon className="w-4 h-4" />
            {!isCollapsed && <span className="text-xs">{tab.label}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-2">
          {activeTab === 'objects' && <ObjectTree />}
          
          {activeTab === 'properties' && (
            <div className="text-sm text-slate-500 text-center py-8">
              <p>Select an object to view properties</p>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="text-sm space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Scenario Name</label>
                <input 
                  type="text" 
                  className="input input-sm input-bordered w-full"
                  value={scenarioName}
                  onChange={(e) => useScenarioStore.getState().setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea 
                  className="textarea textarea-bordered textarea-sm w-full"
                  rows={3}
                  value={scenarioDescription}
                  onChange={(e) => useScenarioStore.getState().setDescription(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed state icons */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4 gap-2">
          {activeTab === 'objects' && <Layers className="w-5 h-5 text-primary" />}
          {activeTab === 'properties' && <FileText className="w-5 h-5 text-primary" />}
          {activeTab === 'settings' && <Settings className="w-5 h-5 text-primary" />}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
