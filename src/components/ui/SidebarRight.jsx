import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SidebarRight() {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className="relative flex h-full">
            {/* Sidebar */}
            <div
                className={`
                    bg-base-200 border-l border-base-content/20 h-full
                    transition-all duration-300 ease-in-out
                    ${isCollapsed ? "w-0 overflow-hidden" : "w-72"}
                `}
            >
                {/* Content */}
                {!isCollapsed && (
                    <div className="p-3">
                        <h2 className="text-lg font-bold mb-2">Properties</h2>
                        <div className="text-sm">Select an object to see details.</div>
                    </div>
                )}
            </div>

            {/* Toggle Button (outside, left side of sidebar) */}
            <button
                onClick={toggleCollapse}
                className="
                    absolute top-1/8 -left-6 -translate-y-1/2
                    bg-base-300 hover:bg-base-200
                    border border-base-content/20 rounded-l-md
                    h-20 w-6 flex items-center justify-center
                    transition-colors duration-200 shadow-lg z-10 hover:cursor-pointer
                "
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <div className="transform rotate-270 text-xs font-medium text-base-content/70">
                    Props
                </div>
            </button>
        </div>
    );
}
