import { app, BrowserWindow, Menu } from "electron";
import { registerIpcHandlers } from "./src/services/ipcHandlers.js";
import { fileURLToPath } from "url";
import path from "path";

// Hapus menubar
Menu.setApplicationMenu(null);

let win;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === "development";

function createWindow() {
    win = new BrowserWindow({
        width: 1450,
        height: 865,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, "dist", "index.html"));
    }

    registerIpcHandlers();
}

app.whenReady().then(() => {
    createWindow();

    // Auto reload hanya untuk file Electron (main process)
    if (isDev) {
        import("electron-reload").then((electronReload) => {
            electronReload.default(__dirname, {
                electron: path.join(__dirname, "node_modules", ".bin", "electron"),
                ignored: [/dist\/|node_modules/],
            });
        });
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
