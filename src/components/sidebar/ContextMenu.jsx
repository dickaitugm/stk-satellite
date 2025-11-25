/**
 * Context Menu Component
 * Right-click menu for object actions
 */

import { useEffect, useRef } from 'react';

const ContextMenu = ({ x, y, items, onClose }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = () => {
    const menuWidth = 180;
    const menuHeight = items.length * 36 + 8;
    
    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > window.innerWidth) {
      adjustedX = x - menuWidth;
    }
    if (y + menuHeight > window.innerHeight) {
      adjustedY = y - menuHeight;
    }

    return { left: adjustedX, top: adjustedY };
  };

  const pos = adjustedPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-base-200 border border-base-300 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((item, index) => (
        item.separator ? (
          <div key={index} className="border-t border-base-300 my-1" />
        ) : (
          <button
            key={index}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-primary hover:text-primary-content transition-colors ${item.danger ? 'text-error hover:bg-error hover:text-error-content' : ''} ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            {item.icon && <span className="w-4 h-4">{item.icon}</span>}
            {item.label}
            {item.shortcut && (
              <span className="ml-auto text-xs opacity-60">{item.shortcut}</span>
            )}
          </button>
        )
      ))}
    </div>
  );
};

export default ContextMenu;
