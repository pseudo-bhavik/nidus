'use client';

import React, { useState, useEffect } from 'react';
import { 
  StickyNote as StickyNoteIcon, Plus, Search, Pin, Trash2, 
  Copy, Check, Palette, Sparkles, Filter
} from 'lucide-react';
import { StickyNote } from '../lib/types';

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

  // Load notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nidus_sticky_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load sticky notes:', e);
    }
    setNotes(DEFAULT_NOTES);
  }, []);

  // Save notes to storage
  const saveNotes = (updated: StickyNote[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('nidus_sticky_notes', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save sticky notes:', e);
    }
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
  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
  };

  // Toggle pin
  const handleTogglePin = (id: string) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, is_pinned: !n.is_pinned } : n
    );
    saveNotes(updated);
  };

  // Copy note text
  const handleCopyNote = (note: StickyNote) => {
    const fullText = `${note.title}\n\n${note.content}`;
    navigator.clipboard.writeText(fullText);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  // Sort pinned to top
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="w-full h-full flex flex-col bg-white text-neutral-800 overflow-hidden select-none">
      {/* Header bar */}
      <div className="h-11 px-4 bg-neutral-50/90 border-b border-border-color flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-200/60 rounded text-neutral-500 hover:text-neutral-700 cursor-pointer mr-1"
            >
              <StickyNoteIcon className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <div className="flex items-center gap-1.5 font-bold text-neutral-800 text-sm">
            <StickyNoteIcon className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            <span>Sticky Notes</span>
            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-200/60 px-1.5 py-0.2 rounded-full">
              {notes.length}
            </span>
          </div>
        </div>

        {/* Right Controls: Search & New Note Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white border border-neutral-250 rounded-md text-[11px] font-medium outline-none w-36 focus:w-48 transition-all duration-200"
            />
          </div>

          <button
            onClick={() => handleAddNote('yellow')}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-md flex items-center gap-1.5 text-[11px] cursor-pointer transition-all-custom shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-5 bg-neutral-100/40">
        {sortedNotes.length === 0 ? (
          <div className="w-full h-64 flex flex-col items-center justify-center gap-2 text-neutral-400">
            <StickyNoteIcon className="w-8 h-8 opacity-40" />
            <p className="text-xs font-semibold">No sticky notes found</p>
            <button
              onClick={() => handleAddNote('yellow')}
              className="mt-2 text-xs font-bold text-hn-orange hover:underline cursor-pointer"
              style={{ color: 'var(--accent-color)' }}
            >
              + Create your first sticky note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedNotes.map((note) => {
              const theme = COLOR_MAP[note.color] || COLOR_MAP.yellow;
              const isDark = note.color === 'dark';

              return (
                <div
                  key={note.id}
                  className={`group rounded-xl border ${theme.bg} ${theme.border} shadow-xs hover:shadow-md transition-all duration-200 flex flex-col min-h-[200px] max-h-[340px] relative overflow-hidden`}
                >
                  {/* Card Header */}
                  <div className={`px-3 py-2 ${theme.header} flex items-center justify-between border-b ${theme.border} shrink-0`}>
                    <input
                      type="text"
                      value={note.title}
                      onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                      placeholder="Note Title"
                      className={`font-bold text-xs bg-transparent outline-none w-full ${theme.text} placeholder:${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}
                    />

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {/* Pin button */}
                      <button
                        onClick={() => handleTogglePin(note.id)}
                        className={`p-1 rounded cursor-pointer transition-all-custom ${
                          note.is_pinned
                            ? 'text-amber-600 bg-amber-200/60'
                            : `${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-700'}`
                        }`}
                        title={note.is_pinned ? 'Unpin Note' : 'Pin Note to Top'}
                      >
                        <Pin className="w-3 h-3 fill-current" />
                      </button>

                      {/* Color Picker Toggle */}
                      <div className="relative">
                        <button
                          onClick={() => setColorPickerNoteId(colorPickerNoteId === note.id ? null : note.id)}
                          className={`p-1 rounded cursor-pointer transition-all-custom ${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-700'}`}
                          title="Change Note Color"
                        >
                          <Palette className="w-3 h-3" />
                        </button>

                        {colorPickerNoteId === note.id && (
                          <div className="absolute right-0 top-full mt-1 p-1.5 bg-white border border-neutral-250 rounded-lg shadow-lg flex items-center gap-1 z-30 animate-fade-in">
                            {Object.keys(COLOR_MAP).map((cKey) => (
                              <button
                                key={cKey}
                                onClick={() => {
                                  handleUpdateNote(note.id, { color: cKey as StickyNote['color'] });
                                  setColorPickerNoteId(null);
                                }}
                                className={`w-4 h-4 rounded-full ${COLOR_MAP[cKey].dot} border border-black/10 cursor-pointer hover:scale-110 transition-transform`}
                                title={cKey}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Copy Text */}
                      <button
                        onClick={() => handleCopyNote(note)}
                        className={`p-1 rounded cursor-pointer transition-all-custom ${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-400 hover:text-neutral-700'}`}
                        title="Copy Note Text"
                      >
                        {copiedId === note.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>

                      {/* Delete Note */}
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className={`p-1 rounded cursor-pointer transition-all-custom ${isDark ? 'text-neutral-400 hover:text-red-400' : 'text-neutral-400 hover:text-red-600'}`}
                        title="Delete Note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Textarea */}
                  <div className="p-3 flex-1 flex flex-col overflow-hidden">
                    <textarea
                      value={note.content}
                      onChange={(e) => handleUpdateNote(note.id, { content: e.target.value })}
                      placeholder="Write your note contents..."
                      className={`w-full h-full bg-transparent outline-none text-xs leading-relaxed resize-none font-medium ${theme.text} placeholder:${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}
                    />
                  </div>

                  {/* Card Footer timestamp */}
                  <div className={`px-3 py-1.5 text-[9px] font-semibold text-right ${isDark ? 'text-neutral-500' : 'text-neutral-400'} border-t ${theme.border} shrink-0`}>
                    {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
