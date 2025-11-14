import { app, BrowserWindow, Menu } from "electron";
import { registerIpcHandlers } from "../src/services/ipcHandlers.js";
import { fileURLToPath } from "url";
import path from "path";

Menu.setApplicationMenu(null); // Hapus menubar

let win;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === "development";

function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 700, // rasio 2:1
        resizable: true,
        useContentSize: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // === Paksa rasio 2:1 saat resize ===
    win.on("will-resize", (event, newBounds) => {
        event.preventDefault();

        const targetWidth = newBounds.width;
        const targetHeight = Math.round(targetWidth / 2);

        // Terapkan ukuran baru
        win.setBounds({
            x: newBounds.x,
            y: newBounds.y,
            width: targetWidth,
            height: targetHeight,
        });

        // Kirim event ke renderer (React)
        if (win && win.webContents) {
            win.webContents.send("window-resized", {
                width: targetWidth,
                height: targetHeight,
            });
        }
    });

    // === Pastikan tetap 2:1 saat maximize ===
    win.on("maximize", () => {
        const [maxWidth] = win.getSize();
        const idealHeight = Math.round(maxWidth / 2);
        win.setSize(maxWidth, idealHeight);
    });

    // === Load URL ===
    if (isDev) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, "dist", "index.html"));
    }

    registerIpcHandlers();
}

app.whenReady().then(() => createWindow());

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
