import TopNavbar from "./components/TopNavbar";
import Globe2D from "./components/Globe2D";
import BottomNavbar from "./components/BottomNavbar";

export default function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      
      {/* TOP MENU */}
      <TopNavbar />

      {/* WORLDWIND MAP */}
      <div className="flex-1 overflow-hidden">
        <Globe2D />
      </div>

      {/* BOTTOM MENU */}
      <BottomNavbar />
    </div>
  );
}
