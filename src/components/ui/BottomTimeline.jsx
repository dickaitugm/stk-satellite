export default function BottomTimeline() {
    return (
        <div className="h-16 bg-base-300 w-full border-t border-base-content/20 px-4 flex items-center z-20">
            <div className="flex-1">
                <input type="range" className="range range-xs w-full" />
            </div>
            <div className="ml-4">
                <button className="btn btn-sm">1x</button>
            </div>
        </div>
    );
}
