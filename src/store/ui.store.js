import { create } from "zustand";

export const useUIStore = create((set) => ({
    cameraEyeKm: 10000,
    setCameraEye: (km) => set({ cameraEyeKm: km }),
}));
