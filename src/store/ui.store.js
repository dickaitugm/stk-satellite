import { create } from "zustand";

export const useUIStore = create((set) => ({
    cameraEyeDistance: 17000000, // 17000 km in meters
    setCameraEyeDistance: (meters) => set({ cameraEyeDistance: meters }),
    getCameraEyeKm: (state) => Math.round(state.cameraEyeDistance / 1000),
}));
