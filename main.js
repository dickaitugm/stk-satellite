import { app, BrowserWindow, Menu } from "electron";
import { registerIpcHandlers } from "./src/services/ipcHandlers.js";
import { fileURLToPath } from 'url';
import path from 'path';

// Hapus menubar sepenuhnya
Menu.setApplicationMenu(null);

let win;

// Dapatkan __dirname untuk ES Module
const __filename = fileURLToPath(import.meta.url); // Mendapatkan file saat ini
const __dirname = path.dirname(__filename); // Dapatkan direktori dari file saat ini

function createWindow() {
  win = new BrowserWindow({
    // Ukuran dasar (fallback), tidak terlalu penting karena akan di-maximize
    width: 1280, 
    height: 720,
    show: false, // PENTING: Sembunyikan dulu agar transisi mulus
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // LOGIKA MAXIMIZE:
  // Ini akan menyesuaikan dengan resolusi layar pengguna (1366x768, 1920x1080, 4K, dll)
  win.maximize(); 
  win.show();

  // Load the correct URL based on environment
  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173"); // Vite dev server
    // win.webContents.openDevTools(); // Optional: Open dev tools in dev mode
  } else {
    // Load the index.html from the dist folder within the asar archive
    win.loadFile(path.join(__dirname, "dist", "index.html")).catch((err) => {
      console.error("Failed to load index.html:", err);
    });
  }
  // win.webContents.openDevTools(); // Optional: Open dev tools in dev mode

  // Daftarkan IPC handlers
  registerIpcHandlers();
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
