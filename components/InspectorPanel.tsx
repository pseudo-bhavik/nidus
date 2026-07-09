import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Trash2, Globe, FileText, CheckCircle2, CloudLightning } from 'lucide-react';
import { Bookmark } from '../lib/types';

interface InspectorPanelProps {
  bookmark: Bookmark | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Bookmark>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
}

export default function InspectorPanel({
  bookmark,
  onClose,
  onUpdate,
  onDelete,
  onRestore,
}: InspectorPanelProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state when bookmark changes
  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title || '');
      setNotes(bookmark.notes || '');
      setSaveSuccess(false);
      setSaving(false);
    }
  }, [bookmark]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!bookmark) return null;

  // Handle title changes and auto-save
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerAutoSave(bookmark.id, { title: newTitle }, notes);
  };

  // Handle notes changes and auto-save
  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes);
    triggerAutoSave(bookmark.id, { notes: newNotes }, title);
  };

  const triggerAutoSave = (id: string, updates: Partial<Bookmark>, currentOtherField: string) => {
    setSaving(true);
    setSaveSuccess(false);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        await onUpdate(id, updates);
        setSaveSuccess(true);
      } catch (err) {
        console.error('Failed to autosave bookmark:', err);
      } finally {
        setSaving(false);
      }
    }, 800); // 800ms debounce
  };

  // Description Metrics
  const charCount = bookmark.description ? bookmark.description.length : 0;
  const wordCount = bookmark.description ? bookmark.description.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="w-full sm:w-[380px] h-full bg-white border-l border-border-color shadow-2xl flex flex-col shrink-0 animate-slide-in relative z-20 text-xs">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-2 text-neutral-400">
          <Globe className="w-4 h-4" />
          <span className="font-bold text-neutral-700 truncate max-w-[200px]">{bookmark.domain}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Save Status Indicators */}
          {saving && <span className="text-[10px] text-neutral-400 font-semibold animate-pulse">Autosaving...</span>}
          {saveSuccess && (
            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Saved
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-200/60 rounded-md transition-all-custom cursor-pointer ml-1"
          >
            <X className="w-4.5 h-4.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Editable Title */}
        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Title</label>
          <textarea
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Edit title..."
            className="w-full bg-transparent hover:bg-neutral-50 focus:bg-neutral-50 focus:ring-1 focus:ring-hn-orange/20 border border-transparent focus:border-neutral-200 rounded-md p-2 font-bold text-neutral-800 text-sm outline-none resize-none leading-snug transition-all-custom"
            rows={3}
          />
        </div>

        {/* Info properties bar */}
        <div className="grid grid-cols-2 gap-4 py-2.5 px-1.5 border-y border-neutral-100">
          <div className="flex items-center gap-2 text-neutral-600 font-semibold">
            <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="text-[11px]">{bookmark.read_time_minutes} min read</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-400 font-bold justify-end">
            <span className="text-[11px]">{wordCount} words description</span>
          </div>
        </div>

        {/* Thumbnail Preview */}
        {bookmark.thumbnail_url ? (
          <div className="relative w-full aspect-video border border-neutral-200/60 rounded-lg overflow-hidden bg-neutral-50 flex items-center justify-center p-2 select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bookmark.thumbnail_url}
              alt="Bookmark Thumbnail"
              className="object-contain max-h-full max-w-full hover:scale-102 transition-transform duration-250"
              onError={(e) => {
                // If image fails to load, remove src to trigger fallback
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-full aspect-video border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50 flex flex-col items-center justify-center text-neutral-400 gap-1.5 select-none">
            <Globe className="w-6 h-6 stroke-1.5" />
            <span className="font-semibold text-[10px]">No Thumbnail Available</span>
          </div>
        )}

        {/* Description Display */}
        {bookmark.description && (
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Description</label>
            <div className="p-3 bg-neutral-50 border border-neutral-200/50 rounded-lg text-neutral-600 leading-relaxed font-semibold text-[11px]">
              {bookmark.description}
            </div>
          </div>
        )}

        {/* Notes editor */}
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Write custom notes for this bookmark..."
            className="w-full flex-1 bg-transparent hover:bg-neutral-50 focus:bg-neutral-50 focus:ring-1 focus:ring-hn-orange/20 border border-transparent focus:border-neutral-200 rounded-md p-3 text-neutral-700 text-[12px] outline-none resize-none font-semibold leading-relaxed transition-all-custom"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-neutral-100 bg-neutral-50/30 flex justify-end gap-2.5 shrink-0 select-none">
        {bookmark.is_trashed ? (
          <>
            {onRestore && (
              <button
                onClick={() => onRestore(bookmark.id)}
                className="px-3.5 py-2 bg-white border border-neutral-200 text-neutral-700 font-bold hover:bg-neutral-50 rounded-md cursor-pointer transition-all-custom"
              >
                Restore Link
              </button>
            )}
            <button
              onClick={() => onDelete(bookmark.id)}
              className="px-3.5 py-2 bg-red-600 text-white font-bold hover:bg-red-700 rounded-md flex items-center gap-1.5 cursor-pointer transition-all-custom"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Forever</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => onDelete(bookmark.id)}
            className="px-3.5 py-2 bg-white border border-neutral-200 text-red-600 font-bold hover:bg-red-50 rounded-md flex items-center gap-1.5 cursor-pointer transition-all-custom"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Move to Trash</span>
          </button>
        )}
      </div>
    </div>
  );
}
