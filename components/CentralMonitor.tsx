import React, { useState } from 'react';
import { Plus, Trash2, Search, Check, FolderOpen, PanelLeftOpen, AlertCircle, RotateCcw, X } from 'lucide-react';
import { Bookmark, ViewType } from '../lib/types';
import BadgeDropdown from './BadgeDropdown';
import Spinner from './Spinner';
import QuickStickyNotesWidget from './QuickStickyNotesWidget';

interface CentralMonitorProps {
  bookmarks: Bookmark[]; // All bookmarks (to calculate metrics globally or filtered)
  filteredBookmarks: Bookmark[]; // Filtered bookmarks to display in the list
  currentView: ViewType;
  onAddBookmark: (url: string) => Promise<void>;
  onUpdateBookmark: (id: string, updates: Partial<Bookmark>) => Promise<void>;
  onDeleteBookmark: (id: string) => Promise<void>;
  onRestoreBookmark: (id: string) => Promise<void>;
  activeBookmarkId: string | null;
  onSelectBookmark: (bookmark: Bookmark) => void;
  categories: string[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkComplete: () => Promise<void>;
  onBulkTrash: () => Promise<void>;
  onBulkChangeCategory: (cat: string) => Promise<void>;
  onBulkChangePriority: (prio: 'Low' | 'Medium' | 'High') => Promise<void>;
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onRowContextMenu: (e: React.MouseEvent, bookmark: Bookmark) => void;
  highPriorityOnly: boolean;
  onToggleHighPriority: () => void;
  activeDensity: string;
  activeHighlightStyle: string;
  onOpenStickyNotes?: () => void;
}

export default function CentralMonitor({
  bookmarks,
  filteredBookmarks,
  currentView,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  onRestoreBookmark,
  activeBookmarkId,
  onSelectBookmark,
  categories,
  searchQuery,
  onSearchQueryChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onBulkComplete,
  onBulkTrash,
  onBulkChangeCategory,
  onBulkChangePriority,
  isSidebarOpen,
  onOpenSidebar,
  onRowContextMenu,
  highPriorityOnly,
  onToggleHighPriority,
  activeDensity,
  activeHighlightStyle,
  onOpenStickyNotes,
}: CentralMonitorProps) {
  const [urlInput, setUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBulkCategoryDropdown, setShowBulkCategoryDropdown] = useState(false);
  const [showBulkPriorityDropdown, setShowBulkPriorityDropdown] = useState(false);

  // Ingest handler
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setSubmitting(true);
    try {
      await onAddBookmark(urlInput.trim());
      setUrlInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics (calculated dynamically BASED ON THE SELECTED VIEW/COLLECTION)
  const viewBookmarks = bookmarks.filter((b) => {
    if (currentView === 'all') {
      return !b.is_trashed;
    } else if (currentView === 'unsorted') {
      const cats = b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : [];
      return !b.is_trashed && (cats.length === 0 || cats.includes('Unsorted'));
    } else if (currentView === 'trash') {
      return b.is_trashed;
    } else {
      // Bookmark is in a category if the categories list contains currentView
      const cats = b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : ['Unsorted'];
      return !b.is_trashed && cats.includes(currentView);
    }
  });

  const totalSaved = viewBookmarks.length;
  const toLearn = viewBookmarks.filter((b) => !b.is_completed).length;
  const completed = viewBookmarks.filter((b) => b.is_completed).length;
  const successProgress = totalSaved > 0 ? Math.round((completed / totalSaved) * 100) : 0;

  // Header display name based on view
  const getHeaderTitle = () => {
    if (currentView === 'all') return 'All Bookmarks';
    if (currentView === 'unsorted') return 'Unsorted Inbox';
    if (currentView === 'trash') return 'Trash Bin';
    return `Collection: ${currentView}`;
  };

  const isAllSelected = filteredBookmarks.length > 0 && selectedIds.length === filteredBookmarks.length;

  return (
    <div className="flex-1 h-full bg-[#f6f6ef] flex flex-col relative select-text">
      {/* Top static bar */}
      <div className="px-5 py-3.5 bg-white border-b border-border-color flex items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {/* Sidebar toggler menu button */}
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-500 hover:text-neutral-700 cursor-pointer transition-all-custom shrink-0 mr-1"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}

          {/* URL Ingestion Form */}
          <form onSubmit={handleIngest} className="flex items-center flex-1 gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Type or paste a URL to bookmark..."
              className="w-full border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded-md px-3 py-2 text-sm outline-none bg-neutral-50/20 font-semibold transition-all-custom"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#ff6600] hover:bg-[#e05a00] text-white font-bold rounded-md text-xs cursor-pointer transition-all-custom shrink-0 flex items-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed shadow-xs"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              {submitting ? (
                <>
                  <Spinner size="sm" className="border-t-transparent border-white" />
                  <span>Scraping...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Global Instant Search */}
        <div className="flex items-center gap-2 max-w-xs flex-1 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Instant search by title, URL..."
            className="w-full pl-10 pr-8 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded-md text-xs outline-none bg-neutral-50/20 font-semibold transition-all-custom"
            style={{ paddingLeft: '2.5rem' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="absolute right-2.5 p-1 hover:bg-neutral-200/70 rounded-full text-neutral-400 hover:text-neutral-700 cursor-pointer transition-all-custom"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="px-5 py-2.5 border-b border-border-color bg-white/40 flex items-center gap-6 text-[12px] font-bold text-neutral-500 select-none shrink-0">
        <div>
          Total Saved: <span className="text-neutral-800 font-extrabold">{totalSaved}</span>
        </div>
        <div className="w-[1px] h-3 bg-neutral-200" />
        <div>
          To Learn: <span className="text-neutral-800 font-extrabold">{toLearn}</span>
        </div>
        <div className="w-[1px] h-3 bg-neutral-200" />
        <div>
          Completed: <span className="text-emerald-600 font-extrabold">{completed}</span>
        </div>
        <div className="w-[1px] h-3 bg-neutral-200" />
        <div className="flex items-center gap-2">
          <span>Success Progress:</span>
          <div className="w-20 h-1.5 bg-neutral-255 rounded-full overflow-hidden inline-block align-middle border border-neutral-200/30">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${successProgress}%` }} />
          </div>
          <span className="text-emerald-605 font-extrabold">{successProgress}%</span>
        </div>
      </div>

      {/* View Header with select-all checkbox */}
      <div className="px-5 py-3 bg-[#f6f6ef] border-b border-border-color/40 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-3 font-extrabold text-[14px] text-neutral-800 tracking-tight">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={onToggleSelectAll}
            className="rounded text-hn-orange cursor-pointer border-neutral-300 w-4 h-4"
            disabled={filteredBookmarks.length === 0}
          />
          <span>{getHeaderTitle()}</span>
          <span className="text-[11px] font-bold text-neutral-400 bg-neutral-200/50 px-2 py-0.5 rounded-full">
            {filteredBookmarks.length}
          </span>
        </div>

        {/* Right side filters/badges container */}
        <div className="flex items-center gap-3">
          {/* High Priority Filter Switch (Premium trial element) */}
          <button
            onClick={onToggleHighPriority}
            className={`px-3 py-1 rounded-md text-[10.5px] font-bold border transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
              highPriorityOnly
                ? 'bg-red-50 text-red-700 border-red-250 shadow-xs'
                : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <AlertCircle className={`w-3.5 h-3.5 ${highPriorityOnly ? 'text-red-500 animate-pulse' : 'text-neutral-400'}`} />
            <span>High Priority Only</span>
          </button>

          {searchQuery && (
            <span className="text-[10px] bg-hn-orange/10 text-hn-orange px-2 py-0.5 rounded font-bold" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}>
              Filtered View
            </span>
          )}
        </div>
      </div>

      {/* Bookmarks rows area */}
      <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-1.5 font-sans">
        {filteredBookmarks.length > 0 ? (
          filteredBookmarks.map((bookmark, index) => {
            const isSelected = selectedIds.includes(bookmark.id);
            const isActive = activeBookmarkId === bookmark.id;

            // Set padding and gap classes based on activeDensity state
            let rowPaddingClass = 'py-2.5 px-3.5 gap-3.5'; // Default cozy
            if (activeDensity === 'compact') {
              rowPaddingClass = 'py-1.5 px-3 gap-2.5';
            } else if (activeDensity === 'spacious') {
              rowPaddingClass = 'py-4 px-5 gap-4';
            }

            // Set highlight styling based on activeHighlightStyle selection
            let highlightStyleClass = isActive
              ? activeHighlightStyle === 'border'
                ? 'bg-white border-neutral-300/80 shadow-sm border-l-3 pl-[11px]'
                : 'bg-white border-neutral-300/40 shadow-xs border-l-0'
              : 'border-transparent hover:bg-neutral-900/3';

            return (
              <div
                key={bookmark.id}
                onClick={() => onSelectBookmark(bookmark)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRowContextMenu(e, bookmark);
                }}
                className={`rounded-md flex items-start transition-all-custom group cursor-pointer border ${rowPaddingClass} ${highlightStyleClass}`}
                style={
                  isActive
                    ? activeHighlightStyle === 'border'
                      ? { borderLeftColor: 'var(--accent-color)' }
                      : { backgroundColor: 'rgba(var(--accent-rgb), 0.08)', borderLeftColor: 'transparent' }
                    : {}
                }
              >
                {/* Select Checkbox */}
                <div 
                  className="pt-0.5 shrink-0" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(bookmark.id);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Controlled by outer div onClick
                    className="rounded cursor-pointer border-neutral-300 w-4 h-4 accent-hn-orange"
                  />
                </div>

                {/* Index number & Main HN-style container */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  {/* Line 1: Title and domain */}
                  <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                    <span className="text-[11px] text-neutral-400 select-none font-bold">
                      {index + 1}.
                    </span>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`font-semibold text-neutral-900 hover:underline text-[13.5px] truncate leading-tight transition-colors duration-150 ${
                        bookmark.is_completed ? 'line-through opacity-55 font-medium' : ''
                      }`}
                      style={{ '--hover-color': 'var(--accent-color)' } as any}
                    >
                      {bookmark.title}
                    </a>
                    <span className="text-[11px] text-neutral-400 select-none font-bold truncate">
                      ({bookmark.domain})
                    </span>
                  </div>

                  {/* Line 2: Notion properties & controls */}
                  <div className="flex items-center gap-3 text-neutral-400 font-bold select-none flex-wrap">
                    {/* Category Dropdown */}
                    {!bookmark.is_trashed && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <BadgeDropdown
                          type="category"
                          value={bookmark.category}
                          options={categories}
                          onChange={(val) => onUpdateBookmark(bookmark.id, { category: val })}
                        />
                      </div>
                    )}

                    {/* Priority Dropdown */}
                    {!bookmark.is_trashed && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <BadgeDropdown
                          type="priority"
                          value={bookmark.priority}
                          options={['Low', 'Medium', 'High']}
                          onChange={(val) => onUpdateBookmark(bookmark.id, { priority: val as any })}
                        />
                      </div>
                    )}

                    {/* Separator */}
                    {!bookmark.is_trashed && <span className="text-neutral-200 font-light">|</span>}

                    {/* Completed Checkbox Toggle */}
                    {!bookmark.is_trashed && (
                      <label 
                        className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold text-neutral-500 hover:text-neutral-700 select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={bookmark.is_completed}
                          onChange={(e) => onUpdateBookmark(bookmark.id, { is_completed: e.target.checked })}
                          className="rounded cursor-pointer border-neutral-300 w-3.5 h-3.5 accent-emerald-500"
                        />
                        <span>{bookmark.is_completed ? 'Completed' : 'Mark Done'}</span>
                      </label>
                    )}

                    {/* Reading time indicator */}
                    <span className="text-[10.5px] text-neutral-400/80 font-bold">
                      • {bookmark.read_time_minutes}m read
                    </span>

                    {/* Trash/Restore action icon */}
                    <span className="text-neutral-200 font-light">|</span>
                    {bookmark.is_trashed ? (
                      <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onRestoreBookmark(bookmark.id)}
                          className="text-[10.5px] text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => onDeleteBookmark(bookmark.id)}
                          className="text-[10.5px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBookmark(bookmark.id);
                        }}
                        className="text-neutral-400 hover:text-red-500 p-0.5 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Trash Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-2.5 py-16 select-none">
            <FolderOpen className="w-10 h-10 stroke-1" />
            <span className="font-bold text-xs">
              {searchQuery ? `No matches found for "${searchQuery}"` : 'This folder is empty.'}
            </span>
          </div>
        )}
      </div>

      {/* Bulk actions sliding drawer */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 border border-neutral-800 text-white rounded-lg shadow-2xl px-4 py-2.5 flex items-center gap-4 text-xs font-semibold glass">
          <span className="text-neutral-300 font-bold border-r border-neutral-700 pr-3">
            {selectedIds.length} selected
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onBulkComplete}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/20 text-white rounded transition-all-custom cursor-pointer"
            >
              Mark Completed
            </button>

            {/* Bulk Category Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBulkCategoryDropdown(!showBulkCategoryDropdown);
                  setShowBulkPriorityDropdown(false);
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded transition-all-custom cursor-pointer"
              >
                Change Category
              </button>
              {showBulkCategoryDropdown && (
                <div className="absolute bottom-8 left-0 z-50 w-44 rounded-md bg-neutral-900 border border-neutral-800 shadow-xl text-neutral-200 py-1 max-h-40 overflow-y-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        onBulkChangeCategory(cat);
                        setShowBulkCategoryDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-white/10 cursor-pointer font-medium"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Priority Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBulkPriorityDropdown(!showBulkPriorityDropdown);
                  setShowBulkCategoryDropdown(false);
                }}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded transition-all-custom cursor-pointer"
              >
                Change Priority
              </button>
              {showBulkPriorityDropdown && (
                <div className="absolute bottom-8 left-0 z-50 w-36 rounded-md bg-neutral-900 border border-neutral-800 shadow-xl text-neutral-200 py-1">
                  {(['Low', 'Medium', 'High'] as const).map((prio) => (
                    <button
                      key={prio}
                      onClick={() => {
                        onBulkChangePriority(prio);
                        setShowBulkPriorityDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-white/10 cursor-pointer font-medium"
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onBulkTrash}
              className="px-2.5 py-1 bg-red-650 hover:bg-red-700 text-white rounded transition-all-custom cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Trash Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Pinned Quick Sticky Notes Floating Widget on Home Screen */}
      <QuickStickyNotesWidget onOpenFullNotes={onOpenStickyNotes} />
    </div>
  );
}
