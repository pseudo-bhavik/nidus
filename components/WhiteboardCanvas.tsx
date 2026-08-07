'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun, 
  RotateCcw, Check, Maximize2, Minimize2
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

// Dynamic SSR-disabled import of Excalidraw
const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-50 text-neutral-500 font-semibold text-xs gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-300 border-t-neutral-800" />
        <span>Loading Excalidraw Canvas Engine...</span>
      </div>
    ),
  }
);

interface WhiteboardCanvasProps {
  activeTheme?: string;
}

const DEFAULT_DOC: WhiteboardCanvasDoc = {
  id: 'doc-default',
  title: 'Untitled Canvas',
  elementsData: [],
  appStateData: { theme: 'light' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function WhiteboardCanvas({ activeTheme = 'orange' }: WhiteboardCanvasProps) {
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Load docs from localStorage on mount
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem('nidus_whiteboard_docs');
      if (savedDocs) {
        const parsed = JSON.parse(savedDocs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocs(parsed);
          setActiveDocId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load whiteboard docs:', e);
    }

    // Default initial doc
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // Save docs to localStorage
  const saveDocsToStorage = (newDocs: WhiteboardCanvasDoc[]) => {
    setDocs(newDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(newDocs));
    } catch (e) {
      console.error('Failed to save whiteboard docs:', e);
    }
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  // Create new canvas document
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
    setActiveDocId(newDoc.id);

    if (excalidrawAPI) {
      excalidrawAPI.resetScene();
    }
  };

  // Delete canvas document
  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (docs.length <= 1) {
      handleClearCanvas();
      return;
    }

    const updated = docs.filter((d) => d.id !== id);
    saveDocsToStorage(updated);
    if (activeDocId === id) {
      setActiveDocId(updated[0].id);
    }
  };

  // Rename document
  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTitle.trim()) {
      setIsRenaming(false);
      return;
    }

    const updated = docs.map((d) =>
      d.id === activeDocId ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() } : d
    );
    saveDocsToStorage(updated);
    setIsRenaming(false);
  };

  // Excalidraw scene change handler with debounced auto-save
  const handleCanvasChange = (elements: readonly any[], appState: any) => {
    if (!activeDocId) return;

    const updated = docs.map((d) => {
      if (d.id === activeDocId) {
        return {
          ...d,
          elementsData: Array.from(elements),
          appStateData: { theme: appState.theme },
          updated_at: new Date().toISOString(),
        };
      }
      return d;
    });

    setDocs(updated);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated));
    } catch (e) {}
  };

  // Clear canvas
  const handleClearCanvas = () => {
    if (excalidrawAPI) {
      excalidrawAPI.resetScene();
    }
    const updated = docs.map((d) =>
      d.id === activeDocId ? { ...d, elementsData: [], updated_at: new Date().toISOString() } : d
    );
    saveDocsToStorage(updated);
  };

  // Export scene to image
  const handleExportImage = async () => {
    if (!excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements();
      if (!elements || elements.length === 0) return;

      const mod = await import('@excalidraw/excalidraw');
      const canvas = await mod.exportToCanvas({
        elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          exportWithBackground: true,
        },
        files: excalidrawAPI.getFiles(),
      });

      const link = document.createElement('a');
      link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-whiteboard.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Failed to export image:', e);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Controls Toolbar */}
      <div className="h-11 px-4 bg-neutral-50/90 border-b border-border-color flex items-center justify-between shrink-0 text-xs">
        {/* Left: Document Tabs & Title */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          <div className="flex items-center gap-1.5 font-bold text-neutral-700 mr-2 shrink-0">
            <PenTool className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            <span className="hidden sm:inline">Whiteboard Notes</span>
          </div>

          {/* Docs Selector Pills */}
          <div className="flex items-center gap-1">
            {docs.map((doc) => {
              const isActive = doc.id === activeDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all-custom cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200/80 font-bold'
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'
                  }`}
                >
                  <span className="max-w-[100px] truncate">{doc.title}</span>
                  {isActive && (
                    <span
                      onClick={(e) => handleDeleteDoc(doc.id, e)}
                      className="p-0.5 hover:text-red-600 hover:bg-neutral-100 rounded text-neutral-400 cursor-pointer"
                      title="Delete Canvas"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={handleCreateDoc}
              className="p-1 hover:bg-neutral-200/70 text-neutral-500 rounded-md transition-all-custom cursor-pointer shrink-0"
              title="New Whiteboard"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Actions (Rename, Export, Clear, Dark/Light, FullScreen) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Title Edit Form */}
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
                className="p-1 bg-neutral-900 text-white rounded hover:bg-neutral-800 cursor-pointer"
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
              className="px-2 py-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/50 rounded flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
              title="Rename Active Canvas"
            >
              <Edit2 className="w-3 h-3" />
              <span className="hidden md:inline">Rename</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-neutral-200 mx-0.5" />

          {/* Export PNG */}
          <button
            onClick={handleExportImage}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
            title="Export Canvas Image (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear Scene */}
          <button
            onClick={handleClearCanvas}
            className="p-1.5 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-all-custom"
            title="Clear Canvas Scene"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
            title="Toggle Canvas Theme (Light/Dark)"
          >
            {canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Full Screen Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Whiteboard'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Excalidraw Area */}
      <div className="flex-1 w-full h-full relative">
        <Excalidraw
          key={`${activeDoc.id}-${canvasTheme}`}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={{
            elements: activeDoc.elementsData || [],
            appState: {
              theme: canvasTheme,
              viewBackgroundColor: canvasTheme === 'dark' ? '#121212' : '#ffffff',
              currentItemFontFamily: 1,
            },
          }}
          onChange={handleCanvasChange}
          theme={canvasTheme}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: true,
              loadScene: true,
              saveToActiveFile: false,
              toggleTheme: true,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  );
}
