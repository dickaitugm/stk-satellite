/**
 * TreeNode Component
 * Reusable tree node with expand/collapse, icon, context menu support
 */

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Eye, EyeOff } from 'lucide-react';

const TreeNode = ({ 
  item, 
  icon: Icon,
  children,
  level = 0,
  isSelected,
  onSelect,
  onToggleVisibility,
  onContextMenu,
  renderLabel
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children && children.length > 0;
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(item.id);
    }
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, item);
    }
  };

  const handleVisibilityClick = (e) => {
    e.stopPropagation();
    if (onToggleVisibility) {
      onToggleVisibility(item.id);
    }
  };

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 py-1 px-1 rounded cursor-pointer transition-colors
          ${isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-base-300'}
        `}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button 
            onClick={handleExpandClick}
            className="p-0.5 hover:bg-base-100 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4" /> // Spacer
        )}

        {/* Icon */}
        {Icon && (
          <Icon 
            className="w-4 h-4 flex-shrink-0" 
            style={{ 
              color: item.color ? 
                `rgba(${Math.round(item.color.r * 255)}, ${Math.round(item.color.g * 255)}, ${Math.round(item.color.b * 255)}, 1)` 
                : undefined 
            }}
          />
        )}

        {/* Label */}
        <span className="flex-1 text-sm truncate">
          {renderLabel ? renderLabel(item) : item.name}
        </span>

        {/* Visibility toggle */}
        {item.isVisible !== undefined && (
          <button
            onClick={handleVisibilityClick}
            className="p-0.5 hover:bg-base-100 rounded opacity-60 hover:opacity-100"
            title={item.isVisible ? 'Hide' : 'Show'}
          >
            {item.isVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3 text-slate-500" />
            )}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
