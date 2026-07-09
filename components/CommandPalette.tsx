import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, ArrowRight, CornerDownLeft, Inbox, Trash2, Library, CheckSquare, Plus, FileSpreadsheet } from 'lucide-react';
import { Bookmark } from '../lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onNavigateView: (view: string) => void;
  selectedCount: number;
  onBulkComplete: () => Promise<void>;
  onBulkTrash: () => Promise<void>;
  onEmptyTrash: () => Promise<void>;
  onOpenImportExport: () => void;
  onSelectBookmark: (bookmark: Bookmark) => void;
  onAddCategory: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  requiresSelection?: boolean;
}

export default function CommandPalette({
  isOpen,
  onClose,
  bookmarks,
  onNavigateView,
  selectedCount,
  onBulkComplete,
  onBulkTrash,
  onEmptyTrash,
  onOpenImportExport,
  onSelectBookmark,
  onAddCategory,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener for opening/closing the palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      setSearch('');
      setSelectedIndex(0);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle outside clicks
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Static commands list
  const staticCommands: CommandItem[] = [
    {
      id: 'go-all',
      title: 'Go to All Bookmarks',
      subtitle: 'Navigate to full bookmark catalog',
      icon: <Library className="w-4 h-4" />,
      action: () => { onNavigateView('all'); onClose(); },
    },
    {
      id: 'go-unsorted',
      title: 'Go to Unsorted Bookmarks',
      subtitle: 'Navigate to uncategorized link box',
      icon: <Inbox className="w-4 h-4" />,
      action: () => { onNavigateView('unsorted'); onClose(); },
    },
    {
      id: 'go-trash',
      title: 'Go to Trash bin',
      subtitle: 'View deleted bookmarks',
      icon: <Trash2 className="w-4 h-4" />,
      action: () => { onNavigateView('trash'); onClose(); },
    },
    {
      id: 'create-category',
      title: 'Create new Collection...',
      subtitle: 'Add a new category label',
      icon: <Plus className="w-4 h-4" />,
      action: () => { onAddCategory(); onClose(); },
    },
    {
      id: 'import-export',
      title: 'Import & Export settings',
      subtitle: 'Load browser bookmarks or download JSON',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      action: () => { onOpenImportExport(); onClose(); },
    },
    {
      id: 'bulk-complete',
      title: `Bulk Mark Completed (${selectedCount} selected)`,
      subtitle: 'Set completed status for active items',
      icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
      action: () => { onBulkComplete(); onClose(); },
      requiresSelection: true,
    },
    {
      id: 'bulk-trash',
      title: `Bulk Move to Trash (${selectedCount} selected)`,
      subtitle: 'Send selected links to the trash bin',
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      action: () => { onBulkTrash(); onClose(); },
      requiresSelection: true,
    },
    {
      id: 'empty-trash',
      title: 'Empty Trash folder',
      subtitle: 'Permanently delete all bookmarks in trash',
      icon: <Trash2 className="w-4 h-4 text-red-600" />,
      action: () => { onEmptyTrash(); onClose(); },
    },
  ];

  // Filter commands by selection state
  const availableCommands = staticCommands.filter(cmd => !cmd.requiresSelection || selectedCount > 0);

  // Spotlight bookmark query matching
  const matchingBookmarks = search.trim()
    ? bookmarks.filter(b => 
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.url.toLowerCase().includes(search.toLowerCase()) ||
        (b.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (b.notes || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 5) // Limit to 5 matches for display density
    : [];

  // Grouped results
  const filteredCommands = availableCommands.filter(cmd =>
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    (cmd.subtitle || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = filteredCommands.length + matchingBookmarks.length;

  // Arrow key lists control
  useEffect(() => {
    function handleArrowNav(e: KeyboardEvent) {
      if (!isOpen || totalItems === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        triggerIndexAction(selectedIndex);
      }
    }
    
    document.addEventListener('keydown', handleArrowNav);
    return () => document.removeEventListener('keydown', handleArrowNav);
  }, [isOpen, selectedIndex, totalItems]);

  const triggerIndexAction = (idx: number) => {
    if (idx < filteredCommands.length) {
      filteredCommands[idx].action();
    } else {
      const bIdx = idx - filteredCommands.length;
      onSelectBookmark(matchingBookmarks[bIdx]);
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const listElement = listRef.current;
    if (listElement) {
      const selectedElement = listElement.childNodes[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-xs p-4 pt-[12vh]">
      <div 
        ref={containerRef}
        className="w-full max-w-xl bg-white border border-neutral-200/60 rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all-custom text-xs"
      >
        {/* Command Search Bar */}
        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-neutral-100 bg-neutral-50/50">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search bookmark contents..."
            className="w-full bg-transparent outline-none py-1 text-sm text-neutral-700 placeholder-neutral-400 font-medium"
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 text-[9px] bg-neutral-200/60 border border-neutral-300 text-neutral-500 rounded font-bold uppercase tracking-wider shrink-0 select-none">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div 
          ref={listRef}
          className="max-h-[320px] overflow-y-auto py-1.5 flex flex-col"
        >
          {/* Commands section */}
          {filteredCommands.length > 0 && (
            <>
              <div className="px-3 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-wider select-none">
                Commands
              </div>
              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between cursor-pointer transition-all-custom ${
                      isSelected ? 'bg-neutral-900/5 text-neutral-800' : 'text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-1 rounded bg-neutral-100 ${isSelected ? 'bg-white' : ''}`}>
                        {cmd.icon}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold">{cmd.title}</p>
                        {cmd.subtitle && <p className="text-[10px] text-neutral-400 font-medium">{cmd.subtitle}</p>}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-semibold select-none shrink-0">
                        <span>Run</span>
                        <CornerDownLeft className="w-3 h-3 text-neutral-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Bookmarks section */}
          {matchingBookmarks.length > 0 && (
            <>
              <div className="px-3 py-1 mt-2 text-[9px] font-bold text-neutral-400 uppercase tracking-wider select-none">
                Scraped Bookmarks Matches
              </div>
              {matchingBookmarks.map((bookmark, bIdx) => {
                const idx = filteredCommands.length + bIdx;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={bookmark.id}
                    onClick={() => {
                      onSelectBookmark(bookmark);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between cursor-pointer transition-all-custom ${
                      isSelected ? 'bg-neutral-900/5 text-neutral-800' : 'text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-6 h-6 rounded border border-neutral-200 flex items-center justify-center bg-white overflow-hidden shrink-0`}>
                        {bookmark.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={bookmark.thumbnail_url} alt="" className="object-cover w-full h-full" />
                        ) : (
                          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold truncate">{bookmark.title}</p>
                        <p className="text-[10px] text-neutral-400 font-medium truncate">{bookmark.url}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-semibold select-none shrink-0">
                        <span>Open Inspector</span>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          )}

          {totalItems === 0 && (
            <div className="px-4 py-8 text-center text-neutral-400 font-medium select-none">
              No commands or bookmarks matched "{search}"
            </div>
          )}
        </div>

        {/* Footer info keys */}
        <div className="px-3 py-2 bg-neutral-50/50 border-t border-neutral-100 flex items-center gap-4 text-[10px] text-neutral-400 font-semibold select-none">
          <div className="flex items-center gap-1">
            <span className="px-1 py-0.2 bg-neutral-200/60 border border-neutral-300 rounded font-mono text-[9px]">↑↓</span>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.2 bg-neutral-200/60 border border-neutral-300 rounded font-mono text-[9px]">Enter</span>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.2 bg-neutral-200/60 border border-neutral-300 rounded font-mono text-[9px]">Esc</span>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
