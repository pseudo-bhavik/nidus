'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Archive, Plus, Search, X, ChevronDown, ChevronRight,
  ExternalLink, Copy, Check, Trash2, Edit2, GripVertical,
  Link as LinkIcon, ClipboardPaste, MoreHorizontal, RefreshCw
} from 'lucide-react';
import { VaultSection, VaultLink } from '../lib/types';

const STORAGE_KEY = 'nidus_vault_sections';

const SECTION_COLORS = [
  { id: 'emerald', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', header: 'bg-emerald-500/10' },
  { id: 'blue', dot: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', header: 'bg-blue-500/10' },
  { id: 'purple', dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', header: 'bg-purple-500/10' },
  { id: 'amber', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', header: 'bg-amber-500/10' },
  { id: 'rose', dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', header: 'bg-rose-500/10' },
  { id: 'cyan', dot: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', header: 'bg-cyan-500/10' },
  { id: 'neutral', dot: 'bg-neutral-500', bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-neutral-700', header: 'bg-neutral-500/10' },
];

function getColorConfig(colorId: string) {
  return SECTION_COLORS.find((c) => c.id === colorId) || SECTION_COLORS[0];
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

interface LinkVaultProps {
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

export default function LinkVault({ isSidebarOpen, onOpenSidebar }: LinkVaultProps) {
  const [sections, setSections] = useState<VaultSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Section creation
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionColor, setNewSectionColor] = useState('emerald');
  const newSectionInputRef = useRef<HTMLInputElement>(null);

  // Link adding
  const [addingLinkToSection, setAddingLinkToSection] = useState<string | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const addLinkInputRef = useRef<HTMLInputElement>(null);

  // Bulk paste
  const [bulkPasteSection, setBulkPasteSection] = useState<string | null>(null);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Section rename
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Section context menu
  const [sectionMenu, setSectionMenu] = useState<string | null>(null);

  // Section delete confirmation
  const [sectionToDelete, setSectionToDelete] = useState<VaultSection | null>(null);

  // Drag state for sections
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSections(parsed);
        }
      }
    } catch (e) {}
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveSections = useCallback((updated: VaultSection[]) => {
    setSections(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }, []);

  // ── Section CRUD ──────────────────────────────────────────────

  const handleCreateSection = () => {
    if (!newSectionTitle.trim()) return;
    const newSection: VaultSection = {
      id: generateId('vsec'),
      title: newSectionTitle.trim(),
      color: newSectionColor,
      links: [],
      is_collapsed: false,
      position: sections.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveSections([...sections, newSection]);
    setNewSectionTitle('');
    setNewSectionColor('emerald');
    setIsCreatingSection(false);
  };

  const handleDeleteSection = () => {
    if (!sectionToDelete) return;
    saveSections(sections.filter((s) => s.id !== sectionToDelete.id));
    setSectionToDelete(null);
  };

  const handleRenameSection = (id: string) => {
    if (!renameValue.trim()) return;
    saveSections(
      sections.map((s) =>
        s.id === id ? { ...s, title: renameValue.trim(), updated_at: new Date().toISOString() } : s
      )
    );
    setRenamingSectionId(null);
    setRenameValue('');
  };

  const handleToggleCollapse = (id: string) => {
    saveSections(
      sections.map((s) =>
        s.id === id ? { ...s, is_collapsed: !s.is_collapsed } : s
      )
    );
  };

  // ── Link CRUD ─────────────────────────────────────────────────

  const fetchLinkTitle = async (url: string): Promise<{ title: string; description?: string }> => {
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        return { title: data.title || getDomain(url), description: data.description || '' };
      }
    } catch (e) {}
    return { title: getDomain(url) };
  };

  const handleAddLink = async (sectionId: string) => {
    const rawUrl = newLinkUrl.trim();
    if (!rawUrl) return;

    let url = rawUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setIsFetchingTitle(true);
    const { title, description } = await fetchLinkTitle(url);

    const newLink: VaultLink = {
      id: generateId('vlink'),
      url,
      title,
      description,
      favicon_url: getFaviconUrl(url),
      created_at: new Date().toISOString(),
    };

    saveSections(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, links: [...s.links, newLink], updated_at: new Date().toISOString() }
          : s
      )
    );
    setNewLinkUrl('');
    setIsFetchingTitle(false);
  };

  const handleBulkPaste = async (sectionId: string) => {
    const lines = bulkPasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;
    setIsBulkAdding(true);

    const newLinks: VaultLink[] = [];
    for (const line of lines) {
      let url = line;
      // Try to extract URL from lines like "1. site.com • description"
      const urlMatch = line.match(/(?:https?:\/\/)?[\w.-]+\.\w{2,}/);
      if (urlMatch) {
        url = urlMatch[0];
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      // Extract description from bullet format: "domain • description"
      const bulletParts = line.split('•').map((p) => p.trim());
      const desc = bulletParts.length > 1 ? bulletParts.slice(1).join(' • ') : undefined;

      newLinks.push({
        id: generateId('vlink'),
        url,
        title: getDomain(url),
        description: desc,
        favicon_url: getFaviconUrl(url),
        created_at: new Date().toISOString(),
      });
    }

    saveSections(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, links: [...s.links, ...newLinks], updated_at: new Date().toISOString() }
          : s
      )
    );
    setBulkPasteText('');
    setBulkPasteSection(null);
    setIsBulkAdding(false);
  };

  const handleDeleteLink = (sectionId: string, linkId: string) => {
    saveSections(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, links: s.links.filter((l) => l.id !== linkId), updated_at: new Date().toISOString() }
          : s
      )
    );
  };

  const handleCopyLink = (linkId: string, url: string) => {
    try { navigator.clipboard.writeText(url); } catch (e) {}
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 1500);
  };

  // ── Section Drag & Drop ───────────────────────────────────────

  const handleSectionDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedSectionIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSectionIdx(idx);
  };

  const handleSectionDrop = (dropIdx: number) => {
    if (draggedSectionIdx === null || draggedSectionIdx === dropIdx) {
      setDraggedSectionIdx(null);
      setDragOverSectionIdx(null);
      return;
    }
    const reordered = [...sections];
    const [moved] = reordered.splice(draggedSectionIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    saveSections(reordered.map((s, i) => ({ ...s, position: i })));
    setDraggedSectionIdx(null);
    setDragOverSectionIdx(null);
  };

  // ── Filtering ─────────────────────────────────────────────────

  const filteredSections = sections.map((section) => {
    if (!searchQuery) return section;
    const q = searchQuery.toLowerCase();
    const matchesSection = section.title.toLowerCase().includes(q);
    const matchingLinks = section.links.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q)
    );
    if (matchesSection) return { ...section, is_collapsed: false };
    if (matchingLinks.length > 0) return { ...section, links: matchingLinks, is_collapsed: false };
    return null;
  }).filter(Boolean) as VaultSection[];

  const totalLinks = sections.reduce((sum, s) => sum + s.links.length, 0);

  // ── Focus Refs ────────────────────────────────────────────────

  useEffect(() => {
    if (isCreatingSection && newSectionInputRef.current) {
      newSectionInputRef.current.focus();
    }
  }, [isCreatingSection]);

  useEffect(() => {
    if (addingLinkToSection && addLinkInputRef.current) {
      addLinkInputRef.current.focus();
    }
  }, [addingLinkToSection]);

  useEffect(() => {
    if (renamingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingSectionId]);

  if (!isLoaded) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none">

      {/* ── Top Header Bar ── */}
      <div className="min-h-[52px] py-2 px-3 sm:px-4 bg-white/95 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs z-20">
        <div className="flex items-center gap-2.5 shrink-0">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer mr-0.5"
              title="Open Sidebar"
            >
              <Archive className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Archive className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
            <h1 className="font-bold text-sm text-neutral-900 tracking-tight">Link Vault</h1>
            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-full text-[10px] font-bold text-neutral-600">
              {totalLinks} links
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-7 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 w-36 sm:w-44 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* New Section Button */}
          <button
            type="button"
            onClick={() => setIsCreatingSection(true)}
            className="px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Section</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Sections Container ── */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-neutral-50/50">

        {/* New Section Form */}
        {isCreatingSection && (
          <div className="mb-4 bg-white border border-neutral-200 rounded-lg p-4 shadow-xs animate-fade-in">
            <h3 className="font-bold text-xs text-neutral-700 mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create New Section
            </h3>
            <input
              ref={newSectionInputRef}
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
              placeholder="Section name (e.g. Free AI Tools)"
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3"
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-neutral-500 font-semibold">Color:</span>
              {SECTION_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewSectionColor(c.id)}
                  className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${c.dot} ${
                    newSectionColor === c.id ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsCreatingSection(false); setNewSectionTitle(''); }}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSection}
                disabled={!newSectionTitle.trim()}
                className="px-3 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Section
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredSections.length === 0 && !isCreatingSection && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-3 py-20">
            <Archive className="w-12 h-12 text-neutral-300" />
            <div className="text-center">
              <p className="font-bold text-sm text-neutral-600 mb-1">
                {searchQuery ? 'No matching links found' : 'Your Link Vault is empty'}
              </p>
              <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Create sections to organize and store links you want to keep but don\'t need on your main bookmarks page.'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setIsCreatingSection(true)}
                  className="mt-4 px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-neutral-800 transition-all"
                >
                  + Create Your First Section
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="flex flex-col gap-3">
          {filteredSections.map((section, sectionIdx) => {
            const colorCfg = getColorConfig(section.color);
            const isCollapsed = section.is_collapsed;
            const isDraggingOver = dragOverSectionIdx === sectionIdx && draggedSectionIdx !== sectionIdx;

            return (
              <div
                key={section.id}
                draggable
                onDragStart={(e) => handleSectionDragStart(sectionIdx, e)}
                onDragOver={(e) => handleSectionDragOver(sectionIdx, e)}
                onDrop={() => handleSectionDrop(sectionIdx)}
                onDragEnd={() => { setDraggedSectionIdx(null); setDragOverSectionIdx(null); }}
                className={`bg-white border rounded-lg shadow-xs overflow-hidden transition-all ${
                  isDraggingOver ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-neutral-200'
                } ${draggedSectionIdx === sectionIdx ? 'opacity-50' : ''}`}
              >
                {/* Section Header */}
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none ${colorCfg.header} border-b border-neutral-100 hover:bg-neutral-50/80 transition-all`}
                  onClick={() => handleToggleCollapse(section.id)}
                >
                  <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 cursor-grab" />
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorCfg.dot}`} />

                  {renamingSectionId === section.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSection(section.id);
                        if (e.key === 'Escape') setRenamingSectionId(null);
                      }}
                      onBlur={() => handleRenameSection(section.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-xs font-bold bg-white border border-neutral-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  ) : (
                    <span className="flex-1 text-xs font-bold text-neutral-800 truncate">{section.title}</span>
                  )}

                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}`}>
                    {section.links.length}
                  </span>

                  {/* Section context menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSectionMenu(sectionMenu === section.id ? null : section.id);
                      }}
                      className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {sectionMenu === section.id && (
                      <div
                        className="absolute right-0 top-7 z-30 w-36 bg-white border border-neutral-200 rounded-md shadow-xl py-1 text-xs font-semibold animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingSectionId(section.id);
                            setRenameValue(section.title);
                            setSectionMenu(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-neutral-400" /> Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkPasteSection(section.id);
                            setSectionMenu(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer"
                        >
                          <ClipboardPaste className="w-3 h-3 text-neutral-400" /> Bulk Paste Links
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSectionToDelete(section);
                            setSectionMenu(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-left text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" /> Delete Section
                        </button>
                      </div>
                    )}
                  </div>

                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}
                </div>

                {/* Section Body — Expanded */}
                {!isCollapsed && (
                  <div className="divide-y divide-neutral-100">
                    {/* Links */}
                    {section.links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50/80 group transition-all"
                      >
                        {link.favicon_url ? (
                          <img
                            src={link.favicon_url}
                            alt=""
                            className="w-4 h-4 rounded shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <LinkIcon className="w-4 h-4 text-neutral-300 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-neutral-800 truncate">{link.title}</div>
                          <div className="text-[10px] text-neutral-400 truncate">{getDomain(link.url)}</div>
                        </div>

                        {/* Link Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-700 cursor-pointer"
                            title="Open Link"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(link.id, link.url)}
                            className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-700 cursor-pointer"
                            title="Copy Link"
                          >
                            {copiedLinkId === link.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLink(section.id, link.id)}
                            className="p-1 hover:bg-red-100 rounded text-neutral-400 hover:text-red-600 cursor-pointer"
                            title="Remove Link"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Empty section state */}
                    {section.links.length === 0 && (
                      <div className="px-4 py-6 text-center text-neutral-400">
                        <LinkIcon className="w-6 h-6 mx-auto mb-2 text-neutral-300" />
                        <p className="text-xs font-medium">No links yet. Add one below.</p>
                      </div>
                    )}

                    {/* Add Link Input (inline) */}
                    {addingLinkToSection === section.id ? (
                      <div className="px-3 py-2.5 bg-neutral-50/80 flex items-center gap-2">
                        <LinkIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <input
                          ref={addLinkInputRef}
                          type="text"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddLink(section.id);
                            if (e.key === 'Escape') { setAddingLinkToSection(null); setNewLinkUrl(''); }
                          }}
                          placeholder="Paste URL and press Enter..."
                          className="flex-1 text-xs bg-white border border-neutral-200 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                          disabled={isFetchingTitle}
                        />
                        {isFetchingTitle && <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" />}
                        <button
                          type="button"
                          onClick={() => { setAddingLinkToSection(null); setNewLinkUrl(''); }}
                          className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="px-3 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingLinkToSection(section.id)}
                          className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add Link
                        </button>
                        <span className="text-neutral-200">|</span>
                        <button
                          type="button"
                          onClick={() => setBulkPasteSection(section.id)}
                          className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                        >
                          <ClipboardPaste className="w-3 h-3" /> Bulk Paste
                        </button>
                      </div>
                    )}

                    {/* Bulk Paste Modal (inline) */}
                    {bulkPasteSection === section.id && (
                      <div className="px-3 py-3 bg-neutral-50/80 border-t border-neutral-100 animate-fade-in">
                        <h4 className="text-[11px] font-bold text-neutral-700 mb-2 flex items-center gap-1">
                          <ClipboardPaste className="w-3 h-3" /> Bulk Paste Links
                        </h4>
                        <textarea
                          value={bulkPasteText}
                          onChange={(e) => setBulkPasteText(e.target.value)}
                          placeholder={"Paste one URL per line:\nraphael.ai\nkrea.ai\nmagnific.ai\n\nOr paste with descriptions:\nraphael.ai • AI image generation\nkrea.ai • real time image gen"}
                          rows={5}
                          className="w-full text-xs bg-white border border-neutral-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-mono"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => { setBulkPasteSection(null); setBulkPasteText(''); }}
                            className="px-3 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-200 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkPaste(section.id)}
                            disabled={!bulkPasteText.trim() || isBulkAdding}
                            className="px-3 py-1 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {isBulkAdding && <RefreshCw className="w-3 h-3 animate-spin" />}
                            Add {bulkPasteText.split('\n').filter((l) => l.trim()).length} Links
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section Delete Confirmation Modal */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 shadow-2xl p-4 sm:p-5 w-full max-w-xs text-neutral-800">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <Trash2 className="w-4 h-4 shrink-0" />
              <h3 className="font-extrabold text-xs sm:text-sm">Delete Section?</h3>
            </div>
            <p className="text-xs text-neutral-600 mb-1 leading-relaxed">
              Are you sure you want to delete <strong className="text-neutral-900">"{sectionToDelete.title}"</strong>?
            </p>
            <p className="text-[10px] text-neutral-400 mb-4">
              This will permanently remove all {sectionToDelete.links.length} link(s) in this section.
            </p>
            <div className="flex items-center justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-none cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSection}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-none cursor-pointer transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
