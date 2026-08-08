'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun,
  Maximize2, Minimize2, Check, PanelLeftOpen
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Excalidraw dynamic import state (must be loaded client-side only)
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Track if initial data has been loaded for the current doc
  const initialDataLoadedRef = useRef<string | null>(null);
  // Debounce save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Dynamic import of Excalidraw (client-side only, no SSR)
  useEffect(() => {
    import('@excalidraw/excalidraw').then((mod) => {
      setExcalidrawComp(() => mod.Excalidraw);
    });
  }, []);

  // 2. Load saved canvas tabs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nidus_whiteboard_docs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocs(parsed);
          setActiveDocId(parsed[0].id);
          return;
        }
      }
    } catch (e) {}
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // 3. When switching tabs, load that doc's data into Excalidraw via updateScene
  useEffect(() => {
    if (!excalidrawAPI || !activeDocId) return;
    // Prevent double-loading on initial mount
    if (initialDataLoadedRef.current === activeDocId) return;
    initialDataLoadedRef.current = activeDocId;

    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      excalidrawAPI.updateScene({
        elements: doc.elementsData || [],
        appState: {
          ...(doc.appStateData || {}),
          theme: canvasTheme,
        },
      });
      excalidrawAPI.scrollToContent();
    }
  }, [activeDocId, excalidrawAPI]);

  // LocalStorage persistence helpers
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs));
    } catch (e) {}
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  // Debounced save: called by Excalidraw's onChange
  const handleExcalidrawChange = useCallback(
    (elements: any[], appState: any) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setDocs((prev) => {
          const updated = prev.map((d) =>
            d.id === activeDocId
              ? {
                  ...d,
                  elementsData: elements,
                  appStateData: appState,
                  updated_at: new Date().toISOString(),
                }
              : d
          );
          try {
            localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }, 300);
    },
    [activeDocId]
  );

  // Document tab actions
  const handleCreateDoc = () => {
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
    initialDataLoadedRef.current = null; // Force reload
    setActiveDocId(newDoc.id);
  };

  const handleSwitchDoc = (docId: string) => {
    if (docId === activeDocId) return;
    initialDataLoadedRef.current = null; // Force reload for new doc
    setActiveDocId(docId);
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (docs.length <= 1) {
      // Clear the single doc instead of deleting
      if (excalidrawAPI) {
        excalidrawAPI.resetScene();
      }
      const updated = docs.map((d) =>
        d.id === id ? { ...d, elementsData: [], updated_at: new Date().toISOString() } : d
      );
      saveDocsToStorage(updated);
      return;
    }
    const updated = docs.filter((d) => d.id !== id);
    saveDocsToStorage(updated);
    if (activeDocId === id) {
      initialDataLoadedRef.current = null;
      setActiveDocId(updated[0].id);
    }
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTitle.trim()) {
      setIsRenaming(false);
      return;
    }
    saveDocsToStorage(
      docs.map((d) =>
        d.id === activeDocId
          ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() }
          : d
      )
    );
    setIsRenaming(false);
  };

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
      {/* Top Navigation & Multi-Tab Header Bar */}
      <div className="h-10 px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer shrink-0 mr-1"
              title="Open Navigation Sidebar"
            >
              <PanelLeftOpen
                className="w-4 h-4 text-hn-orange"
                style={{ color: 'var(--accent-color)' }}
              />
            </button>
          )}

          <div className="flex items-center gap-1.5 font-bold text-neutral-800 mr-2 shrink-0">
            <PenTool
              className="w-4 h-4 text-hn-orange"
              style={{ color: 'var(--accent-color)' }}
            />
            <span className="hidden sm:inline">Excalidraw Canvas</span>
          </div>

          <div className="flex items-center gap-1">
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSwitchDoc(doc.id)}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer shrink-0 ${
                  doc.id === activeDocId
                    ? 'bg-neutral-100 text-neutral-900 shadow-2xs border border-neutral-200 font-bold'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className="max-w-[90px] truncate">{doc.title}</span>
                {doc.id === activeDocId && docs.length > 1 && (
                  <span
                    onClick={(e) => handleDeleteDoc(doc.id, e)}
                    className="p-0.5 hover:text-red-600 rounded text-neutral-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={handleCreateDoc}
              className="p-1 hover:bg-neutral-100 text-neutral-500 rounded-md cursor-pointer shrink-0"
              title="New Canvas Note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isRenaming ? (
            <form onSubmit={handleSaveRename} className="flex items-center gap-1">
              <input
                type="text"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                autoFocus
                className="px-2 py-0.5 bg-white border border-neutral-300 rounded text-[11px] font-bold outline-none text-neutral-800"
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
              className="px-2 py-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
              title="Rename Active Canvas"
            >
              <Edit2 className="w-3 h-3" />
              <span className="hidden md:inline">Rename</span>
            </button>
          )}

          <div className="h-4 w-px bg-neutral-200 mx-0.5" />

          <button
            onClick={handleExportPNG}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Export PNG Image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleTheme}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
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
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
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

      {/* Excalidraw Canvas — Full Size */}
      <div className="flex-1 w-full relative overflow-hidden">
        {ExcalidrawComp ? (
          <ExcalidrawComp
            excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
            initialData={{
              elements: activeDoc.elementsData || [],
              appState: {
                theme: canvasTheme,
                viewBackgroundColor: canvasTheme === 'dark' ? '#121212' : '#ffffff',
              },
              scrollToContent: true,
            }}
            onChange={handleExcalidrawChange}
            theme={canvasTheme}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-neutral-50">
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <div className="w-8 h-8 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading Excalidraw...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
