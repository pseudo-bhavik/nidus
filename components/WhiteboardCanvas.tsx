'use client';

import React, { useState, useEffect } from 'react';
import { 
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun, 
  Maximize2, Minimize2, Check, PanelLeftOpen, ExternalLink, RotateCcw
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

interface WhiteboardCanvasProps {
  activeTheme?: string;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

const DEFAULT_DOC: WhiteboardCanvasDoc = {
  id: 'doc-default',
  title: 'Untitled Canvas',
  elementsData: [],
  appStateData: { theme: 'light' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function WhiteboardCanvas({ 
  activeTheme = 'orange', 
  isSidebarOpen = true, 
  onOpenSidebar 
}: WhiteboardCanvasProps) {
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Load saved canvas docs list
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
    } catch (e) {}
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs));
    } catch (e) {}
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

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
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (docs.length <= 1) return;
    const updated = docs.filter((d) => d.id !== id);
    saveDocsToStorage(updated);
    if (activeDocId === id) setActiveDocId(updated[0].id);
  };

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

  // Build excalidraw embed URL with theme parameters
  const excalidrawEmbedUrl = `https://excalidraw.com/#theme=${canvasTheme}`;

  return (
    <div className={`w-full h-full flex flex-col bg-[#f8f9fa] text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      
      {/* Top Navigation & Tab Bar */}
      <div className="h-10 px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          
          {/* Left Sidebar Restore Button */}
          {!isSidebarOpen && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 hover:text-neutral-900 cursor-pointer transition-all shrink-0 mr-1"
              title="Expand Left Navigation Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}

          <div className="flex items-center gap-1.5 font-bold text-neutral-800 mr-2 shrink-0">
            <PenTool className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            <span className="hidden sm:inline">Excalidraw Canvas</span>
          </div>

          {/* Document Tabs */}
          <div className="flex items-center gap-1">
            {docs.map((doc) => {
              const isActive = doc.id === activeDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveDocId(doc.id);
                    setIframeKey((prev) => prev + 1);
                  }}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-neutral-100 text-neutral-900 shadow-2xs border border-neutral-250 font-bold'
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/60'
                  }`}
                >
                  <span className="max-w-[90px] truncate">{doc.title}</span>
                  {isActive && docs.length > 1 && (
                    <span
                      onClick={(e) => handleDeleteDoc(doc.id, e)}
                      className="p-0.5 hover:text-red-600 hover:bg-neutral-200/60 rounded text-neutral-400 cursor-pointer"
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
              className="p-1 hover:bg-neutral-200/70 text-neutral-500 rounded-md transition-all cursor-pointer shrink-0"
              title="New Canvas Note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Header Action Buttons */}
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
              <button type="submit" className="p-1 bg-neutral-900 text-white rounded hover:bg-neutral-800 cursor-pointer">
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

          <button
            onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all"
            title="Toggle Dark/Light Theme"
          >
            {canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          <a
            href="https://excalidraw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all"
            title="Open in Official Excalidraw Tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Whiteboard'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 100% Authentic Excalidraw Frame (Smooth 60-120FPS, native Excalidraw app) */}
      <div className="flex-1 w-full h-full relative bg-white overflow-hidden">
        <iframe
          key={`${activeDoc.id}-${canvasTheme}-${iframeKey}`}
          src={excalidrawEmbedUrl}
          className="w-full h-full border-0 block"
          title="Excalidraw Whiteboard"
          allow="clipboard-read; clipboard-write; acceleration; camera; microphone"
        />
      </div>
    </div>
  );
}
