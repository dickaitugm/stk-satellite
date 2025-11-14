// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Mengekspos API yang aman ke jendela renderer (GUI)
contextBridge.exposeInMainWorld("electronAPI", {});
