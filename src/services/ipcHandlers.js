import { ipcMain } from "electron";

export function registerIpcHandlers() {
    // Fetch TLE from URL (bypasses CORS)
    ipcMain.handle("fetch-tle", async (event, url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const text = await response.text();
            return { success: true, data: text };
        } catch (error) {
            console.error("Failed to fetch TLE:", error);
            return { success: false, error: error.message };
        }
    });
}
