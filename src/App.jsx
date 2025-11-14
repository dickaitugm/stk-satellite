import SidebarLeft from "./components/ui/SidebarLeft";
import SidebarRight from "./components/ui/SidebarRight";
import TopNavbar from "./components/ui/TopNavbar";
import BottomTimeline from "./components/ui/BottomTimeline";
import Globe2DCanvas from "./components/map/Globe2DCanvas";

export default function App() {
    return (
        <div className="w-screen h-screen flex flex-col overflow-hidden bg-base-200">
            {/* TOP NAVBAR */}
            <TopNavbar />

            {/* MAIN CONTENT AREA */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT SIDEBAR */}
                <SidebarLeft />

                {/* MAP AREA */}
                <div className="flex-1 relative overflow-hidden bg-black">
                    <Globe2DCanvas />
                </div>

                {/* RIGHT SIDEBAR */}
                <SidebarRight />
            </div>

            {/* TIMELINE */}
            <BottomTimeline />
        </div>
    );
}
