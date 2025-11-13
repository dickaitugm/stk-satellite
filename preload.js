// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Mengekspos API yang aman ke jendela renderer (GUI)
contextBridge.exposeInMainWorld("electronAPI", {
    onWindowResize: (callback) => ipcRenderer.on("window-resized", (event, data) => callback(data)),
});
