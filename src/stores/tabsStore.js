/**
 * Tabs Store
 * Manages dynamic property tabs for Ground Stations and Satellites
 */

import { create } from "zustand";

export const useTabsStore = create((set, get) => ({
  // Array of open tabs: { id, type: 'satellite' | 'groundStation', entityId, title }
  tabs: [],

  // Currently active tab id
  activeTabId: null,

  /**
   * Add a new tab or focus existing tab for the same entity
   * @param {string} type - 'satellite' or 'groundStation'
   * @param {string} entityId - The ID of the satellite or ground station
   * @param {string} title - Display title for the tab
   */
  addTab: (type, entityId, title) => {
    const { tabs } = get();

    // Check if tab for this entity already exists
    const existingTab = tabs.find((tab) => tab.type === type && tab.entityId === entityId);

    if (existingTab) {
      // Focus existing tab instead of creating duplicate
      set({ activeTabId: existingTab.id });
      return existingTab.id;
    }

    // Create new tab
    const newTab = {
      id: `tab-${type}-${entityId}-${Date.now()}`,
      type,
      entityId,
      title,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });

    return newTab.id;
  },

  /**
   * Remove a tab by ID
   * @param {string} tabId - The tab ID to remove
   */
  removeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const tabIndex = tabs.findIndex((tab) => tab.id === tabId);

    if (tabIndex === -1) return;

    const newTabs = tabs.filter((tab) => tab.id !== tabId);

    // If removing the active tab, select adjacent tab
    let newActiveTabId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveTabId = null;
      } else if (tabIndex >= newTabs.length) {
        // Was last tab, select new last tab
        newActiveTabId = newTabs[newTabs.length - 1].id;
      } else {
        // Select tab at same index (next tab)
        newActiveTabId = newTabs[tabIndex].id;
      }
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
    });
  },

  /**
   * Set the active tab
   * @param {string} tabId - The tab ID to make active
   */
  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  /**
   * Update tab title (e.g., when entity name changes)
   * @param {string} tabId - The tab ID to update
   * @param {string} title - New title
   */
  updateTabTitle: (tabId, title) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
    });
  },

  /**
   * Get tab by entity
   * @param {string} type - 'satellite' or 'groundStation'
   * @param {string} entityId - The entity ID
   * @returns {object|null} The tab object or null
   */
  getTabByEntity: (type, entityId) => {
    const { tabs } = get();
    return tabs.find((tab) => tab.type === type && tab.entityId === entityId) || null;
  },

  /**
   * Close all tabs
   */
  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  /**
   * Close tabs for a specific entity type
   * @param {string} type - 'satellite' or 'groundStation'
   */
  closeTabsByType: (type) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter((tab) => tab.type !== type);
    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    let newActiveTabId = activeTabId;
    if (activeTab && activeTab.type === type) {
      newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null;
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
    });
  },
}));
