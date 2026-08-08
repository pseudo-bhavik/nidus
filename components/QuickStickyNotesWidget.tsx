'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  StickyNote as StickyNoteIcon, Plus, X, Pin, Palette, 
  ChevronDown, ChevronUp, Copy, Check, Trash2, GripVertical, Cloud
} from 'lucide-react';
import { StickyNote } from '../lib/types';
import { supabase } from '../lib/supabase';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Widget Free-form Screen Position State & Dragging
  const [widgetPos, setWidgetPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingWidgetRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drag & Drop tab reordering state
  const [draggedTabIdx, setDraggedTabIdx] = useState<number | null>(null);
  const [dragOverTabIdx, setDragOverTabIdx] = useState<number | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved widget position from localStorage
  useEffect(() => {
    try {
      const savedPos = localStorage.getItem('nidus_sticky_widget_pos');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setWidgetPos(parsed);
        }
      }
    } catch (e) {}
  }, []);

  // Handle widget free-form screen dragging
  const handleStartWidgetDrag = (e: React.MouseEvent | React.TouchEvent) => {
    isDraggingWidgetRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const widgetEl = (e.currentTarget as HTMLElement).closest('.floating-sticky-widget');
    if (widgetEl) {
      const rect = widgetEl.getBoundingClientRect();
      dragOffsetRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    }

    const handleMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!isDraggingWidgetRef.current) return;
      const moveX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const moveY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

      const newX = Math.max(10, Math.min(window.innerWidth - 300, moveX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, moveY - dragOffsetRef.current.y));

      const newPos = { x: newX, y: newY };
      setWidgetPos(newPos);
      try {
        localStorage.setItem('nidus_sticky_widget_pos', JSON.stringify(newPos));
      } catch (err) {}
    };

    const handleEnd = () => {
      isDraggingWidgetRef.current = false;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // Load notes from Supabase cloud first (with localStorage fallback)
  useEffect(() => {
    let isMounted = true;

    const loadNotesData = async () => {
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
          const pinned = mapped.filter((n) => n.is_pinned);
          setActiveTabId(pinned.length > 0 ? pinned[0].id : mapped[0].id);
          localStorage.setItem('nidus_sticky_notes', JSON.stringify(mapped));
          return;
        }
      } catch (e) {}

      try {
        const saved = localStorage.getItem('nidus_sticky_notes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
            setNotes(parsed);
            const pinned = parsed.filter((n: StickyNote) => n.is_pinned);
            setActiveTabId(pinned.length > 0 ? pinned[0].id : parsed[0].id);
            return;
          }
        }
      } catch (e) {}

      if (isMounted) {
        setNotes(DEFAULT_PINNED_NOTES);
        setActiveTabId(DEFAULT_PINNED_NOTES[0].id);
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

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const upsertPayload = updated.map((n) => ({
          id: n.id,
          user_id: user?.id || null,
          title: n.title,
          content: n.content,
          color: n.color,
          is_pinned: n.is_pinned ?? false,
          updated_at: n.updated_at || new Date().toISOString(),
        }));
        await supabase.from('sticky_notes').upsert(upsertPayload);
      } catch (err) {}
    }, 400);
  };

  const pinnedNotes = notes.filter((n) => n.is_pinned);
  const displayNotes = pinnedNotes.length > 0 ? pinnedNotes.slice(0, 5) : notes.slice(0, 5);

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
  const handleDeleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    try {
      await supabase.from('sticky_notes').delete().eq('id', id);
    } catch (err) {}
    if (activeTabId === id && updated.length > 0) {
      setActiveTabId(updated[0].id);
    }
  };

  // Copy Content
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Drag & Drop Handlers for Reordering Homescreen Sticky Note Tabs
  const handleTabDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedTabIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleTabDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTabIdx !== idx) setDragOverTabIdx(idx);
  };

  const handleTabDrop = (dropIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTabIdx === null || draggedTabIdx === dropIdx) {
      setDraggedTabIdx(null);
      setDragOverTabIdx(null);
      return;
    }

    const reordered = [...notes];
    const [moved] = reordered.splice(draggedTabIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    saveNotes(reordered);
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  if (displayNotes.length === 0 && isMinimized) return null;

  const currentTheme = activeNote ? (COLOR_STYLES[activeNote.color] || COLOR_STYLES.yellow) : COLOR_STYLES.yellow;

  return (
    <div
      className={`fixed z-40 select-none flex flex-col items-end animate-fade-in pointer-events-auto floating-sticky-widget ${
        widgetPos ? '' : 'bottom-4 right-4'
      }`}
      style={
        widgetPos
          ? { left: `${widgetPos.x}px`, top: `${widgetPos.y}px`, right: 'auto', bottom: 'auto' }
          : undefined
      }
    >
      {/* Minimized Floating Badge */}
      {isMinimized ? (
        <div className="flex items-center gap-1.5 bg-neutral-900 text-white rounded-full shadow-lg p-1 border border-neutral-700">
          <GripVertical
            onMouseDown={handleStartWidgetDrag}
            onTouchStart={handleStartWidgetDrag}
            className="w-3.5 h-3.5 text-neutral-400 cursor-grab active:cursor-grabbing hover:text-white shrink-0 ml-1"
          />
          <button
            onClick={() => setIsMinimized(false)}
            className="px-2 py-1 flex items-center gap-2 text-xs font-bold hover:bg-neutral-800 rounded-full cursor-pointer transition-all duration-200"
            title="Expand Pinned Sticky Notes"
          >
            <StickyNoteIcon className="w-4 h-4 text-amber-400" />
            <span>Pinned Notes ({displayNotes.length})</span>
            <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
          </button>
        </div>
      ) : (
        /* Expanded Floating Sticky Notes Widget Card */
        <div className={`w-80 sm:w-96 rounded-2xl border shadow-xl flex flex-col overflow-hidden transition-all duration-200 ${currentTheme.bg} ${currentTheme.border}`}>
          
          {/* Widget Header with Drag Handle */}
          <div className={`px-3 py-2 ${currentTheme.header} border-b ${currentTheme.border} flex items-center justify-between`}>
            <div className="flex items-center gap-1.5 truncate">
              <GripVertical
                onMouseDown={handleStartWidgetDrag}
                onTouchStart={handleStartWidgetDrag}
                className="w-3.5 h-3.5 text-neutral-400 cursor-grab active:cursor-grabbing hover:text-neutral-700 shrink-0"
              />
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

          {/* Reorderable Tabs Navigation Bar */}
          <div className="px-2 py-1 bg-black/5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-black/5">
            {displayNotes.map((note, idx) => {
              const isSelected = activeNote && note.id === activeNote.id;
              const isDragging = draggedTabIdx === idx;
              const isDragOver = dragOverTabIdx === idx;

              return (
                <div
                  key={note.id}
                  draggable
                  onDragStart={(e) => handleTabDragStart(idx, e)}
                  onDragOver={(e) => handleTabDragOver(idx, e)}
                  onDrop={(e) => handleTabDrop(idx, e)}
                  onDragEnd={handleTabDragEnd}
                  className={`shrink-0 transition-all ${
                    isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                  } ${isDragOver ? 'ring-2 ring-indigo-500 scale-105' : ''}`}
                >
                  <button
                    onClick={() => setActiveTabId(note.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-grab active:cursor-grabbing transition-all ${
                      isSelected
                        ? 'bg-white shadow-2xs text-neutral-900 border border-neutral-200'
                        : 'text-neutral-600 hover:bg-white/50'
                    }`}
                    title="Drag tab to reorder note"
                  >
                    <GripVertical className="w-2.5 h-2.5 text-neutral-400 opacity-60" />
                    <span className="max-w-[70px] truncate">{note.title}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Active Note Content Area */}
          {activeNote && (
            <div className="p-3.5 flex flex-col justify-between min-h-[140px]">
              <div>
                {/* Title & Controls */}
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => handleUpdateNote(activeNote.id, { title: e.target.value })}
                    className={`font-bold text-xs bg-transparent border-none outline-none w-full ${currentTheme.text}`}
                    placeholder="Note title..."
                  />

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => setColorPickerNoteId(colorPickerNoteId === activeNote.id ? null : activeNote.id)}
                      className="p-1 hover:bg-black/10 rounded text-neutral-500 cursor-pointer"
                      title="Change color"
                    >
                      <Palette className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => handleCopy(activeNote.id, `${activeNote.title}\n${activeNote.content}`)}
                      className="p-1 hover:bg-black/10 rounded text-neutral-500 cursor-pointer"
                      title="Copy note text"
                    >
                      {copiedId === activeNote.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleDeleteNote(activeNote.id)}
                      className="p-1 hover:bg-red-100/50 rounded text-neutral-500 hover:text-red-600 cursor-pointer"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Color Picker Dropdown */}
                {colorPickerNoteId === activeNote.id && (
                  <div className="mb-2 p-1.5 bg-white rounded-lg shadow-md border border-neutral-200 flex items-center justify-between animate-fade-in">
                    <span className="text-[9px] font-bold text-neutral-500 uppercase">Color:</span>
                    <div className="flex items-center gap-1">
                      {Object.keys(COLOR_STYLES).map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            handleUpdateNote(activeNote.id, { color: c as any });
                            setColorPickerNoteId(null);
                          }}
                          className={`w-3.5 h-3.5 rounded-full border border-black/10 transition-transform ${COLOR_STYLES[c].dot} ${
                            activeNote.color === c ? 'ring-2 ring-indigo-600 scale-110' : 'hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Note Content Input */}
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdateNote(activeNote.id, { content: e.target.value })}
                  placeholder="Type note contents..."
                  className={`w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed ${currentTheme.text} min-h-[75px]`}
                />
              </div>

              {/* Widget Footer */}
              <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] text-neutral-400 mt-2">
                <button
                  type="button"
                  onClick={onOpenFullNotes}
                  className="hover:underline font-bold text-indigo-600 flex items-center gap-1 cursor-pointer"
                >
                  View All Sticky Notes →
                </button>
                <span>{new Date(activeNote.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
