'use client';

import React, { useState, useEffect } from 'react';
import { 
  StickyNote as StickyNoteIcon, Plus, X, Pin, Palette, 
  ChevronDown, ChevronUp, Copy, Check, Trash2, Edit3 
} from 'lucide-react';
import { StickyNote } from '../lib/types';

interface QuickStickyNotesWidgetProps {
  onOpenFullNotes?: () => void;
}

const COLOR_STYLES: Record<string, { bg: string; border: string; header: string; text: string; dot: string }> = {
  yellow: {
    bg: 'bg-amber-50',
    border: 'border-amber-200/80',
    header: 'bg-amber-100/60',
    text: 'text-amber-950',
    dot: 'bg-amber-400',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/80',
    header: 'bg-emerald-100/60',
    text: 'text-emerald-950',
    dot: 'bg-emerald-400',
  },
  blue: {
    bg: 'bg-sky-50',
    border: 'border-sky-200/80',
    header: 'bg-sky-100/60',
    text: 'text-sky-950',
    dot: 'bg-sky-400',
  },
  pink: {
    bg: 'bg-rose-50',
    border: 'border-rose-200/80',
    header: 'bg-rose-100/60',
    text: 'text-rose-950',
    dot: 'bg-rose-400',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200/80',
    header: 'bg-purple-100/60',
    text: 'text-purple-950',
    dot: 'bg-purple-400',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200/80',
    header: 'bg-orange-100/60',
    text: 'text-orange-950',
    dot: 'bg-orange-400',
  },
  dark: {
    bg: 'bg-neutral-900',
    border: 'border-neutral-800',
    header: 'bg-neutral-800',
    text: 'text-neutral-100',
    dot: 'bg-neutral-400',
  },
};

const DEFAULT_PINNED_NOTES: StickyNote[] = [
  {
    id: 'pinned-1',
    title: '📌 Home Screen Note 1',
    content: 'Quick note pinned to home screen. Click text to edit!',
    color: 'yellow',
    is_pinned: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pinned-2',
    title: '💡 Quick Todo',
    content: 'Review bookmarks & add to custom collections.',
    color: 'blue',
    is_pinned: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function QuickStickyNotesWidget({ onOpenFullNotes }: QuickStickyNotesWidgetProps) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [colorPickerNoteId, setColorPickerNoteId] = useState<string | null>(null);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nidus_sticky_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          const pinned = parsed.filter((n: StickyNote) => n.is_pinned);
          if (pinned.length > 0) {
            setActiveTabId(pinned[0].id);
          } else {
            setActiveTabId(parsed[0].id);
          }
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load sticky notes in widget:', e);
    }

    setNotes(DEFAULT_PINNED_NOTES);
    setActiveTabId(DEFAULT_PINNED_NOTES[0].id);
  }, []);

  // Save notes to storage
  const saveNotes = (updated: StickyNote[]) => {
    setNotes(updated);
    try {
      localStorage.setItem('nidus_sticky_notes', JSON.stringify(updated));
    } catch (e) {}
  };

  // Get top pinned notes (limit to 3 for clean widget)
  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const displayNotes = pinnedNotes.length > 0 ? pinnedNotes.slice(0, 3) : notes.slice(0, 3);

  const activeNote = displayNotes.find((n) => n.id === activeTabId) || displayNotes[0];

  // Add new pinned note right from home screen widget
  const handleAddQuickNote = () => {
    const newNote: StickyNote = {
      id: 'quick-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: `Pinned Note ${displayNotes.length + 1}`,
      content: '',
      color: (['yellow', 'blue', 'green', 'pink'][displayNotes.length % 4]) as StickyNote['color'],
      is_pinned: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newNote, ...notes];
    saveNotes(updated);
    setActiveTabId(newNote.id);
  };

  // Update note title / content
  const handleUpdateNote = (id: string, updates: Partial<StickyNote>) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, ...updates, updated_at: new Date().toISOString() } : n
    );
    saveNotes(updated);
  };

  // Toggle pin
  const handleTogglePin = (id: string) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, is_pinned: !n.is_pinned } : n
    );
    saveNotes(updated);
  };

  // Delete quick note
  const handleDeleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    if (activeTabId === id && updated.length > 0) {
      setActiveTabId(updated[0].id);
    }
  };

  if (displayNotes.length === 0 && isMinimized) {
    return null;
  }

  const currentTheme = activeNote ? (COLOR_STYLES[activeNote.color] || COLOR_STYLES.yellow) : COLOR_STYLES.yellow;

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none flex flex-col items-end animate-fade-in pointer-events-auto">
      {/* Minimized Floating Badge */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-2 bg-neutral-900 text-white rounded-full shadow-lg flex items-center gap-2 text-xs font-bold hover:bg-neutral-800 cursor-pointer transition-all duration-200 border border-neutral-700"
          title="Expand Pinned Sticky Notes"
        >
          <StickyNoteIcon className="w-4 h-4 text-amber-400" />
          <span>Pinned Notes ({displayNotes.length})</span>
          <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      ) : (
        /* Expanded Floating Sticky Notes Widget Card */
        <div className={`w-80 sm:w-96 rounded-2xl border shadow-xl flex flex-col overflow-hidden transition-all duration-200 ${currentTheme.bg} ${currentTheme.border}`}>
          {/* Widget Header */}
          <div className={`px-3 py-2 ${currentTheme.header} border-b ${currentTheme.border} flex items-center justify-between`}>
            <div className="flex items-center gap-2 truncate">
              <StickyNoteIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className={`font-extrabold text-xs tracking-tight ${currentTheme.text}`}>
                Pinned Sticky Notes
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleAddQuickNote}
                className="p-1 hover:bg-black/10 rounded text-neutral-600 cursor-pointer transition-all-custom"
                title="Add New Pinned Note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-black/10 rounded text-neutral-600 cursor-pointer transition-all-custom"
                title="Minimize Panel"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sticky Notes Tabs Row */}
          {displayNotes.length > 0 && (
            <div className="px-2 py-1.5 flex items-center gap-1 border-b border-black/5 overflow-x-auto no-scrollbar">
              {displayNotes.map((note) => {
                const isActive = note.id === (activeNote?.id);
                return (
                  <button
                    key={note.id}
                    onClick={() => setActiveTabId(note.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold truncate max-w-[120px] transition-all-custom cursor-pointer flex items-center gap-1 ${
                      isActive
                        ? 'bg-white shadow-xs border border-black/10 text-neutral-900'
                        : 'text-neutral-600 hover:bg-black/5'
                    }`}
                  >
                    <span className="truncate">{note.title || 'Untitled'}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Note Content Editor */}
          {activeNote ? (
            <div className="p-3 flex flex-col gap-2">
              {/* Note Title Input */}
              <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-1.5">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdateNote(activeNote.id, { title: e.target.value })}
                  placeholder="Note Title..."
                  className={`font-bold text-xs bg-transparent outline-none flex-1 ${currentTheme.text}`}
                />

                <div className="flex items-center gap-1">
                  {/* Pin toggle */}
                  <button
                    onClick={() => handleTogglePin(activeNote.id)}
                    className={`p-1 rounded cursor-pointer transition-all-custom ${
                      activeNote.is_pinned ? 'text-amber-600 bg-amber-200/50' : 'text-neutral-400 hover:text-neutral-700'
                    }`}
                    title={activeNote.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="w-3 h-3 fill-current" />
                  </button>

                  {/* Palette Color Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setColorPickerNoteId(colorPickerNoteId === activeNote.id ? null : activeNote.id)}
                      className="p-1 rounded text-neutral-500 hover:text-neutral-800 cursor-pointer"
                      title="Change Note Color"
                    >
                      <Palette className="w-3 h-3" />
                    </button>

                    {colorPickerNoteId === activeNote.id && (
                      <div className="absolute right-0 top-full mt-1 p-1 bg-white border border-neutral-250 rounded-lg shadow-lg flex items-center gap-1 z-50">
                        {['yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'dark'].map((cKey) => (
                          <button
                            key={cKey}
                            onClick={() => {
                              handleUpdateNote(activeNote.id, { color: cKey as StickyNote['color'] });
                              setColorPickerNoteId(null);
                            }}
                            className={`w-4 h-4 rounded-full ${COLOR_STYLES[cKey].dot} border border-black/10 cursor-pointer hover:scale-110 transition-transform`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete note */}
                  <button
                    onClick={() => handleDeleteNote(activeNote.id)}
                    className="p-1 rounded text-neutral-400 hover:text-red-600 cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Note Content Textarea */}
              <textarea
                value={activeNote.content}
                onChange={(e) => handleUpdateNote(activeNote.id, { content: e.target.value })}
                placeholder="Type quick thoughts, reminders or links to pin on screen..."
                className={`w-full h-24 bg-transparent outline-none text-xs leading-relaxed font-medium resize-none ${currentTheme.text} placeholder:opacity-50`}
              />
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-neutral-500">
              No pinned notes yet.{' '}
              <button
                onClick={handleAddQuickNote}
                className="font-bold underline text-amber-600 cursor-pointer"
              >
                + Add one
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
