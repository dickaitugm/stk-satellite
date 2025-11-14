import Globe2DCanvas from "./components/map/Globe2DCanvas";
import SettingsPanel from "./components/ui/SettingsPanel";

export default function App() {
    return (
        <div className="w-full h-screen relative bg-black">
            <SettingsPanel />
            <Globe2DCanvas />
        </div>
    );
}
