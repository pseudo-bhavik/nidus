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

// Sleek stroke / background color palettes (Excalidraw aesthetic + Nidus dark mode support)
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
  // Document state
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Active Tool & Properties
  const [tool, setTool] = useState<ToolType>('pencil');
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1e1e1e');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [roughness, setRoughness] = useState(1);
  const [opacity, setOpacity] = useState(100);

  // Infinite View Transforms
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });

  // Canvas elements & history
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Drawing refs (useRef avoids re-triggering React state re-renders on mousemove!)
  const isDrawingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  const activeTextInputRef = useRef<{ x: number; y: number; text: string } | null>(null);
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Canvas refs & Rough.js Cache
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roughLibRef = useRef<any>(null);
  const generatorRef = useRef<any>(null);
  const drawableCacheRef = useRef<Map<string, { key: string; drawable: any }>>(new Map());
  const renderPendingRef = useRef(false);

  // Load roughjs asynchronously without blocking UI
  useEffect(() => {
    import('roughjs').then((mod) => {
      const r = mod.default || mod;
      roughLibRef.current = r;
      if (r && typeof r.generator === 'function') {
        generatorRef.current = r.generator();
      }
      requestRender();
    }).catch((e) => {
      console.warn('Rough.js load fallback:', e);
    });
  }, []);

  // Load saved document state
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
    } catch (e) {}
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // Switch active document
  useEffect(() => {
    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      const loaded = doc.elementsData || [];
      setElements(loaded);
      setHistory([loaded]);
      setHistoryStep(0);
      drawableCacheRef.current.clear();
    }
  }, [activeDocId]);

  // Spacebar pan listener
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

  // Save document state
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs)); } catch (e) {}
  };

  const updateCurrentDocElements = useCallback((newElements: CanvasElement[]) => {
    setElements(newElements);
    setDocs((prev) => {
      const updated = prev.map((d) =>
        d.id === activeDocId ? { ...d, elementsData: newElements, updated_at: new Date().toISOString() } : d
      );
      try { localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  }, [activeDocId]);

  const pushHistory = useCallback((newElements: CanvasElement[]) => {
    setHistory((prev) => {
      const newHist = prev.slice(0, historyStep + 1);
      newHist.push(newElements);
      setHistoryStep(newHist.length - 1);
      return newHist;
    });
    updateCurrentDocElements(newElements);
  }, [historyStep, updateCurrentDocElements]);

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  // Document Management
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

  // Convert Screen Mouse Coordinates to World Infinite Canvas Coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom]);

  // ---------- Optimized Dirty-Flag Rendering Engine ----------
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    // 1. Clear background
    ctx.fillStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    const safeZoom = Math.max(0.1, zoom);
    ctx.scale(safeZoom, safeZoom);

    // 2. Bounded Dot Grid Background (Fast 2D Context fill)
    ctx.fillStyle = canvasTheme === 'dark' ? '#333333' : '#e2e8f0';
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

    // Rough.js Instance setup
    let rc: any = null;
    let gen: any = generatorRef.current;
    try {
      const r = roughLibRef.current;
      if (r) {
        if (typeof r.canvas === 'function') rc = r.canvas(canvas);
        else if (typeof r === 'function') rc = r(canvas);
        else if (r.default && typeof r.default.canvas === 'function') rc = r.default.canvas(canvas);
        if (!gen && typeof r.generator === 'function') {
          gen = r.generator();
          generatorRef.current = gen;
        }
      }
    } catch (e) {}

    // 3. Render Elements with Rough.js Drawable Caching
    elements.forEach((elem) => {
      ctx.globalAlpha = (elem.opacity ?? 100) / 100;

      // Handle Freehand Pencil / Eraser
      if ((elem.type === 'pencil' || elem.type === 'eraser') && elem.points && elem.points.length > 0) {
        ctx.strokeStyle = elem.type === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#ffffff') : elem.strokeColor;
        ctx.lineWidth = elem.type === 'eraser' ? elem.strokeWidth * 4 : elem.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        for (let i = 1; i < elem.points.length; i++) {
          ctx.lineTo(elem.points[i].x, elem.points[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }

      // Handle Text elements
      if (elem.type === 'text' && elem.x != null && elem.y != null && elem.text) {
        ctx.fillStyle = elem.strokeColor;
        ctx.font = '600 16px "Segoe UI", Inter, sans-serif';
        ctx.fillText(elem.text, elem.x, elem.y);
        ctx.globalAlpha = 1;
        return;
      }

      // Handle Geometric Rough.js Shapes with Cache Lookup
      if (elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
        const cacheKey = `${elem.id}_${elem.x}_${elem.y}_${elem.width}_${elem.height}_${elem.strokeColor}_${elem.bgColor}_${elem.strokeWidth}_${elem.strokeStyle}_${elem.roughness}_${elem.opacity}_${elem.type}`;
        let cached = drawableCacheRef.current.get(elem.id);

        if (!cached || cached.key !== cacheKey) {
          let drawable: any = null;
          const rOpts: any = {
            stroke: elem.strokeColor,
            strokeWidth: elem.strokeWidth,
            roughness: elem.roughness,
            fill: elem.bgColor !== 'transparent' ? elem.bgColor : undefined,
            fillStyle: 'hachure',
            strokeLineDash: elem.strokeStyle === 'dashed' ? [8, 8] : elem.strokeStyle === 'dotted' ? [3, 3] : undefined,
          };

          if (gen) {
            try {
              if (elem.type === 'rect') {
                drawable = gen.rectangle(elem.x, elem.y, elem.width, elem.height, rOpts);
              } else if (elem.type === 'diamond') {
                const cx = elem.x + elem.width / 2, cy = elem.y + elem.height / 2;
                drawable = gen.polygon([[cx, elem.y], [elem.x + elem.width, cy], [cx, elem.y + elem.height], [elem.x, cy]], rOpts);
              } else if (elem.type === 'circle') {
                const cx = elem.x + elem.width / 2, cy = elem.y + elem.height / 2;
                drawable = gen.ellipse(cx, cy, Math.abs(elem.width), Math.abs(elem.height), rOpts);
              } else if (elem.type === 'arrow' || elem.type === 'line') {
                drawable = gen.line(elem.x, elem.y, elem.x + elem.width, elem.y + elem.height, rOpts);
              }
            } catch (e) {}
          }
          cached = { key: cacheKey, drawable };
          drawableCacheRef.current.set(elem.id, cached);
        }

        // Fast render cached drawable via Rough.js
        if (rc && cached.drawable) {
          try { rc.draw(cached.drawable); } catch (e) {}
        } else {
          // Pure 2D Context Fallback
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
          if (elem.type === 'rect') {
            if (elem.bgColor !== 'transparent') { ctx.fillStyle = elem.bgColor; ctx.fillRect(elem.x, elem.y, elem.width, elem.height); }
            ctx.strokeRect(elem.x, elem.y, elem.width, elem.height);
          } else if (elem.type === 'circle') {
            const cx = elem.x + elem.width / 2, cy = elem.y + elem.height / 2;
            ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(elem.width / 2), Math.abs(elem.height / 2), 0, 0, Math.PI * 2);
            if (elem.bgColor !== 'transparent') { ctx.fillStyle = elem.bgColor; ctx.fill(); }
            ctx.stroke();
          } else {
            ctx.beginPath(); ctx.moveTo(elem.x, elem.y); ctx.lineTo(elem.x + elem.width, elem.y + elem.height); ctx.stroke();
          }
        }

        // Draw Arrowhead if arrow
        if (elem.type === 'arrow') {
          const toX = elem.x + elem.width, toY = elem.y + elem.height;
          const angle = Math.atan2(elem.height, elem.width);
          const hl = Math.max(12, elem.strokeWidth * 3);
          ctx.fillStyle = elem.strokeColor;
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - hl * Math.cos(angle - Math.PI / 6), toY - hl * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(toX - hl * Math.cos(angle + Math.PI / 6), toY - hl * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    // 4. Render Active Live Drawing Stroke / Shape Preview
    if (isDrawingRef.current && currentPathRef.current.length > 0 && startPosRef.current) {
      ctx.globalAlpha = opacity / 100;
      const pts = currentPathRef.current;
      const start = startPosRef.current;
      const last = pts[pts.length - 1];

      if (tool === 'pencil' || tool === 'eraser') {
        ctx.strokeStyle = tool === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#ffffff') : strokeColor;
        ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
      } else {
        const w = last.x - start.x, h = last.y - start.y;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        if (tool === 'rect') {
          ctx.strokeRect(start.x, start.y, w, h);
        } else if (tool === 'diamond') {
          const cx = start.x + w / 2, cy = start.y + h / 2;
          ctx.beginPath(); ctx.moveTo(cx, start.y); ctx.lineTo(start.x + w, cy); ctx.lineTo(cx, start.y + h); ctx.lineTo(start.x, cy); ctx.closePath(); ctx.stroke();
        } else if (tool === 'circle') {
          ctx.beginPath(); ctx.ellipse(start.x + w / 2, start.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); ctx.stroke();
        } else if (tool === 'arrow' || tool === 'line') {
          ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(last.x, last.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [elements, canvasTheme, panOffset, zoom, opacity, strokeColor, strokeWidth, tool]);

  // Batch request animation frame rendering (dirty flag pattern)
  const requestRender = useCallback(() => {
    if (!renderPendingRef.current) {
      renderPendingRef.current = true;
      requestAnimationFrame(() => {
        renderPendingRef.current = false;
        renderCanvas();
      });
    }
  }, [renderCanvas]);

  // Re-render whenever parameters change
  useEffect(() => {
    requestRender();
  }, [requestRender, elements, canvasTheme, panOffset, zoom, tool, strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity]);

  // Window Resize listener
  useEffect(() => {
    const handleResize = () => requestRender();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [requestRender]);

  // ---------- Mouse & Touch Handlers ----------
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
      activeTextInputRef.current = { x, y, text: '' };
      return;
    }

    if (tool === 'select') return;

    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    currentPathRef.current = [{ x, y }];
    requestRender();
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

    if (!isDrawingRef.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    currentPathRef.current.push({ x, y });
    requestRender();
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const pts = currentPathRef.current;
    const start = startPosRef.current;

    if (start && pts.length > 0) {
      const last = pts[pts.length - 1];
      let newElem: CanvasElement | null = null;

      if (tool === 'pencil' || tool === 'eraser') {
        newElem = {
          id: 'e-' + Date.now() + Math.random().toString(36).substr(2, 4),
          type: tool,
          points: [...pts],
          strokeColor,
          bgColor,
          strokeWidth,
          strokeStyle,
          roughness,
          opacity,
        };
      } else if (tool !== 'select' && tool !== 'pan') {
        const w = last.x - start.x;
        const h = last.y - start.y;
        if (Math.abs(w) > 2 || Math.abs(h) > 2) {
          newElem = {
            id: 'e-' + Date.now() + Math.random().toString(36).substr(2, 4),
            type: tool,
            x: start.x,
            y: start.y,
            width: w,
            height: h,
            strokeColor,
            bgColor,
            strokeWidth,
            strokeStyle,
            roughness,
            opacity,
          };
        }
      }

      if (newElem) {
        pushHistory([...elements, newElem]);
      }
    }

    currentPathRef.current = [];
    startPosRef.current = null;
    if (!isToolLocked && tool !== 'pan' && tool !== 'select') {
      setTool('select');
    }
    requestRender();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.min(3.0, Math.max(0.1, +(z + zoomDelta).toFixed(2))));
    } else {
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTextInput?.text.trim()) {
      const newElem: CanvasElement = {
        id: 'e-' + Date.now(),
        type: 'text',
        x: activeTextInput.x,
        y: activeTextInput.y,
        text: activeTextInput.text.trim(),
        strokeColor,
        bgColor,
        strokeWidth,
        strokeStyle,
        roughness,
        opacity,
      };
      pushHistory([...elements, newElem]);
    }
    setActiveTextInput(null);
    activeTextInputRef.current = null;
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
      
      {/* Top Document Pill Bar */}
      <div className="h-10 px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          {!isSidebarOpen && onOpenSidebar && (
            <button onClick={onOpenSidebar} className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer shrink-0 mr-1" title="Open Sidebar">
              <PanelLeftOpen className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <div className="flex items-center gap-1.5 font-bold text-neutral-800 mr-2 shrink-0">
            <PenTool className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
            <span className="hidden sm:inline">Excalidraw Canvas</span>
          </div>

          <div className="flex items-center gap-1">
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setActiveDocId(doc.id)}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all cursor-pointer shrink-0 ${
                  doc.id === activeDocId ? 'bg-neutral-100 text-neutral-900 shadow-2xs border border-neutral-200 font-bold' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className="max-w-[90px] truncate">{doc.title}</span>
                {doc.id === activeDocId && (
                  <span onClick={(e) => handleDeleteDoc(doc.id, e)} className="p-0.5 hover:text-red-600 rounded text-neutral-400 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button onClick={handleCreateDoc} className="p-1 hover:bg-neutral-100 text-neutral-500 rounded-md cursor-pointer shrink-0" title="New Canvas">
              <Plus className="w-3.5 h-3.5" />
            </button>
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
          <button
            onClick={handleExportPNG}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Export PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Toggle Theme"
          >
            {canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Full Screen"
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex">
        
        {/* Left Inspector Properties Panel */}
        <div className="w-52 bg-white/95 border-r border-neutral-200 p-3 flex flex-col gap-3 text-xs select-none shadow-2xs z-20 overflow-y-auto shrink-0">
          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke</span>
            <div className="flex items-center gap-1.5">
              {STROKE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setStrokeColor(c)}
                  className={`w-6 h-6 rounded-md border border-black/10 transition-all ${
                    strokeColor === c ? 'scale-110 ring-2 ring-indigo-500 shadow-xs' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Background</span>
            <div className="flex items-center gap-1.5">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-6 h-6 rounded-md border border-black/10 transition-all ${
                    bgColor === c ? 'scale-110 ring-2 ring-indigo-500 shadow-xs' : 'hover:scale-105'
                  } ${c === 'transparent' ? 'bg-[radial-gradient(#ccc_1px,transparent_1px)] [background-size:6px_6px]' : ''}`}
                  style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke width</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
              {[{ w: 1, l: 'Thin' }, { w: 2, l: 'Medium' }, { w: 4, l: 'Thick' }].map((s) => (
                <button key={s.w} onClick={() => setStrokeWidth(s.w)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${strokeWidth === s.w ? 'bg-white shadow-2xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{s.l}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke style</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
              {[{ s: 'solid', l: 'Solid' }, { s: 'dashed', l: 'Dashed' }, { s: 'dotted', l: 'Dotted' }].map((s) => (
                <button key={s.s} onClick={() => setStrokeStyle(s.s as any)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${strokeStyle === s.s ? 'bg-white shadow-2xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{s.l}</button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Sloppiness</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
              {[{ v: 0, l: 'Architect' }, { v: 1, l: 'Artist' }, { v: 2, l: 'Cartoon' }].map((r) => (
                <button key={r.v} onClick={() => setRoughness(r.v)} className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${roughness === r.v ? 'bg-white shadow-2xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}>{r.l}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
              <span>Opacity</span>
              <span className="text-neutral-800">{opacity}%</span>
            </div>
            <input type="range" min="10" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
          </div>
        </div>

        {/* Floating Canvas Workspace */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          
          {/* Top Excalidraw Floating Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-md rounded-2xl px-2 py-1.5 flex items-center gap-1">
            <button
              onClick={() => setIsToolLocked(!isToolLocked)}
              className={`p-2 rounded-xl transition-all ${isToolLocked ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
              title={isToolLocked ? 'Tool locked' : 'Lock tool'}
            >
              {isToolLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <div className="h-5 w-px bg-neutral-200 mx-0.5" />
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    tool === t.id ? 'bg-indigo-600 text-white shadow-2xs' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                  title={t.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Text Tool Active Input Overlay */}
          {activeTextInput && (
            <form
              onSubmit={handleTextSubmit}
              style={{
                position: 'absolute',
                top: activeTextInput.y * zoom + panOffset.y,
                left: activeTextInput.x * zoom + panOffset.x,
                zIndex: 50,
              }}
            >
              <input
                type="text"
                value={activeTextInput.text}
                onChange={(e) => setActiveTextInput({ ...activeTextInput, text: e.target.value })}
                onBlur={handleTextSubmit}
                placeholder="Type & press Enter…"
                autoFocus
                className="px-2.5 py-1 bg-white border-2 border-indigo-500 rounded-lg shadow-lg text-xs font-semibold outline-none text-neutral-900 min-w-[180px]"
              />
            </form>
          )}

          {/* Bottom Zoom & Undo Controls */}
          <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-md rounded-xl p-1.5 flex items-center gap-2 text-xs font-bold">
            <button onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 text-center text-neutral-800">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.1).toFixed(2)))} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-neutral-200 mx-0.5" />
            <button onClick={handleUndo} disabled={historyStep <= 0} className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer">
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer">
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scroll Back to Content Button */}
          {(panOffset.x !== 0 || panOffset.y !== 0 || zoom !== 1.0) && (
            <button
              onClick={() => { setPanOffset({ x: 0, y: 0 }); setZoom(1.0); }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-white/95 border border-neutral-250 shadow-md rounded-full text-xs font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
            >
              Scroll back to content
            </button>
          )}

          {/* HTML5 Canvas Element */}
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
