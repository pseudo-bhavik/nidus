'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  StickyNote as StickyNoteIcon, Plus, Search, Pin, Trash2, 
  Copy, Check, Palette, Sparkles, Filter, X, GripVertical, Cloud, RefreshCw
} from 'lucide-react';
import { StickyNote } from '../lib/types';
import { supabase } from '../lib/supabase';

interface StickyNotesViewProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
}

const COLOR_MAP: Record<string, { bg: string; border: string; header: string; text: string; dot: string }> = {
  yellow: {
    bg: 'bg-amber-50/90',
    border: 'border-amber-200',
    header: 'bg-amber-100/60',
    text: 'text-amber-950',
    dot: 'bg-amber-400',
  },
  green: {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-200',
    header: 'bg-emerald-100/60',
    text: 'text-emerald-950',
    dot: 'bg-emerald-400',
  },
  blue: {
    bg: 'bg-sky-50/90',
    border: 'border-sky-200',
    header: 'bg-sky-100/60',
    text: 'text-sky-950',
    dot: 'bg-sky-400',
  },
  pink: {
    bg: 'bg-rose-50/90',
    border: 'border-rose-200',
    header: 'bg-rose-100/60',
    text: 'text-rose-950',
    dot: 'bg-rose-400',
  },
  purple: {
    bg: 'bg-purple-50/90',
    border: 'border-purple-200',
    header: 'bg-purple-100/60',
    text: 'text-purple-950',
    dot: 'bg-purple-400',
  },
  orange: {
    bg: 'bg-orange-50/90',
    border: 'border-orange-200',
    header: 'bg-orange-100/60',
    text: 'text-orange-950',
    dot: 'bg-orange-400',
  },
  dark: {
    bg: 'bg-neutral-900',
    border: 'border-neutral-800',
    header: 'bg-neutral-800/80',
    text: 'text-neutral-100',
    dot: 'bg-neutral-400',
  },
};

const DEFAULT_NOTES: StickyNote[] = [
  {
    id: 'note-1',
    title: '💡 Quick Ideas',
    content: '1. Review design system tokens\n2. Organize bookmarks into collections\n3. Export backup JSON file',
    color: 'yellow',
    is_pinned: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'note-2',
    title: '📌 Reading Queue',
    content: 'Check out the new React 19 documentation and Next.js Turbopack compiler updates.',
    color: 'blue',
    is_pinned: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function StickyNotesView({ isSidebarOpen, onOpenSidebar }: StickyNotesViewProps) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Drag & Drop Reordering State
  const [draggedNoteIdx, setDraggedNoteIdx] = useState<number | null>(null);
  const [dragOverNoteIdx, setDragOverNoteIdx] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Load notes from Supabase cloud first (with localStorage fallback)
  useEffect(() => {
    let isMounted = true;

    const loadNotesData = async () => {
      setIsSyncing(true);
      try {
        const { data: dbNotes, error } = await supabase
          .from('sticky_notes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && dbNotes && dbNotes.length > 0 && isMounted) {
          const mapped: StickyNote[] = dbNotes.map((n: any) => ({
            id: n.id,
            title: n.title || 'Untitled Note',
            content: n.content || '',
            color: n.color || 'yellow',
            is_pinned: n.is_pinned ?? false,
            created_at: n.created_at,
            updated_at: n.updated_at,
          }));
          setNotes(mapped);
          localStorage.setItem('nidus_sticky_notes', JSON.stringify(mapped));
          setIsSyncing(false);
          return;
        }
      } catch (e) {}

      // LocalStorage fallback
      try {
        const saved = localStorage.getItem('nidus_sticky_notes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
            setNotes(parsed);
            setIsSyncing(false);
            return;
          }
        }
      } catch (e) {}

      if (isMounted) {
        setNotes(DEFAULT_NOTES);
        setIsSyncing(false);
      }
    };

    loadNotesData();
    return () => { isMounted = false; };
  }, []);

  // Save notes locally and sync to Supabase cloud
  const saveNotes = (updated: StickyNote[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('nidus_sticky_notes', JSON.stringify(updated));
    } catch (e) {}

    // Debounced sync to Supabase
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSyncing(true);
      try {
        const upsertPayload = updated.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          color: n.color,
          is_pinned: n.is_pinned ?? false,
          updated_at: n.updated_at || new Date().toISOString(),
        }));
        await supabase.from('sticky_notes').upsert(upsertPayload);
      } catch (err) {}
      setIsSyncing(false);
    }, 400);
  };

  // Add new note
  const handleAddNote = (color: StickyNote['color'] = 'yellow') => {
    const newNote: StickyNote = {
      id: 'note-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: 'New Note',
      content: '',
      color,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newNote, ...notes];
    saveNotes(updated);
  };

  // Update note content / title
  const handleUpdateNote = (id: string, updates: Partial<StickyNote>) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
    );
    saveNotes(updated);
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    try {
      await supabase.from('sticky_notes').delete().eq('id', id);
    } catch (e) {}
  };

  // Toggle pin note
  const handleTogglePin = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    handleUpdateNote(id, { is_pinned: !note.is_pinned });
  };

  // Copy note content
  const handleCopyNote = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Drag & Drop Handlers for Reordering Sticky Note Cards
  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedNoteIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverNoteIdx !== idx) {
      setDragOverNoteIdx(idx);
    }
  };

  const handleDrop = (dropIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedNoteIdx === null || draggedNoteIdx === dropIdx) {
      setDraggedNoteIdx(null);
      setDragOverNoteIdx(null);
      return;
    }

    const reordered = [...notes];
    const [moved] = reordered.splice(draggedNoteIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    saveNotes(reordered);
    setDraggedNoteIdx(null);
    setDragOverNoteIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedNoteIdx(null);
    setDragOverNoteIdx(null);
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      searchQuery === '' ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesColor = !filterColor || n.color === filterColor;
    return matchesSearch && matchesColor;
  });

  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.is_pinned);

  return (
    <div className="w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none">
      
      {/* Top Header Bar */}
      <div className="h-12 px-4 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-20">
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer mr-1"
              title="Open Sidebar"
            >
              <StickyNoteIcon className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <StickyNoteIcon className="w-4.5 h-4.5 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            <h1 className="font-bold text-sm text-neutral-900 tracking-tight">Sticky Notes</h1>
            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-full text-[10px] font-bold text-neutral-600">
              {notes.length}
            </span>
          </div>
        </div>

        {/* Action Controls & Search */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status Badge */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-[10px] text-neutral-500 font-medium"
            title="Sticky notes auto-sync across all signed in devices"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
            ) : (
              <Cloud className="w-3 h-3 text-emerald-500" />
            )}
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 w-36 sm:w-48 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 hidden sm:flex">
            <button
              onClick={() => setFilterColor(null)}
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                filterColor === null ? 'bg-white shadow-2xs text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              All
            </button>
            {Object.keys(COLOR_MAP).map((col) => (
              <button
                key={col}
                onClick={() => setFilterColor(filterColor === col ? null : col)}
                className={`w-3.5 h-3.5 rounded-full transition-transform ${COLOR_MAP[col].dot} ${
                  filterColor === col ? 'ring-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => handleAddNote('yellow')}
            className="px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Sticky Notes Scrollable Cards Grid Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-neutral-50/50">
        
        {filteredNotes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white border border-neutral-200 rounded-2xl shadow-2xs max-w-md mx-auto mt-12">
            <StickyNoteIcon className="w-10 h-10 text-neutral-300 mb-2" />
            <p className="text-sm font-bold text-neutral-700">No sticky notes found</p>
            <p className="text-xs text-neutral-400 mb-4 mt-1">Create your first sticky note or clear search filter</p>
            <button
              onClick={() => handleAddNote('yellow')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs"
            >
              + Create Sticky Note
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Pinned Notes Section */}
            {pinnedNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
                  <Pin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pinned Notes ({pinnedNotes.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {pinnedNotes.map((note) => {
                    const globalIdx = notes.findIndex((n) => n.id === note.id);
                    return renderStickyCard(note, globalIdx);
                  })}
                </div>
              </div>
            )}

            {/* Other Notes Section */}
            {unpinnedNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 pt-2 border-t border-neutral-200">
                    <span>Other Notes ({unpinnedNotes.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {unpinnedNotes.map((note) => {
                    const globalIdx = notes.findIndex((n) => n.id === note.id);
                    return renderStickyCard(note, globalIdx);
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render individual reorderable Sticky Note Card
  function renderStickyCard(note: StickyNote, index: number) {
    const style = COLOR_MAP[note.color] || COLOR_MAP.yellow;
    const isDragging = draggedNoteIdx === index;
    const isDragOver = dragOverNoteIdx === index;

    return (
      <div
        key={note.id}
        draggable
        onDragStart={(e) => handleDragStart(index, e)}
        onDragOver={(e) => handleDragOver(index, e)}
        onDrop={(e) => handleDrop(index, e)}
        onDragEnd={handleDragEnd}
        className={`group relative rounded-2xl border p-4 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-md ${
          style.bg
        } ${style.border} ${isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''} ${
          isDragOver ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''
        }`}
        style={{ minHeight: '180px' }}
      >
        <div>
          {/* Card Header Bar with Grip & Controls */}
          <div className={`-mx-4 -mt-4 px-3 py-2 rounded-t-2xl mb-3 flex items-center justify-between ${style.header}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <GripVertical className="w-3.5 h-3.5 text-neutral-400 cursor-grab active:cursor-grabbing shrink-0 hover:text-neutral-700" />
              <input
                type="text"
                value={note.title}
                onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                placeholder="Note title..."
                className={`font-bold text-xs bg-transparent border-none outline-none truncate ${style.text} focus:ring-1 focus:ring-indigo-500/30 rounded px-1`}
              />
            </div>

            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => handleTogglePin(note.id)}
                className={`p-1 rounded hover:bg-black/5 transition-colors ${
                  note.is_pinned ? 'text-indigo-600 font-bold' : 'text-neutral-400 hover:text-neutral-700'
                }`}
                title={note.is_pinned ? 'Unpin note' : 'Pin note to top & home screen widget'}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setColorPickerNoteId(colorPickerNoteId === note.id ? null : note.id)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-black/5 transition-colors relative"
                title="Change Note Color"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleCopyNote(note.id, `${note.title}\n${note.content}`)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-black/5 transition-colors"
                title="Copy content"
              >
                {copiedId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => handleDeleteNote(note.id)}
                className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                title="Delete Note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Color Picker Dropdown Popup */}
          {colorPickerNoteId === note.id && (
            <div className="mb-3 p-2 bg-white rounded-xl shadow-lg border border-neutral-200 flex items-center justify-between animate-fade-in z-10">
              <span className="text-[10px] font-bold text-neutral-500 uppercase">Select Color:</span>
              <div className="flex items-center gap-1.5">
                {Object.keys(COLOR_MAP).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      handleUpdateNote(note.id, { color: c as any });
                      setColorPickerNoteId(null);
                    }}
                    className={`w-4 h-4 rounded-full border border-black/10 transition-transform ${COLOR_MAP[c].dot} ${
                      note.color === c ? 'ring-2 ring-indigo-600 scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Note Editable Textarea */}
          <textarea
            value={note.content}
            onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
            placeholder="Type your notes here..."
            className={`w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed ${style.text} min-h-[100px] placeholder:text-neutral-400/70`}
          />
        </div>

        {/* Card Footer: Timestamp */}
        <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] text-neutral-400 mt-2">
          <span>{new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <span className="font-semibold">{note.content.length} chars</span>
        </div>
      </div>
    );
  }
}
