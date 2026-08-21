'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun,
  Maximize2, Minimize2, Check, PanelLeftOpen, Share2, Upload, GripVertical, Lock, AlertTriangle
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';
import { supabase } from '../lib/supabase';

// Dynamically import Excalidraw with SSR completely disabled
const ExcalidrawWrapper = dynamic(
  () => import('./ExcalidrawWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-full bg-neutral-50">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Excalidraw...</span>
        </div>
      </div>
    ),
  }
);

interface WhiteboardCanvasProps {
  activeTheme?: string;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

const DEFAULT_DOC: WhiteboardCanvasDoc = {
  id: 'doc-default',
  title: 'Canvas Note 1',
  elementsData: [],
  appStateData: { theme: 'light' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function WhiteboardCanvas({
  activeTheme = 'orange',
  isSidebarOpen = true,
  onOpenSidebar,
}: WhiteboardCanvasProps) {
  // Document multi-tab management
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [docToDelete, setDocToDelete] = useState<WhiteboardCanvasDoc | null>(null);

  // Drag & Drop Tab Reordering State
  const [draggedTabIdx, setDraggedTabIdx] = useState<number | null>(null);
  const [dragOverTabIdx, setDragOverTabIdx] = useState<number | null>(null);

  // Excalidraw API ref
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Track loaded doc & debounce save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Key to force re-mount Excalidraw when switching tabs
  const [excalidrawKey, setExcalidrawKey] = useState(0);

  // 1. Load saved canvas tabs (Isolated for shared links)
  useEffect(() => {
    let isMounted = true;

    const loadCanvasData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedCanvasId = urlParams.get('canvas');

      // IF SHARED LINK PRESENT: Fetch ONLY that single canvas for total data isolation
      if (sharedCanvasId) {
        try {
          const { data: sharedDoc, error } = await supabase
            .from('whiteboard_docs')
            .select('*')
            .eq('id', sharedCanvasId)
            .maybeSingle();

          if (!error && sharedDoc && isMounted) {
            const mappedSingle: WhiteboardCanvasDoc = {
              id: sharedDoc.id,
              title: sharedDoc.title || 'Shared Canvas',
              elementsData: sharedDoc.elements_data || [],
              appStateData: sharedDoc.app_state_data || {},
              created_at: sharedDoc.created_at,
              updated_at: sharedDoc.updated_at,
            };
            setDocs([mappedSingle]);
            setActiveDocId(mappedSingle.id);
            setIsSharedMode(true);
            setIsDataLoaded(true);
            return;
          }
        } catch (err) {}
      }

      // NORMAL VIEW: Load authenticated user's own canvases
      let savedOrderIds: string[] = [];
      try {
        const orderRaw = localStorage.getItem('nidus_whiteboard_docs_order');
        if (orderRaw) savedOrderIds = JSON.parse(orderRaw);
      } catch (e) {}

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Logged in: query ONLY this user's whiteboard docs
          const { data: dbDocs, error } = await supabase
            .from('whiteboard_docs')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

          if (!error && dbDocs && dbDocs.length > 0 && isMounted) {
            const mappedDocs: WhiteboardCanvasDoc[] = dbDocs.map((d: any) => ({
              id: d.id,
              title: d.title || 'Canvas Note',
              elementsData: d.elements_data || [],
              appStateData: d.app_state_data || {},
              position: typeof d.app_state_data?.position === 'number' ? d.app_state_data.position : undefined,
              created_at: d.created_at,
              updated_at: d.updated_at,
            }));

            // Sort mappedDocs strictly by position / saved order sequence
            mappedDocs.sort((a, b) => {
              const idxA = savedOrderIds.indexOf(a.id);
              const idxB = savedOrderIds.indexOf(b.id);
              const posA = typeof a.position === 'number' ? a.position : (idxA !== -1 ? idxA : 999);
              const posB = typeof b.position === 'number' ? b.position : (idxB !== -1 ? idxB : 999);
              return posA - posB;
            });

            setDocs(mappedDocs);
            setActiveDocId(mappedDocs[0].id);
            localStorage.setItem(`nidus_whiteboard_docs_${user.id}`, JSON.stringify(mappedDocs));
            setIsDataLoaded(true);
            return;
          }
        }
      } catch (err) {}

      // Fallback to localStorage for guest / offline mode
      try {
        const saved = localStorage.getItem('nidus_whiteboard_docs');
        if (saved && isMounted) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDocs(parsed);
            setActiveDocId(parsed[0].id);
            setIsDataLoaded(true);
            return;
          }
        }
      } catch (e) {}

      if (isMounted) {
        setDocs([DEFAULT_DOC]);
        setActiveDocId(DEFAULT_DOC.id);
        setIsDataLoaded(true);
      }
    };

    loadCanvasData();
    return () => { isMounted = false; };
  }, []);

  // Counter-zoom: apply inverse zoom on the Excalidraw canvas container to neutralize
  // document-level CSS zoom distortion on pointer coordinates.
  // The toolbar/tabs above still render at the user's chosen application zoom.
  // The canvas container gets zoom = 1/appZoom so Excalidraw internally sees effective zoom=1.
  useEffect(() => {
    const applyCounterZoom = () => {
      const el = canvasContainerRef.current;
      if (!el) return;

      const docZoom = parseFloat(document.documentElement.style.zoom || '1') || 1;
      if (Math.abs(docZoom - 1) < 0.001) {
        // No counter-zoom needed when app zoom is 1
        el.style.zoom = '';
        el.style.width = '';
        el.style.height = '';
      } else {
        const inverse = 1 / docZoom;
        el.style.zoom = inverse.toString();
        // Scale dimensions up so the counter-zoomed container still fills the parent
        el.style.width = `${docZoom * 100}%`;
        el.style.height = `${docZoom * 100}%`;
      }

      // Tell Excalidraw to recalculate its bounding rect
      window.dispatchEvent(new Event('resize'));
      if (excalidrawAPI && typeof excalidrawAPI.refresh === 'function') {
        excalidrawAPI.refresh();
      }
    };

    // Apply immediately
    applyCounterZoom();
    const t1 = setTimeout(applyCounterZoom, 100);
    const t2 = setTimeout(applyCounterZoom, 350);

    // Watch for external changes to document.documentElement.style.zoom
    const observer = new MutationObserver(() => {
      applyCounterZoom();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      // Reset counter-zoom on unmount
      const el = canvasContainerRef.current;
      if (el) {
        el.style.zoom = '';
        el.style.width = '';
        el.style.height = '';
      }
    };
  }, [excalidrawAPI]);

  // Trigger window resize when sidebar state changes to fix pointer alignment instantly
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (excalidrawAPI && typeof excalidrawAPI.refresh === 'function') {
        excalidrawAPI.refresh();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isSidebarOpen, excalidrawAPI]);

  // LocalStorage & Supabase Cloud Persistence helper
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    const indexedDocs = updatedDocs.map((doc, idx) => ({
      ...doc,
      position: idx,
      appStateData: { ...(doc.appStateData || {}), position: idx },
    }));
    setDocs(indexedDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(indexedDocs));
      const orderIds = indexedDocs.map((d) => d.id);
      localStorage.setItem('nidus_whiteboard_docs_order', JSON.stringify(orderIds));
    } catch (e) {}
  };

  const syncDocToSupabase = async (doc: WhiteboardCanvasDoc) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return; // Guest mode: DO NOT upload to cloud!

      await supabase.from('whiteboard_docs').upsert({
        id: doc.id,
        user_id: user.id,
        title: doc.title,
        elements_data: doc.elementsData,
        app_state_data: doc.appStateData,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {}
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  const sanitizeAppState = (appState: any) => {
    if (!appState) return {};
    return {
      theme: appState.theme,
      viewBackgroundColor: appState.viewBackgroundColor,
      zoom: appState.zoom,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    };
  };

  // Debounced save: called by Excalidraw's onChange ONLY after initial data is loaded
  const handleExcalidrawChange = useCallback(
    (elements: readonly any[], appState: any) => {
      if (!isDataLoaded) return; // Prevent overwriting stored canvas during initial mount

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const mutableElements = [...elements];
        const cleanAppState = sanitizeAppState(appState);

        setDocs((prev) => {
          const updated = prev.map((d) => {
            if (d.id === activeDocId) {
              const updatedDoc = {
                ...d,
                elementsData: mutableElements,
                appStateData: cleanAppState,
                updated_at: new Date().toISOString(),
              };
              syncDocToSupabase(updatedDoc);
              return updatedDoc;
            }
            return d;
          });
          try {
            localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }, 300);
    },
    [activeDocId, isDataLoaded]
  );

  // Document Tab Actions
  const handleCreateDoc = () => {
    if (excalidrawAPI) {
      const currentElements = excalidrawAPI.getSceneElements();
      const currentAppState = sanitizeAppState(excalidrawAPI.getAppState());
      setDocs((prev) => {
        const updated = prev.map((d) =>
          d.id === activeDocId
            ? { ...d, elementsData: currentElements, appStateData: currentAppState, updated_at: new Date().toISOString() }
            : d
        );
        try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    const newDoc: WhiteboardCanvasDoc = {
      id: 'doc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: `Canvas Note ${docs.length + 1}`,
      elementsData: [],
      appStateData: { theme: canvasTheme },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated = [newDoc, ...docs];
    saveDocsToStorage(updated);
    syncDocToSupabase(newDoc);
    setActiveDocId(newDoc.id);
    setExcalidrawAPI(null);
    setExcalidrawKey((k) => k + 1);
  };

  const handleSwitchDoc = (docId: string) => {
    if (docId === activeDocId) return;

    if (excalidrawAPI) {
      const currentElements = excalidrawAPI.getSceneElements();
      const currentAppState = sanitizeAppState(excalidrawAPI.getAppState());
      setDocs((prev) => {
        const updated = prev.map((d) =>
          d.id === activeDocId
            ? { ...d, elementsData: currentElements, appStateData: currentAppState, updated_at: new Date().toISOString() }
            : d
        );
        try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    setActiveDocId(docId);
    setExcalidrawAPI(null);
    setExcalidrawKey((k) => k + 1);
  };

  const promptDeleteDoc = (doc: WhiteboardCanvasDoc, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocToDelete(doc);
  };

  const confirmDeleteDoc = () => {
    if (!docToDelete) return;
    const id = docToDelete.id;
    if (docs.length <= 1) {
      if (excalidrawAPI) excalidrawAPI.resetScene();
      const updated = docs.map((d) =>
        d.id === id ? { ...d, elementsData: [], updated_at: new Date().toISOString() } : d
      );
      saveDocsToStorage(updated);
    } else {
      const updated = docs.filter((d) => d.id !== id);
      saveDocsToStorage(updated);
      try { supabase.from('whiteboard_docs').delete().eq('id', id); } catch (err) {}
      if (activeDocId === id) {
        setActiveDocId(updated[0].id);
        setExcalidrawAPI(null);
        setExcalidrawKey((k) => k + 1);
      }
    }
    setDocToDelete(null);
  };

  // Drag & Drop Handlers for Reordering Canvas Tabs
  const handleTabDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedTabIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleTabDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTabIdx !== idx) {
      setDragOverTabIdx(idx);
    }
  };

  const handleTabDrop = (dropIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTabIdx === null || draggedTabIdx === dropIdx) {
      setDraggedTabIdx(null);
      setDragOverTabIdx(null);
      return;
    }

    const reordered = [...docs];
    const [moved] = reordered.splice(draggedTabIdx, 1);
    reordered.splice(dropIdx, 0, moved);

    saveDocsToStorage(reordered);
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTitle.trim()) {
      setIsRenaming(false);
      return;
    }
    const updated = docs.map((d) =>
      d.id === activeDocId
        ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() }
        : d
    );
    saveDocsToStorage(updated);
    const targetDoc = updated.find(d => d.id === activeDocId);
    if (targetDoc) syncDocToSupabase(targetDoc);
    setIsRenaming(false);
  };

  // Copy Shareable Canvas Link to Clipboard
  const handleShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?canvas=${activeDocId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Export PNG Image
  const handleExportPNG = async () => {
    if (!excalidrawAPI) return;
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawAPI.getSceneElements(),
        appState: { ...excalidrawAPI.getAppState(), exportWithDarkMode: canvasTheme === 'dark' },
        files: excalidrawAPI.getFiles(),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-canvas.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Export .excalidraw File
  const handleExportExcalidrawFile = () => {
    if (!excalidrawAPI) return;
    const data = {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements: excalidrawAPI.getSceneElements(),
      appState: sanitizeAppState(excalidrawAPI.getAppState()),
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}.excalidraw`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import .excalidraw File from disk
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.elements && Array.isArray(json.elements)) {
          const importedDoc: WhiteboardCanvasDoc = {
            id: 'doc-' + Date.now().toString(36),
            title: file.name.replace(/\.excalidraw$/i, '') || 'Imported Canvas',
            elementsData: json.elements,
            appStateData: json.appState || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const updated = [importedDoc, ...docs];
          saveDocsToStorage(updated);
          syncDocToSupabase(importedDoc);
          setActiveDocId(importedDoc.id);
          setExcalidrawAPI(null);
          setExcalidrawKey((k) => k + 1);
        }
      } catch (err) {
        alert('Invalid Excalidraw file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleTheme = () => {
    const newTheme = canvasTheme === 'light' ? 'dark' : 'light';
    setCanvasTheme(newTheme);
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: { theme: newTheme },
      });
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none ${
        isFullScreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".excalidraw,.json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Top Navigation & Drag-and-Drop Multi-Tab Header Bar */}
      <div className="h-10 px-2 sm:px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30 min-w-0">
        
        {/* Left Side: Brand Icon & Drag-and-Drop Canvas Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 flex-1 min-w-0 no-scrollbar touch-pan-x">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer shrink-0 mr-0.5"
              title="Open Navigation Sidebar"
            >
              <PanelLeftOpen
                className="w-4 h-4 text-hn-orange"
                style={{ color: 'var(--accent-color)' }}
              />
            </button>
          )}

          <div className="flex items-center gap-1.5 font-bold text-neutral-800 mr-1 sm:mr-2 shrink-0">
            <PenTool
              className="w-4 h-4 text-hn-orange"
              style={{ color: 'var(--accent-color)' }}
            />
            <span className="hidden sm:inline">Excalidraw Canvas</span>
          </div>

          {/* Reorderable Tabs Container or Shared Link Badge */}
          {isSharedMode ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-indigo-700 font-bold text-[11px] shrink-0">
              <Lock className="w-3 h-3 text-indigo-600" />
              <span>Shared Canvas: {activeDoc.title}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {docs.map((doc, idx) => {
                const isSelected = doc.id === activeDocId;
                const isDragging = draggedTabIdx === idx;
                const isDragOver = dragOverTabIdx === idx;

                return (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={(e) => handleTabDragStart(idx, e)}
                    onDragOver={(e) => handleTabDragOver(idx, e)}
                    onDrop={(e) => handleTabDrop(idx, e)}
                    onDragEnd={handleTabDragEnd}
                    className={`group relative flex items-center shrink-0 rounded-md transition-all ${
                      isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                    } ${isDragOver ? 'ring-2 ring-indigo-500 scale-105' : ''}`}
                  >
                    <button
                      onClick={() => handleSwitchDoc(doc.id)}
                      className={`px-2 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-grab active:cursor-grabbing shrink-0 ${
                        isSelected
                          ? 'bg-neutral-100 text-neutral-900 shadow-2xs border border-neutral-200 font-bold'
                          : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                      }`}
                      title="Drag to reorder tab"
                    >
                      <GripVertical className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity hidden sm:block text-neutral-400" />
                      <span className="max-w-[70px] sm:max-w-[100px] truncate">{doc.title}</span>
                      {isSelected && docs.length > 1 && (
                        <span
                          onClick={(e) => promptDeleteDoc(doc, e)}
                          className="p-0.5 hover:text-red-600 rounded text-neutral-400 cursor-pointer"
                          title="Close Canvas"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              <button
                onClick={handleCreateDoc}
                className="p-1 hover:bg-neutral-100 text-neutral-500 rounded-md cursor-pointer shrink-0"
                title="New Canvas Note"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side Controls: Share, Import, Export, Theme, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1">
          {isRenaming ? (
            <form onSubmit={handleSaveRename} className="flex items-center gap-1">
              <input
                type="text"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                autoFocus
                className="px-1.5 sm:px-2 py-0.5 bg-white border border-neutral-300 rounded text-[11px] font-bold outline-none text-neutral-800 w-24 sm:w-auto"
              />
              <button
                type="submit"
                className="p-1 bg-neutral-900 text-white rounded cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setRenameTitle(activeDoc.title);
                setIsRenaming(true);
              }}
              className="px-1.5 sm:px-2 py-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
              title="Rename Active Canvas"
            >
              <Edit2 className="w-3 h-3" />
              <span className="hidden md:inline">Rename</span>
            </button>
          )}

          <div className="h-4 w-px bg-neutral-200 mx-0.5 hidden sm:block" />

          {/* Shareable Link Button */}
          <button
            onClick={handleShareLink}
            className={`px-1.5 sm:px-2 py-1 rounded flex items-center gap-1 font-semibold text-[11px] cursor-pointer transition-all ${
              copiedLink ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
            title="Copy Shareable Link for Other Devices"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
            <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
          </button>

          {/* Import File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 sm:p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Import .excalidraw File"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* Export PNG Image */}
          <button
            onClick={handleExportPNG}
            className="p-1 sm:p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Export PNG Image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Export .excalidraw File */}
          <button
            onClick={handleExportExcalidrawFile}
            className="p-1 sm:p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer text-[10px] font-bold hidden sm:block"
            title="Export .excalidraw JSON"
          >
            JSON
          </button>

          <button
            onClick={handleToggleTheme}
            className="p-1 sm:p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {canvasTheme === 'light' ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1 sm:p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer hidden sm:block"
            title="Toggle Full Screen"
          >
            {isFullScreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Excalidraw Canvas — Full Size Container with counter-zoom for pointer alignment */}
      <div className="flex-1 w-full relative overflow-hidden touch-none" ref={canvasContainerRef}>
        {isDataLoaded ? (
          <ExcalidrawWrapper
            key={`${activeDocId}-${excalidrawKey}`}
            initialElements={activeDoc.elementsData || []}
            initialAppState={{
              theme: canvasTheme,
              viewBackgroundColor: canvasTheme === 'dark' ? '#121212' : '#ffffff',
            }}
            theme={canvasTheme}
            onApiReady={setExcalidrawAPI}
            onChange={handleExcalidrawChange}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-neutral-50">
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading Canvas...</span>
            </div>
          </div>
        )}
      </div>

      {/* Small In-App Canvas Deletion Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 shadow-2xl p-4 sm:p-5 w-full max-w-xs text-neutral-800 animate-scale-in">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="font-extrabold text-xs sm:text-sm">Delete Canvas?</h3>
            </div>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              Are you sure you want to delete <strong className="text-neutral-900">"{docToDelete.title}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-none cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDoc}
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
