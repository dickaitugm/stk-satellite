export default function TopNavbar() {
    return (
        <div className="h-12 w-full flex items-center px-4 bg-base-300 shadow-md z-20">
            <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost">New</button>
                <button className="btn btn-sm btn-ghost">Add Satellite</button>
                <button className="btn btn-sm btn-ghost">Add Sensor</button>
                <button className="btn btn-sm btn-ghost">Add Ground Station</button>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost">Settings</button>
            </div>
        </div>
    );
}
