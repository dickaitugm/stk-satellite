import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SidebarLeft() {
    const [tab, setTab] = useState("objects");
    const [isCollapsed, setIsCollapsed] = useState(true);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="relative flex">
            {/* Sidebar */}
            <div
                className={`bg-base-200 border-r border-base-content/20 h-full flex flex-col transition-all duration-300 ease-in-out ${
                    isCollapsed ? "w-0 overflow-hidden" : "w-64"
                }`}
            >
                {/* Tabs */}
                <div className="flex border-b border-base-content/20">
                    <button
                        className={`flex-1 btn btn-sm rounded-none ${
                            tab === "objects" ? "btn-active" : ""
                        }`}
                        onClick={() => setTab("objects")}
                    >
                        Objects
                    </button>
                    <button
                        className={`flex-1 btn btn-sm rounded-none ${
                            tab === "analysis" ? "btn-active" : ""
                        }`}
                        onClick={() => setTab("analysis")}
                    >
                        Tools
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto p-2">
                    {tab === "objects" ? <ObjectTree /> : <div>Analysis Tools Here</div>}
                </div>
            </div>

            {/* Toggle Button */}
            <div className="relative">
                <button
                    onClick={toggleCollapse}
                    className="absolute top-1/8 -translate-y-1/2 bg-base-300 hover:bg-base-200 hover:cursor-pointer 
                    border border-base-content/20 rounded-r-md h-20 w-6 flex items-center justify-center 
                    transition-colors duration-200 shadow-lg z-10"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    <div className="transform rotate-90 text-xs font-medium text-base-content/70">
                        Object
                    </div>
                </button>
            </div>
        </div>
    );
}

function ObjectTree() {
    return (
        <div className="text-sm">
            <details open>
                <summary className="cursor-pointer">Scenario</summary>

                <details className="ml-4" open>
                    <summary>Satellites</summary>
                    <div className="ml-4">
                        <div>Sat1</div>
                        <div>Sat2</div>
                    </div>
                </details>

                <details className="ml-4" open>
                    <summary>Sensors</summary>
                    <div className="ml-4">
                        <div>Sensor A</div>
                        <div>Sensor B</div>
                    </div>
                </details>

                <details className="ml-4" open>
                    <summary>Ground Stations</summary>
                </details>
            </details>
        </div>
    );
}
