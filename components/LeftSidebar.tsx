import React from 'react';
import { Bookmark, Inbox, Trash2, Folder, Database, UploadCloud, Settings, LogIn, User, ChevronLeft, Plus, Keyboard } from 'lucide-react';
import { Bookmark as BookmarkType, ViewType } from '../lib/types';

interface LeftSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  bookmarks: BookmarkType[];
  isDbConnected: boolean;
  onOpenImportExport: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenAuth: () => void;
  userEmail: string | null;
  onCloseSidebar: () => void;
  onAddCategory: () => void;
  onDeleteCategory: (category: string) => void;
  categories: string[];
}

export default function LeftSidebar({
  currentView,
  onViewChange,
  bookmarks,
  isDbConnected,
  onOpenImportExport,
  onOpenSettings,
  onOpenAuth,
  userEmail,
  onCloseSidebar,
  onAddCategory,
  onDeleteCategory,
  categories,
}: LeftSidebarProps) {
  // Aggregate categories and counts (supporting bookmarks in multiple collections)
  const activeBookmarks = bookmarks.filter((b) => !b.is_trashed);
  const categoriesMap = activeBookmarks.reduce((acc, b) => {
    const cats = b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : ['Unsorted'];
    cats.forEach((cat) => {
      acc[cat] = (acc[cat] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = [...categories].sort((a, b) => {
    if (a === 'Unsorted') return 1;
    if (b === 'Unsorted') return -1;
    return a.localeCompare(b);
  });

  const totalActive = activeBookmarks.length;
  const unsortedCount = activeBookmarks.filter((b) => b.category === 'Unsorted').length;
  const trashedCount = bookmarks.filter((b) => b.is_trashed).length;

  return (
    <div className="w-[240px] h-full bg-sidebar-bg border-r border-border-color flex flex-col justify-between shrink-0 select-none text-xs">
      <div className="flex flex-col overflow-y-auto">
        {/* App Title */}
        <div className="px-4 py-4.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/Nidus logo.png"
              alt="Nidus Logo"
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
            />
            <span className="font-bold text-sm tracking-tight text-neutral-800">Nidus</span>
            <span className="text-[9px] font-bold bg-hn-orange/10 text-hn-orange px-1 rounded" style={{ color: 'var(--accent-color)', backgroundColor: 'rgba(var(--accent-rgb), 0.1)' }}>v1.2</span>
          </div>
          <button
            onClick={onCloseSidebar}
            className="p-1 hover:bg-neutral-200/60 rounded-md text-neutral-400 hover:text-neutral-600 cursor-pointer transition-all-custom"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tree navigation */}
        <div className="px-2 py-2 flex flex-col gap-0.5">
          <button
            onClick={() => onViewChange('all')}
            className={`w-full px-3 py-1.5 rounded-md flex items-center justify-between font-bold cursor-pointer transition-all-custom ${
              currentView === 'all'
                ? 'bg-neutral-900/5 text-neutral-800'
                : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>All Bookmarks</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-bold">{totalActive}</span>
          </button>

          <button
            onClick={() => onViewChange('unsorted')}
            className={`w-full px-3 py-1.5 rounded-md flex items-center justify-between font-bold cursor-pointer transition-all-custom ${
              currentView === 'unsorted'
                ? 'bg-neutral-900/5 text-neutral-800'
                : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Inbox className="w-3.5 h-3.5 shrink-0" />
              <span>Unsorted</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-bold">{unsortedCount}</span>
          </button>

          <button
            onClick={() => onViewChange('trash')}
            className={`w-full px-3 py-1.5 rounded-md flex items-center justify-between font-bold cursor-pointer transition-all-custom ${
              currentView === 'trash'
                ? 'bg-neutral-900/5 text-neutral-800'
                : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Trash</span>
            </div>
            <span className="text-[10px] text-neutral-400 font-bold">{trashedCount}</span>
          </button>
        </div>

        {/* Separator */}
        <hr className="border-border-color my-1 mx-4" />

        {/* Collections / Categories */}
        <div className="px-2 py-2 flex flex-col gap-1">
          <div className="px-3 flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider select-none mb-1">
            <span>Collections</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddCategory();
              }}
              className="p-0.5 hover:bg-neutral-200/60 text-neutral-400 hover:text-neutral-600 rounded transition-all-custom cursor-pointer"
              title="Create Collection"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
            {sortedCategories.map((cat) => {
              if (cat === 'Unsorted') return null;
              
              const isSelected = currentView === cat;
              return (
                <button
                  key={cat}
                  onClick={() => onViewChange(cat)}
                  className={`w-full px-3 py-1.5 rounded-md flex items-center justify-between font-bold cursor-pointer transition-all-custom group ${
                    isSelected
                      ? 'bg-neutral-900/5 text-neutral-800'
                      : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <Folder className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                    <span className="truncate">{cat}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-neutral-400 font-bold group-hover:hidden">
                      {categoriesMap[cat] || 0}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCategory(cat);
                      }}
                      className="hidden group-hover:block p-0.5 hover:bg-neutral-200/80 hover:text-red-600 rounded text-neutral-400 transition-all-custom cursor-pointer"
                      title={`Delete Collection "${cat}"`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              );
            })}

            {sortedCategories.filter(c => c !== 'Unsorted').length === 0 && (
              <div className="px-3 py-2 text-neutral-400 italic font-bold select-none">
                No collections yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer controls & Connection */}
      <div className="p-3.5 bg-neutral-50/40 flex flex-col gap-2.5">
        {/* Horizontal Row of Icons with hover tooltips (border box removed) */}
        <div className="flex items-center justify-around gap-1 py-1 select-none">
          
          {/* 1. Keyboard Shortcuts */}
          <div className="relative group/tooltip">
            <button
              onClick={() => onOpenSettings('vim')}
              className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-700 cursor-pointer transition-all-custom"
            >
              <Keyboard className="w-5 h-5 shrink-0" />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 whitespace-nowrap font-bold z-50 shadow-md">
              Shortcuts
            </span>
          </div>

          {/* 2. Settings & Manual */}
          <div className="relative group/tooltip">
            <button
              onClick={() => onOpenSettings('guide')}
              className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-700 cursor-pointer transition-all-custom"
            >
              <Settings className="w-5 h-5 shrink-0" />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 whitespace-nowrap font-bold z-50 shadow-md">
              Settings & Guide
            </span>
          </div>

          {/* 3. Import & Export */}
          <div className="relative group/tooltip">
            <button
              onClick={onOpenImportExport}
              className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-700 cursor-pointer transition-all-custom"
            >
              <UploadCloud className="w-5 h-5 shrink-0" />
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 whitespace-nowrap font-bold z-50 shadow-md">
              Import & Export
            </span>
          </div>

          {/* 4. Authentication (LogIn or Profile) */}
          <div className="relative group/tooltip">
            {userEmail ? (
              <>
                <button
                  onClick={() => onOpenSettings('account')}
                  className="p-1.5 hover:bg-neutral-100 rounded-md text-hn-orange hover:text-hn-orange/80 cursor-pointer transition-all-custom"
                  style={{ color: 'var(--accent-color)' }}
                >
                  <User className="w-5 h-5 shrink-0" />
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 whitespace-nowrap font-bold z-50 shadow-md">
                  Account: {userEmail.split('@')[0]}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={onOpenAuth}
                  className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-700 cursor-pointer transition-all-custom"
                >
                  <LogIn className="w-5 h-5 shrink-0" />
                </button>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-[10px] rounded opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 whitespace-nowrap font-bold z-50 shadow-md">
                  Login / Sign Up
                </span>
              </>
            )}
          </div>
        </div>

        {/* Database connectivity status */}
        <div className="flex items-center justify-between px-1.5 pt-1 text-[10px] font-semibold text-neutral-400 select-none">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>Supabase Sync</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[9px] uppercase tracking-wider font-bold">
              {isDbConnected ? 'Online' : 'Demo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
