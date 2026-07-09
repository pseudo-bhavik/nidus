import React, { useEffect, useRef } from 'react';
import { ExternalLink, Edit3, CheckSquare, Trash2, RotateCcw } from 'lucide-react';
import { Bookmark } from '../lib/types';

interface ContextMenuProps {
  x: number;
  y: number;
  bookmark: Bookmark;
  onClose: () => void;
  onOpenLink: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

export default function ContextMenu({
  x,
  y,
  bookmark,
  onClose,
  onOpenLink,
  onEdit,
  onToggleComplete,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape press
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust menu position to fit within the viewport
  const adjustPosition = () => {
    let finalX = x;
    let finalY = y;
    
    const menuWidth = 180;
    const menuHeight = 160;

    if (typeof window !== 'undefined') {
      if (x + menuWidth > window.innerWidth) {
        finalX = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        finalY = window.innerHeight - menuHeight - 10;
      }
    }
    
    return { left: finalX, top: finalY };
  };

  const pos = adjustPosition();

  return (
    <div
      ref={menuRef}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 w-44 rounded-md border border-neutral-200/60 bg-white shadow-xl py-1 text-xs text-neutral-800 font-semibold select-none divide-y divide-neutral-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-0.5">
        <button
          onClick={() => {
            onOpenLink();
            onClose();
          }}
          className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
          <span>Open Link</span>
        </button>
        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5 text-neutral-400" />
          <span>Edit Details...</span>
        </button>
      </div>

      <div className="py-0.5">
        {!bookmark.is_trashed && (
          <button
            onClick={() => {
              onToggleComplete();
              onClose();
            }}
            className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-neutral-400" />
            <span>{bookmark.is_completed ? 'Mark Uncompleted' : 'Mark Completed'}</span>
          </button>
        )}
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 text-left cursor-pointer font-bold"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
          <span>{bookmark.is_trashed ? 'Delete Forever' : 'Move to Trash'}</span>
        </button>
      </div>
    </div>
  );
}
