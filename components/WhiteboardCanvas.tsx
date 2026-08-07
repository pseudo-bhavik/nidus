'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun,
  Maximize2, Minimize2, Check, PanelLeftOpen, Hand, MousePointer,
  Minus, Lock, Unlock, Square, Circle, ArrowRight, Type, Eraser,
  Undo, Redo, Sparkles
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

interface WhiteboardCanvasProps {
  activeTheme?: string;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

// Stroke / Fill Palettes
const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#6741d9'];
const BG_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#eebefa'];

type ToolType = 'select' | 'pan' | 'pencil' | 'rect' | 'diamond' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser';

interface CanvasElement {
  id: string;
  type: ToolType;
  points?: { x: number; y: number }[];
  x?: number; y?: number; width?: number; height?: number;
  text?: string;
  strokeColor: string;
  bgColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
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
  onOpenSidebar,
}: WhiteboardCanvasProps) {
  // Doc management
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Tool state
  const [tool, setTool] = useState<ToolType>('pencil');
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1e1e1e');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [roughness, setRoughness] = useState(1);
  const [opacity, setOpacity] = useState(100);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });

  // Drawing state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roughRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  // Load rough.js lazily (pure JS, no React dep)
  useEffect(() => {
    import('roughjs').then((mod) => {
      roughRef.current = mod.default || mod;
    }).catch(() => {
      roughRef.current = null;
    });
  }, []);

  // Load docs
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nidus_whiteboard_docs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocs(parsed);
          setActiveDocId(parsed[0].id);
          if (parsed[0].elementsData) {
            setElements(parsed[0].elementsData);
            setHistory([parsed[0].elementsData]);
          }
          return;
        }
      }
    } catch {}
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // Switch active doc
  useEffect(() => {
    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      const loaded = doc.elementsData || [];
      setElements(loaded);
      setHistory([loaded]);
      setHistoryStep(0);
    }
  }, [activeDocId]);

  // Keyboard handlers for spacebar pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spaceHeld && !(e.target as HTMLElement)?.closest('input,textarea')) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spaceHeld]);

  // Save helpers
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs)); } catch {}
  };

  const updateCurrentDocElements = useCallback((newElements: CanvasElement[]) => {
    setElements(newElements);
    setDocs(prev => {
      const updated = prev.map((d) =>
        d.id === activeDocId ? { ...d, elementsData: newElements, updated_at: new Date().toISOString() } : d
      );
      try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [activeDocId]);

  const pushHistory = useCallback((newElements: CanvasElement[]) => {
    setHistory(prev => {
      const newHist = prev.slice(0, historyStep + 1);
      newHist.push(newElements);
      setHistoryStep(newHist.length - 1);
      return newHist;
    });
    updateCurrentDocElements(newElements);
  }, [historyStep, updateCurrentDocElements]);

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  // Doc management
  const handleCreateDoc = () => {
    const newDoc: WhiteboardCanvasDoc = {
      id: 'doc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: `Canvas Note ${docs.length + 1}`,
      elementsData: [],
      appStateData: { theme: canvasTheme },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveDocsToStorage([newDoc, ...docs]);
    setActiveDocId(newDoc.id);
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (docs.length <= 1) {
      pushHistory([]);
      return;
    }
    const updated = docs.filter((d) => d.id !== id);
    saveDocsToStorage(updated);
    if (activeDocId === id) setActiveDocId(updated[0].id);
  };

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameTitle.trim()) { setIsRenaming(false); return; }
    saveDocsToStorage(docs.map((d) =>
      d.id === activeDocId ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() } : d
    ));
    setIsRenaming(false);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prev = historyStep - 1;
      setHistoryStep(prev);
      updateCurrentDocElements(history[prev]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const next = historyStep + 1;
      setHistoryStep(next);
      updateCurrentDocElements(history[next]);
    }
  };

  // Coordinate conversion
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || tool === 'pan' || spaceHeld) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { ...panOffset };
      return;
    }
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    if (tool === 'text') {
      setActiveTextInput({ x, y, text: '' });
      return;
    }
    if (tool === 'select') return;
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentPath([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: panOffsetStartRef.current.x + dx,
        y: panOffsetStartRef.current.y + dy,
      });
      return;
    }
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    setCurrentPath((prev) => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    if (isPanning) { setIsPanning(false); return; }
    if (!isDrawing) return;
    setIsDrawing(false);
    if (startPos && currentPath.length > 1) {
      const lastPt = currentPath[currentPath.length - 1];
      let newElem: CanvasElement | null = null;
      if (tool === 'pencil' || tool === 'eraser') {
        newElem = { id: 'e-' + Date.now(), type: tool, points: [...currentPath], strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity };
      } else if (tool !== 'select' && tool !== 'pan') {
        newElem = { id: 'e-' + Date.now(), type: tool, x: startPos.x, y: startPos.y, width: lastPt.x - startPos.x, height: lastPt.y - startPos.y, strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity };
      }
      if (newElem) pushHistory([...elements, newElem]);
    }
    setCurrentPath([]);
    setStartPos(null);
    if (!isToolLocked && tool !== 'pan' && tool !== 'select') setTool('select');
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(3.0, Math.max(0.1, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
    } else {
      setPanOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTextInput?.text.trim()) {
      const newElem: CanvasElement = { id: 'e-' + Date.now(), type: 'text', x: activeTextInput.x, y: activeTextInput.y, text: activeTextInput.text.trim(), strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity };
      pushHistory([...elements, newElem]);
    }
    setActiveTextInput(null);
    if (!isToolLocked) setTool('select');
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-canvas.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ---------- Canvas Rendering ----------
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) { animFrameRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      if (container) {
        const w = Math.floor(container.clientWidth);
        const h = Math.floor(container.clientHeight);
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }
      }

      // Background
      ctx.fillStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      const safeZoom = Math.max(0.1, zoom);
      ctx.scale(safeZoom, safeZoom);

      // Dot grid (bounded to visible area only)
      ctx.fillStyle = canvasTheme === 'dark' ? '#333' : '#ddd';
      const grid = 24;
      const visW = canvas.width / safeZoom;
      const visH = canvas.height / safeZoom;
      const offX = -panOffset.x / safeZoom;
      const offY = -panOffset.y / safeZoom;
      const sx = Math.floor(offX / grid) * grid;
      const sy = Math.floor(offY / grid) * grid;
      const ex = sx + visW + grid;
      const ey = sy + visH + grid;
      for (let x = sx; x < ex; x += grid) {
        for (let y = sy; y < ey; y += grid) {
          ctx.fillRect(x, y, 1.5, 1.5);
        }
      }

      // Get rough.js canvas instance
      let rc: any = null;
      try {
        const r = roughRef.current;
        if (r) {
          if (typeof r.canvas === 'function') rc = r.canvas(canvas);
          else if (typeof r === 'function') rc = r(canvas);
          else if (r.default && typeof r.default.canvas === 'function') rc = r.default.canvas(canvas);
        }
      } catch {}

      // Render saved elements
      const drawElement = (elem: CanvasElement) => {
        ctx.globalAlpha = (elem.opacity ?? 100) / 100;
        const rOpts: any = {
          stroke: elem.strokeColor, strokeWidth: elem.strokeWidth, roughness: elem.roughness,
          fill: elem.bgColor !== 'transparent' ? elem.bgColor : undefined, fillStyle: 'hachure',
          strokeLineDash: elem.strokeStyle === 'dashed' ? [8, 8] : elem.strokeStyle === 'dotted' ? [3, 3] : undefined,
        };

        if ((elem.type === 'pencil' || elem.type === 'eraser') && elem.points && elem.points.length > 0) {
          ctx.strokeStyle = elem.type === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#ffffff') : elem.strokeColor;
          ctx.lineWidth = elem.type === 'eraser' ? elem.strokeWidth * 4 : elem.strokeWidth;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(elem.points[0].x, elem.points[0].y);
          elem.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
        } else if (elem.type === 'rect' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
          if (rc) { try { rc.rectangle(elem.x, elem.y, elem.width, elem.height, rOpts); } catch { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.strokeRect(elem.x, elem.y, elem.width, elem.height); } }
          else { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; if (elem.bgColor !== 'transparent') { ctx.fillStyle = elem.bgColor; ctx.fillRect(elem.x, elem.y, elem.width, elem.height); } ctx.strokeRect(elem.x, elem.y, elem.width, elem.height); }
        } else if (elem.type === 'diamond' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
          const cx = elem.x + elem.width / 2, cy = elem.y + elem.height / 2;
          const pts: [number, number][] = [[cx, elem.y], [elem.x + elem.width, cy], [cx, elem.y + elem.height], [elem.x, cy]];
          if (rc) { try { rc.polygon(pts, rOpts); } catch { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); } }
          else { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath(); if (elem.bgColor !== 'transparent') { ctx.fillStyle = elem.bgColor; ctx.fill(); } ctx.stroke(); }
        } else if (elem.type === 'circle' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
          const cx = elem.x + elem.width / 2, cy = elem.y + elem.height / 2;
          if (rc) { try { rc.ellipse(cx, cy, Math.abs(elem.width), Math.abs(elem.height), rOpts); } catch { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(elem.width / 2), Math.abs(elem.height / 2), 0, 0, Math.PI * 2); ctx.stroke(); } }
          else { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(elem.width / 2), Math.abs(elem.height / 2), 0, 0, Math.PI * 2); if (elem.bgColor !== 'transparent') { ctx.fillStyle = elem.bgColor; ctx.fill(); } ctx.stroke(); }
        } else if ((elem.type === 'arrow' || elem.type === 'line') && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
          const toX = elem.x + elem.width, toY = elem.y + elem.height;
          if (rc) { try { rc.line(elem.x, elem.y, toX, toY, rOpts); } catch { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.moveTo(elem.x, elem.y); ctx.lineTo(toX, toY); ctx.stroke(); } }
          else { ctx.strokeStyle = elem.strokeColor; ctx.lineWidth = elem.strokeWidth; ctx.beginPath(); ctx.moveTo(elem.x, elem.y); ctx.lineTo(toX, toY); ctx.stroke(); }
          if (elem.type === 'arrow') {
            const angle = Math.atan2(elem.height, elem.width);
            const hl = Math.max(12, elem.strokeWidth * 3);
            ctx.fillStyle = elem.strokeColor; ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - hl * Math.cos(angle - Math.PI / 6), toY - hl * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(toX - hl * Math.cos(angle + Math.PI / 6), toY - hl * Math.sin(angle + Math.PI / 6));
            ctx.closePath(); ctx.fill();
          }
        } else if (elem.type === 'text' && elem.x != null && elem.y != null && elem.text) {
          ctx.fillStyle = elem.strokeColor;
          ctx.font = '600 16px "Segoe UI", Inter, sans-serif';
          ctx.fillText(elem.text, elem.x, elem.y);
        }
        ctx.globalAlpha = 1;
      };

      elements.forEach(drawElement);

      // Live preview while drawing
      if (isDrawing && currentPath.length > 1 && startPos) {
        ctx.globalAlpha = opacity / 100;
        const last = currentPath[currentPath.length - 1];
        if (tool === 'pencil' || tool === 'eraser') {
          ctx.strokeStyle = tool === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#fff') : strokeColor;
          ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(currentPath[0].x, currentPath[0].y);
          currentPath.forEach((pt) => ctx.lineTo(pt.x, pt.y)); ctx.stroke();
        } else {
          const w = last.x - startPos.x, h = last.y - startPos.y;
          ctx.strokeStyle = strokeColor; ctx.lineWidth = strokeWidth;
          if (tool === 'rect') { ctx.strokeRect(startPos.x, startPos.y, w, h); }
          else if (tool === 'diamond') { const cx = startPos.x + w/2, cy = startPos.y + h/2; ctx.beginPath(); ctx.moveTo(cx, startPos.y); ctx.lineTo(startPos.x + w, cy); ctx.lineTo(cx, startPos.y + h); ctx.lineTo(startPos.x, cy); ctx.closePath(); ctx.stroke(); }
          else if (tool === 'circle') { ctx.beginPath(); ctx.ellipse(startPos.x + w/2, startPos.y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2); ctx.stroke(); }
          else if (tool === 'arrow' || tool === 'line') { ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(last.x, last.y); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    };

    // Use requestAnimationFrame loop for smooth rendering
    let running = true;
    const loop = () => {
      if (!running) return;
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [elements, currentPath, isDrawing, canvasTheme, tool, strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity, panOffset, zoom, startPos]);

  // Sync stroke color on theme toggle
  useEffect(() => {
    if (canvasTheme === 'dark' && strokeColor === '#1e1e1e') setStrokeColor('#ffffff');
    else if (canvasTheme === 'light' && strokeColor === '#ffffff') setStrokeColor('#1e1e1e');
  }, [canvasTheme]);

  const cursorStyle = tool === 'pan' || spaceHeld || isPanning ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  const TOOLS: { id: ToolType; label: string; icon: any }[] = [
    { id: 'pan', label: 'Hand (Pan)', icon: Hand },
    { id: 'select', label: 'Selection', icon: MousePointer },
    { id: 'rect', label: 'Rectangle', icon: Square },
    { id: 'diamond', label: 'Diamond', icon: Sparkles },
    { id: 'circle', label: 'Ellipse', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: ArrowRight },
    { id: 'line', label: 'Line', icon: Minus },
    { id: 'pencil', label: 'Draw', icon: PenTool },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
  ];

  return (
    <div className={`w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Bar */}
      <div className="h-10 px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          {!isSidebarOpen && onOpenSidebar && (
            <button onClick={onOpenSidebar} className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer shrink-0 mr-1" title="Open Sidebar">
              <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <div className="flex items-center gap-1.5 font-bold text-neutral-800 mr-2 shrink-0">
            <PenTool className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            <span className="hidden sm:inline">Whiteboard Canvas</span>
          </div>
          <div className="flex items-center gap-1">
            {docs.map((doc) => (
              <button key={doc.id} onClick={() => setActiveDocId(doc.id)} className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer shrink-0 ${doc.id === activeDocId ? 'bg-neutral-100 text-neutral-900 shadow-sm border border-neutral-200 font-bold' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}`}>
                <span className="max-w-[90px] truncate">{doc.title}</span>
                {doc.id === activeDocId && <span onClick={(e) => handleDeleteDoc(doc.id, e)} className="p-0.5 hover:text-red-600 rounded text-neutral-400 cursor-pointer"><Trash2 className="w-3 h-3" /></span>}
              </button>
            ))}
            <button onClick={handleCreateDoc} className="p-1 hover:bg-neutral-100 text-neutral-500 rounded-md cursor-pointer shrink-0" title="New Canvas"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isRenaming ? (
            <form onSubmit={handleSaveRename} className="flex items-center gap-1">
              <input type="text" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} autoFocus className="px-2 py-0.5 bg-white border border-neutral-300 rounded text-[11px] font-bold outline-none text-neutral-800" />
              <button type="submit" className="p-1 bg-neutral-900 text-white rounded cursor-pointer"><Check className="w-3 h-3" /></button>
            </form>
          ) : (
            <button onClick={() => { setRenameTitle(activeDoc.title); setIsRenaming(true); }} className="px-2 py-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded flex items-center gap-1 font-semibold text-[11px] cursor-pointer" title="Rename">
              <Edit2 className="w-3 h-3" /><span className="hidden md:inline">Rename</span>
            </button>
          )}
          <div className="h-4 w-px bg-neutral-200 mx-0.5" />
          <button onClick={handleExportPNG} className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer" title="Export PNG"><Download className="w-3.5 h-3.5" /></button>
          <button onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')} className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer" title="Toggle Theme">{canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}</button>
          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer" title="Full Screen">{isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex">
        {/* Left Properties Panel */}
        <div className="w-52 bg-white/95 border-r border-neutral-200 p-3 flex flex-col gap-3 text-xs select-none shadow-sm z-20 overflow-y-auto shrink-0">
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke</span>
            <div className="flex items-center gap-1.5">{STROKE_COLORS.map((c) => (<button key={c} onClick={() => setStrokeColor(c)} className={`w-6 h-6 rounded-md border border-black/10 transition-all ${strokeColor === c ? 'scale-110 ring-2 ring-indigo-500' : 'hover:scale-105'}`} style={{ backgroundColor: c }} />))}</div>
          </div>
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Background</span>
            <div className="flex items-center gap-1.5">{BG_COLORS.map((c) => (<button key={c} onClick={() => setBgColor(c)} className={`w-6 h-6 rounded-md border border-black/10 transition-all ${bgColor === c ? 'scale-110 ring-2 ring-indigo-500' : 'hover:scale-105'} ${c === 'transparent' ? 'bg-[radial-gradient(#ccc_1px,transparent_1px)] [background-size:6px_6px]' : ''}`} style={{ backgroundColor: c === 'transparent' ? undefined : c }} />))}</div>
          </div>
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke width</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">{[{ w: 1, l: 'Thin' }, { w: 2, l: 'Medium' }, { w: 4, l: 'Thick' }].map((s) => (<button key={s.w} onClick={() => setStrokeWidth(s.w)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${strokeWidth === s.w ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{s.l}</button>))}</div>
          </div>
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke style</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">{[{ s: 'solid', l: 'Solid' }, { s: 'dashed', l: 'Dashed' }, { s: 'dotted', l: 'Dotted' }].map((s) => (<button key={s.s} onClick={() => setStrokeStyle(s.s as any)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${strokeStyle === s.s ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{s.l}</button>))}</div>
          </div>
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Sloppiness</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">{[{ v: 0, l: 'Architect' }, { v: 1, l: 'Artist' }, { v: 2, l: 'Cartoon' }].map((r) => (<button key={r.v} onClick={() => setRoughness(r.v)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${roughness === r.v ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{r.l}</button>))}</div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1"><span>Opacity</span><span className="text-neutral-800">{opacity}%</span></div>
            <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
          </div>
        </div>

        {/* Canvas + floating toolbar */}
        <div ref={containerRef} className="flex-1 relative">
          {/* Top Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-neutral-200 shadow-lg rounded-2xl px-2 py-1.5 flex items-center gap-1">
            <button onClick={() => setIsToolLocked(!isToolLocked)} className={`p-2 rounded-xl transition-all ${isToolLocked ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-600 hover:bg-neutral-100'}`} title={isToolLocked ? 'Tool locked' : 'Lock tool'}>{isToolLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
            <div className="h-5 w-px bg-neutral-200 mx-0.5" />
            {TOOLS.map((t) => { const Icon = t.icon; return (<button key={t.id} onClick={() => setTool(t.id)} className={`p-2 rounded-xl transition-all cursor-pointer ${tool === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100'}`} title={t.label}><Icon className="w-4 h-4" /></button>); })}
          </div>

          {/* Text input overlay */}
          {activeTextInput && (
            <form onSubmit={handleTextSubmit} style={{ position: 'absolute', top: activeTextInput.y * zoom + panOffset.y, left: activeTextInput.x * zoom + panOffset.x + 208, zIndex: 50 }}>
              <input type="text" value={activeTextInput.text} onChange={(e) => setActiveTextInput({ ...activeTextInput, text: e.target.value })} onBlur={handleTextSubmit} placeholder="Type & press Enter…" autoFocus className="px-2.5 py-1 bg-white border-2 border-indigo-500 rounded-lg shadow-lg text-xs font-semibold outline-none text-neutral-900 min-w-[180px]" />
            </form>
          )}

          {/* Bottom Zoom / Undo Bar */}
          <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-md border border-neutral-200 shadow-lg rounded-xl p-1.5 flex items-center gap-2 text-xs font-bold">
            <button onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"><Minus className="w-3.5 h-3.5" /></button>
            <span className="w-12 text-center text-neutral-800">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.1).toFixed(2)))} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /></button>
            <div className="h-4 w-px bg-neutral-200 mx-0.5" />
            <button onClick={handleUndo} disabled={historyStep <= 0} className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer"><Undo className="w-3.5 h-3.5" /></button>
            <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer"><Redo className="w-3.5 h-3.5" /></button>
          </div>

          {/* Reset view button */}
          {(panOffset.x !== 0 || panOffset.y !== 0 || zoom !== 1.0) && (
            <button onClick={() => { setPanOffset({ x: 0, y: 0 }); setZoom(1.0); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-white/95 border border-neutral-200 shadow-md rounded-full text-xs font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer">
              Scroll back to content
            </button>
          )}

          {/* The Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full block"
            style={{ cursor: cursorStyle }}
          />
        </div>
      </div>
    </div>
  );
}
