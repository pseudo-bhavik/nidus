import React, { useState, useEffect } from 'react';
import { X, Save, ShieldAlert } from 'lucide-react';
import { Bookmark } from '../lib/types';

interface EditBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookmark: Bookmark | null;
  onSave: (id: string, updates: Partial<Bookmark>) => Promise<void>;
  categories: string[];
}

export default function EditBookmarkModal({
  isOpen,
  onClose,
  bookmark,
  onSave,
  categories,
}: EditBookmarkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [notes, setNotes] = useState('');
  const [readTime, setReadTime] = useState(1);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state with active bookmark
  useEffect(() => {
    if (bookmark) {
      setUrl(bookmark.url || '');
      setTitle(bookmark.title || '');
      setCategory(bookmark.category || 'Unsorted');
      setPriority(bookmark.priority || 'Medium');
      setNotes(bookmark.notes || '');
      setReadTime(bookmark.read_time_minutes || 1);
      setThumbnailUrl(bookmark.thumbnail_url || '');
      setErrorMsg('');
    }
  }, [bookmark, isOpen]);

  if (!isOpen || !bookmark) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !title.trim()) {
      setErrorMsg('URL and Title are required fields.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      await onSave(bookmark.id, {
        url: url.trim(),
        title: title.trim(),
        category: category.trim() || 'Unsorted',
        priority,
        notes: notes.trim(),
        read_time_minutes: Math.max(1, Number(readTime)),
        thumbnail_url: thumbnailUrl.trim() || null,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save bookmark updates:', err);
      setErrorMsg(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div 
        className="w-full max-w-lg bg-white border border-neutral-200/60 rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all-custom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <span className="font-bold text-neutral-800 text-xs uppercase tracking-wider">
            Edit Bookmark Properties
          </span>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-neutral-200/60 rounded-md transition-all-custom cursor-pointer"
          >
            <X className="w-4.5 h-4.5 text-neutral-500" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg flex items-start gap-2.5 font-medium">
              <ShieldAlert className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bookmark title..."
              className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-800 text-[13px]"
              required
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Bookmark URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-700"
              required
            />
          </div>

          {/* Grid fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category Select / Custom */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Collection / Category</label>
              <input
                type="text"
                list="edit-modal-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Select or type..."
                className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-700"
              />
              <datalist id="edit-modal-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-700 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Read Time */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Read Time (minutes)</label>
              <input
                type="number"
                min={1}
                value={readTime}
                onChange={(e) => setReadTime(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-700"
              />
            </div>

            {/* Thumbnail URL */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Thumbnail Image URL</label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://...png"
                className="w-full px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none font-semibold text-neutral-700"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[10px] text-neutral-400 uppercase tracking-wider">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write custom notes details here..."
              className="w-full h-24 px-3 py-2 border border-neutral-200 hover:border-neutral-300 focus:border-hn-orange/50 focus:ring-1 focus:ring-hn-orange/10 rounded outline-none resize-none font-semibold text-neutral-700 leading-relaxed"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-neutral-100 select-none">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 font-bold text-neutral-700 rounded-md cursor-pointer transition-all-custom"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-md cursor-pointer transition-all-custom flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
