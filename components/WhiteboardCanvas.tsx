'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun, 
  Maximize2, Minimize2, Check, PanelLeftOpen, Hand, MousePointer, 
  Minus, Lock, Unlock, Square, Circle, ArrowRight, Type, Eraser, 
  Undo, Redo, Sparkles, Copy, Layers, Move
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

interface WhiteboardCanvasProps {
  activeTheme?: string;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

// Color Palettes matching Excalidraw UI
const STROKE_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#6741d9'];
const BG_COLORS = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99', '#eebefa'];

type ToolType = 'select' | 'pan' | 'pencil' | 'rect' | 'diamond' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser';

type ResizeHandleType = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'w' | 'e';

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
  opacity: number;
}

const DEFAULT_DOC: WhiteboardCanvasDoc = {
  id: 'doc-default',
  title: 'Canvas Note 1',
  elementsData: [],
  appStateData: { theme: 'light' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Helper: Calculate bounding box of any element
const getElementBounds = (elem: CanvasElement) => {
  if ((elem.type === 'pencil' || elem.type === 'eraser') && elem.points && elem.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elem.points.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
    const pad = elem.strokeWidth * 2;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, width: Math.max(10, maxX - minX + pad * 2), height: Math.max(10, maxY - minY + pad * 2) };
  }
  if (elem.type === 'text' && elem.x != null && elem.y != null) {
    const textLen = (elem.text || '').length * 10;
    return { minX: elem.x, minY: elem.y, maxX: elem.x + Math.max(40, textLen), maxY: elem.y + 26, width: Math.max(40, textLen), height: 26 };
  }
  if (elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
    const x1 = Math.min(elem.x, elem.x + elem.width);
    const x2 = Math.max(elem.x, elem.x + elem.width);
    const y1 = Math.min(elem.y, elem.y + elem.height);
    const y2 = Math.max(elem.y, elem.y + elem.height);
    return { minX: x1, minY: y1, maxX: x2, maxY: y2, width: Math.max(10, x2 - x1), height: Math.max(10, y2 - y1) };
  }
  return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
};

// Helper: Combined bounding box of multiple selected elements
const getCombinedBounds = (elems: CanvasElement[]) => {
  if (elems.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elems.forEach((el) => {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

// Helper: Check if point (px, py) is inside element bounds
const isPointInElement = (px: number, py: number, elem: CanvasElement) => {
  const b = getElementBounds(elem);
  return px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY;
};

// Helper: Check if two bounding boxes overlap
const isBoundsOverlapping = (b1: ReturnType<typeof getElementBounds>, b2: { minX: number; minY: number; maxX: number; maxY: number }) => {
  return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
};

export default function WhiteboardCanvas({ 
  activeTheme = 'orange', 
  isSidebarOpen = true, 
  onOpenSidebar 
}: WhiteboardCanvasProps) {
  // Document Multi-Tab Management
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Active Tool & Style Inspector Properties
  const [tool, setTool] = useState<ToolType>('pencil');
  const [strokeColor, setStrokeColor] = useState('#1e1e1e');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [opacity, setOpacity] = useState(100);

  // Infinite View Transform State
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Document Elements & History State
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);

  // Selection & Lasso Drag State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Text Tool Overlay State
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // DUAL CANVAS REFS (Layer 1: Static Background, Layer 2: Interactive Foreground)
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interactive Live Action Mutable Refs
  const isDrawingRef = useRef(false);
  const isDraggingSelectedRef = useRef(false);
  const isResizingRef = useRef(false);
  const resizeHandleRef = useRef<ResizeHandleType | null>(null);
  const isBoxSelectingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  const dragStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragElementsStartRef = useRef<CanvasElement[]>([]);
  const resizeInitialBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }>({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  // Synchronize Canvas Dimensions to Container Bounding Box
  const syncCanvasDimensions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    if (w > 0 && h > 0) {
      if (bgCanvasRef.current && (bgCanvasRef.current.width !== w || bgCanvasRef.current.height !== h)) {
        bgCanvasRef.current.width = w;
        bgCanvasRef.current.height = h;
      }
      if (fgCanvasRef.current && (fgCanvasRef.current.width !== w || fgCanvasRef.current.height !== h)) {
        fgCanvasRef.current.width = w;
        fgCanvasRef.current.height = h;
      }
    }
  }, []);

  // Native Non-Passive Wheel Event Listener (FIXES PAGE ZOOMING 100%)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Prevent native browser page zoom completely on Ctrl+Wheel or Pinch
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

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // 1. Load saved canvas tabs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nidus_whiteboard_docs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocs(parsed);
          setActiveDocId(parsed[0].id);
          const loadedElems = parsed[0].elementsData || [];
          setElements(loadedElems);
          setHistory([loadedElems]);
          return;
        }
      }
    } catch (e) {}
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // 2. Switch Active Document Tab & sync elements
  useEffect(() => {
    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      const loaded = doc.elementsData || [];
      setElements(loaded);
      setHistory([loaded]);
      setHistoryStep(0);
      setSelectedIds([]);
    }
  }, [activeDocId]);

  // 3. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return;

      if (e.code === 'Space' && !spaceHeld) {
        e.preventDefault();
        setSpaceHeld(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
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
  }, [spaceHeld, selectedIds, elements]);

  // LocalStorage persistence helpers
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs));
    } catch (e) {}
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

  // Document Tab Actions
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
    if (!renameTitle.trim()) {
      setIsRenaming(false);
      return;
    }
    saveDocsToStorage(docs.map((d) =>
      d.id === activeDocId ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() } : d
    ));
    setIsRenaming(false);
  };

  // Undo / Redo
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

  // Delete Selected Elements
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const updated = elements.filter((e) => !selectedIds.includes(e.id));
    pushHistory(updated);
    setSelectedIds([]);
  };

  // Duplicate Selected Elements
  const handleDuplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const duplicated: CanvasElement[] = [];
    const newSelectedIds: string[] = [];

    elements.forEach((elem) => {
      if (selectedIds.includes(elem.id)) {
        const newId = 'e-' + Date.now() + Math.random().toString(36).substr(2, 4);
        newSelectedIds.push(newId);
        if (elem.points) {
          duplicated.push({
            ...elem,
            id: newId,
            points: elem.points.map((pt) => ({ x: pt.x + 20, y: pt.y + 20 })),
          });
        } else {
          duplicated.push({
            ...elem,
            id: newId,
            x: (elem.x ?? 0) + 20,
            y: (elem.y ?? 0) + 20,
          });
        }
      }
    });

    pushHistory([...elements, ...duplicated]);
    setSelectedIds(newSelectedIds);
  };

  // Convert Screen Mouse Coordinates to World Infinite Canvas Coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    syncCanvasDimensions();
    const canvas = fgCanvasRef.current || bgCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [panOffset, zoom, syncCanvasDimensions]);

  // Check if click position hit one of the 8 resize handle zones
  const getHitResizeHandle = (worldX: number, worldY: number, bounds: ReturnType<typeof getCombinedBounds>): ResizeHandleType | null => {
    const handleSize = 10 / zoom;
    const handles: { type: ResizeHandleType; x: number; y: number }[] = [
      { type: 'nw', x: bounds.minX, y: bounds.minY },
      { type: 'ne', x: bounds.maxX, y: bounds.minY },
      { type: 'se', x: bounds.maxX, y: bounds.maxY },
      { type: 'sw', x: bounds.minX, y: bounds.maxY },
      { type: 'n', x: bounds.minX + bounds.width / 2, y: bounds.minY },
      { type: 's', x: bounds.minX + bounds.width / 2, y: bounds.maxY },
      { type: 'w', x: bounds.minX, y: bounds.minY + bounds.height / 2 },
      { type: 'e', x: bounds.maxX, y: bounds.minY + bounds.height / 2 },
    ];

    for (let h of handles) {
      if (Math.abs(worldX - h.x) <= handleSize && Math.abs(worldY - h.y) <= handleSize) {
        return h.type;
      }
    }
    return null;
  };

  // Smooth Vector Curve Interpolation
  const drawSmoothPath = (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }
    ctx.stroke();
  };

  // ---------- LAYER 1: STATIC BACKGROUND CANVAS RENDERER ----------
  const renderBackgroundLayer = useCallback(() => {
    syncCanvasDimensions();
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    const safeZoom = Math.max(0.1, zoom);
    ctx.scale(safeZoom, safeZoom);

    // Excalidraw Dots Grid
    ctx.fillStyle = canvasTheme === 'dark' ? '#2e2e2e' : '#e2e8f0';
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

    // Render Saved Elements
    elements.forEach((elem) => {
      const isSelected = selectedIds.includes(elem.id);
      ctx.globalAlpha = (elem.opacity ?? 100) / 100;
      ctx.strokeStyle = elem.strokeColor;
      ctx.lineWidth = elem.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (elem.strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (elem.strokeStyle === 'dotted') ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);

      if (elem.type === 'pencil' || elem.type === 'eraser') {
        if (elem.type === 'eraser') {
          ctx.strokeStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
          ctx.lineWidth = elem.strokeWidth * 4;
        }
        drawSmoothPath(ctx, elem.points || []);
      } else if (elem.type === 'rect' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
        if (elem.bgColor !== 'transparent') {
          ctx.fillStyle = elem.bgColor;
          ctx.fillRect(elem.x, elem.y, elem.width, elem.height);
        }
        ctx.strokeRect(elem.x, elem.y, elem.width, elem.height);
      } else if (elem.type === 'diamond' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
        const cx = elem.x + elem.width / 2;
        const cy = elem.y + elem.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx, elem.y);
        ctx.lineTo(elem.x + elem.width, cy);
        ctx.lineTo(cx, elem.y + elem.height);
        ctx.lineTo(elem.x, cy);
        ctx.closePath();
        if (elem.bgColor !== 'transparent') {
          ctx.fillStyle = elem.bgColor;
          ctx.fill();
        }
        ctx.stroke();
      } else if (elem.type === 'circle' && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
        const cx = elem.x + elem.width / 2;
        const cy = elem.y + elem.height / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(elem.width / 2), Math.abs(elem.height / 2), 0, 0, Math.PI * 2);
        if (elem.bgColor !== 'transparent') {
          ctx.fillStyle = elem.bgColor;
          ctx.fill();
        }
        ctx.stroke();
      } else if ((elem.type === 'arrow' || elem.type === 'line') && elem.x != null && elem.y != null && elem.width != null && elem.height != null) {
        const toX = elem.x + elem.width;
        const toY = elem.y + elem.height;
        ctx.beginPath();
        ctx.moveTo(elem.x, elem.y);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        if (elem.type === 'arrow') {
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
      } else if (elem.type === 'text' && elem.x != null && elem.y != null && elem.text) {
        ctx.fillStyle = elem.strokeColor;
        ctx.font = '600 16px "Segoe UI", Inter, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(elem.text, elem.x, elem.y);
      }

      ctx.globalAlpha = 1;
    });

    // Draw Selection Bounding Box & 8 Resize Handles for Selected Elements
    if (selectedIds.length > 0) {
      const selectedElems = elements.filter((el) => selectedIds.includes(el.id));
      const b = getCombinedBounds(selectedElems);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1.5 / safeZoom;
      ctx.strokeRect(b.minX - 4, b.minY - 4, b.width + 8, b.height + 8);

      // 8 Resize Handles (NW, NE, SE, SW, N, S, W, E)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#4f46e5';
      ctx.setLineDash([]);
      const hs = 7 / safeZoom;

      const handles = [
        { x: b.minX - 4, y: b.minY - 4 },
        { x: b.maxX + 4, y: b.minY - 4 },
        { x: b.maxX + 4, y: b.maxY + 4 },
        { x: b.minX - 4, y: b.maxY + 4 },
        { x: b.minX + b.width / 2, y: b.minY - 4 },
        { x: b.minX + b.width / 2, y: b.maxY + 4 },
        { x: b.minX - 4, y: b.minY + b.height / 2 },
        { x: b.maxX + 4, y: b.minY + b.height / 2 },
      ];

      handles.forEach((h) => {
        ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      });
    }

    ctx.restore();
  }, [elements, canvasTheme, panOffset, zoom, selectedIds, syncCanvasDimensions]);

  // Trigger Background Render when elements/pan/zoom/selection changes
  useEffect(() => {
    renderBackgroundLayer();
  }, [renderBackgroundLayer]);

  // ---------- LAYER 2: INTERACTIVE FOREGROUND CANVAS RENDERER ----------
  const renderForegroundLayer = useCallback(() => {
    syncCanvasDimensions();
    const canvas = fgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    const safeZoom = Math.max(0.1, zoom);
    ctx.scale(safeZoom, safeZoom);

    // 1. Render Active Live Drawing Stroke
    if (isDrawingRef.current && currentPathRef.current.length > 0 && startPosRef.current) {
      ctx.globalAlpha = opacity / 100;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (strokeStyle === 'dashed') ctx.setLineDash([8, 8]);
      else if (strokeStyle === 'dotted') ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);

      const pts = currentPathRef.current;
      const start = startPosRef.current;
      const last = pts[pts.length - 1];

      if (tool === 'pencil' || tool === 'eraser') {
        if (tool === 'eraser') {
          ctx.strokeStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
          ctx.lineWidth = strokeWidth * 4;
        }
        drawSmoothPath(ctx, pts);
      } else {
        const w = last.x - start.x;
        const h = last.y - start.y;
        if (tool === 'rect') {
          if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(start.x, start.y, w, h);
          }
          ctx.strokeRect(start.x, start.y, w, h);
        } else if (tool === 'diamond') {
          const cx = start.x + w / 2;
          const cy = start.y + h / 2;
          ctx.beginPath();
          ctx.moveTo(cx, start.y);
          ctx.lineTo(start.x + w, cy);
          ctx.lineTo(cx, start.y + h);
          ctx.lineTo(start.x, cy);
          ctx.closePath();
          if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fill();
          }
          ctx.stroke();
        } else if (tool === 'circle') {
          const cx = start.x + w / 2;
          const cy = start.y + h / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          if (bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fill();
          }
          ctx.stroke();
        } else if (tool === 'arrow' || tool === 'line') {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();

          if (tool === 'arrow') {
            const angle = Math.atan2(h, w);
            const hl = Math.max(12, strokeWidth * 3);
            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(last.x - hl * Math.cos(angle - Math.PI / 6), last.y - hl * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(last.x - hl * Math.cos(angle + Math.PI / 6), last.y - hl * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // 2. Render Box Selection Lasso Overlay
    if (isBoxSelectingRef.current && startPosRef.current && currentPathRef.current.length > 0) {
      const start = startPosRef.current;
      const last = currentPathRef.current[currentPathRef.current.length - 1];
      const bx = Math.min(start.x, last.x);
      const by = Math.min(start.y, last.y);
      const bw = Math.abs(last.x - start.x);
      const bh = Math.abs(last.y - start.y);

      ctx.fillStyle = 'rgba(79, 70, 229, 0.08)';
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1 / safeZoom;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }, [canvasTheme, opacity, panOffset, strokeColor, strokeStyle, strokeWidth, tool, zoom, bgColor, syncCanvasDimensions]);

  const requestFgRender = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(renderForegroundLayer);
  }, [renderForegroundLayer]);

  // ---------- MOUSE INTERACTION HANDLERS ----------
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Pan View
    if (e.button === 1 || tool === 'pan' || spaceHeld) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { ...panOffset };
      return;
    }

    // Text Tool Overlay Trigger
    if (tool === 'text') {
      setActiveTextInput({ x, y, text: '' });
      return;
    }

    // Selection & Drag/Resize Handling
    if (tool === 'select') {
      const selectedElems = elements.filter((el) => selectedIds.includes(el.id));
      const bounds = getCombinedBounds(selectedElems);

      // Check if user clicked a RESIZE HANDLE first!
      if (selectedIds.length > 0) {
        const handle = getHitResizeHandle(x, y, bounds);
        if (handle) {
          isResizingRef.current = true;
          resizeHandleRef.current = handle;
          dragStartWorldRef.current = { x, y };
          resizeInitialBoundsRef.current = bounds;
          dragElementsStartRef.current = JSON.parse(JSON.stringify(selectedElems));
          return;
        }
      }

      // Check if clicking inside an element
      const clickedElem = [...elements].reverse().find((el) => isPointInElement(x, y, el));

      if (clickedElem) {
        let newSelected = selectedIds;
        if (!e.shiftKey && !selectedIds.includes(clickedElem.id)) {
          newSelected = [clickedElem.id];
          setSelectedIds(newSelected);
        } else if (e.shiftKey) {
          newSelected = selectedIds.includes(clickedElem.id)
            ? selectedIds.filter((id) => id !== clickedElem.id)
            : [...selectedIds, clickedElem.id];
          setSelectedIds(newSelected);
        }

        isDraggingSelectedRef.current = true;
        dragStartWorldRef.current = { x, y };
        dragElementsStartRef.current = JSON.parse(JSON.stringify(elements.filter((el) => newSelected.includes(el.id))));
      } else {
        // Clicked empty space: start Lasso Box Selection
        if (!e.shiftKey) setSelectedIds([]);
        isBoxSelectingRef.current = true;
        startPosRef.current = { x, y };
        currentPathRef.current = [{ x, y }];
      }
      requestFgRender();
      return;
    }

    // Shape / Freehand Drawing Trigger
    isDrawingRef.current = true;
    startPosRef.current = { x, y };
    currentPathRef.current = [{ x, y }];
    requestFgRender();
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

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // 1. RESIZE SELECTED ELEMENTS
    if (isResizingRef.current && resizeHandleRef.current && selectedIds.length > 0) {
      const handle = resizeHandleRef.current;
      const dx = x - dragStartWorldRef.current.x;
      const dy = y - dragStartWorldRef.current.y;
      const initBounds = resizeInitialBoundsRef.current;

      const updated = elements.map((elem) => {
        if (!selectedIds.includes(elem.id)) return elem;
        const orig = dragElementsStartRef.current.find((el) => el.id === elem.id);
        if (!orig) return elem;

        // Resize Freehand Strokes (Pencil/Eraser) proportionally
        if (orig.points && orig.points.length > 0) {
          let scaleX = 1, scaleY = 1;
          if (initBounds.width > 0) {
            if (handle.includes('e')) scaleX = (initBounds.width + dx) / initBounds.width;
            if (handle.includes('w')) scaleX = (initBounds.width - dx) / initBounds.width;
          }
          if (initBounds.height > 0) {
            if (handle.includes('s')) scaleY = (initBounds.height + dy) / initBounds.height;
            if (handle.includes('n')) scaleY = (initBounds.height - dy) / initBounds.height;
          }

          return {
            ...orig,
            points: orig.points.map((pt) => ({
              x: initBounds.minX + (pt.x - initBounds.minX) * Math.max(0.1, scaleX),
              y: initBounds.minY + (pt.y - initBounds.minY) * Math.max(0.1, scaleY),
            })),
          };
        }

        // Resize Geometric Shapes & Text
        let newX = orig.x ?? 0;
        let newY = orig.y ?? 0;
        let newW = orig.width ?? 40;
        let newH = orig.height ?? 40;

        if (handle.includes('e')) newW = Math.max(10, (orig.width ?? 40) + dx);
        if (handle.includes('s')) newH = Math.max(10, (orig.height ?? 40) + dy);
        if (handle.includes('w')) {
          newW = Math.max(10, (orig.width ?? 40) - dx);
          newX = (orig.x ?? 0) + dx;
        }
        if (handle.includes('n')) {
          newH = Math.max(10, (orig.height ?? 40) - dy);
          newY = (orig.y ?? 0) + dy;
        }

        return {
          ...orig,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
      });

      setElements(updated);
      return;
    }

    // 2. DRAG & DROP SELECTED ELEMENTS
    if (isDraggingSelectedRef.current) {
      const dx = x - dragStartWorldRef.current.x;
      const dy = y - dragStartWorldRef.current.y;

      const updated = elements.map((elem) => {
        const orig = dragElementsStartRef.current.find((el) => el.id === elem.id);
        if (!orig) return elem;

        if (orig.points) {
          return {
            ...orig,
            points: orig.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
          };
        }
        return {
          ...orig,
          x: (orig.x ?? 0) + dx,
          y: (orig.y ?? 0) + dy,
        };
      });

      setElements(updated);
      return;
    }

    // 3. LASSO BOX SELECTION DRAG
    if (isBoxSelectingRef.current) {
      currentPathRef.current = [{ x, y }];
      requestFgRender();
      return;
    }

    // 4. ACTIVE STROKE/SHAPE DRAWING DRAG
    if (!isDrawingRef.current) return;
    const pts = currentPathRef.current;

    // Distance filter for liquid-smooth strokes (>2.5px)
    if (pts.length > 0) {
      const lastPt = pts[pts.length - 1];
      const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
      if (dist > 2.5) {
        pts.push({ x, y });
        requestFgRender();
      }
    } else {
      pts.push({ x, y });
      requestFgRender();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Complete Resizing
    if (isResizingRef.current) {
      isResizingRef.current = false;
      resizeHandleRef.current = null;
      pushHistory(elements);
      return;
    }

    // Complete Drag & Drop
    if (isDraggingSelectedRef.current) {
      isDraggingSelectedRef.current = false;
      pushHistory(elements);
      return;
    }

    // Complete Lasso Box Selection
    if (isBoxSelectingRef.current) {
      isBoxSelectingRef.current = false;
      const start = startPosRef.current;
      const pts = currentPathRef.current;
      if (start && pts.length > 0) {
        const last = pts[pts.length - 1];
        const bx = Math.min(start.x, last.x);
        const by = Math.min(start.y, last.y);
        const bw = Math.abs(last.x - start.x);
        const bh = Math.abs(last.y - start.y);
        const selBounds = { minX: bx, minY: by, maxX: bx + bw, maxY: by + bh };

        const newlySelected = elements
          .filter((el) => isBoundsOverlapping(getElementBounds(el), selBounds))
          .map((el) => el.id);

        setSelectedIds(newlySelected);
      }
      currentPathRef.current = [];
      startPosRef.current = null;
      if (fgCanvasRef.current) {
        const ctx = fgCanvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, fgCanvasRef.current.width, fgCanvasRef.current.height);
      }
      return;
    }

    // Complete Drawing Stroke/Shape
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

    if (fgCanvasRef.current) {
      const ctx = fgCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, fgCanvasRef.current.width, fgCanvasRef.current.height);
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
        opacity,
      };
      pushHistory([...elements, newElem]);
    }
    setActiveTextInput(null);
  };

  const handleExportPNG = () => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const link = document.createElement('a');
    link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-canvas.png`;
    link.href = bgCanvas.toDataURL('image/png');
    link.click();
  };

  // Sync stroke color on dark theme toggle
  useEffect(() => {
    if (canvasTheme === 'dark' && strokeColor === '#1e1e1e') setStrokeColor('#ffffff');
    else if (canvasTheme === 'light' && strokeColor === '#ffffff') setStrokeColor('#1e1e1e');
  }, [canvasTheme]);

  const cursorStyle = tool === 'pan' || spaceHeld || isPanning ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  const TOOLS: { id: ToolType; label: string; icon: any }[] = [
    { id: 'select', label: 'Selection / Move (Box / Drag)', icon: MousePointer },
    { id: 'pan', label: 'Hand (Pan)', icon: Hand },
    { id: 'rect', label: 'Rectangle', icon: Square },
    { id: 'diamond', label: 'Diamond', icon: Sparkles },
    { id: 'circle', label: 'Ellipse', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: ArrowRight },
    { id: 'line', label: 'Line', icon: Minus },
    { id: 'pencil', label: 'Draw / Scribble', icon: PenTool },
    { id: 'text', label: 'Text Box (Click to type)', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
  ];

  // Calculate screen position for floating selection dock above selected elements
  const selectedElems = elements.filter((el) => selectedIds.includes(el.id));
  const selBounds = getCombinedBounds(selectedElems);
  const selectionScreenX = (selBounds.minX + selBounds.width / 2) * zoom + panOffset.x;
  const selectionScreenY = selBounds.minY * zoom + panOffset.y - 42;

  return (
    <div className={`w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Top Navigation & Multi-Tab Header Bar */}
      <div className="h-10 px-3 bg-white/95 border-b border-neutral-200 flex items-center justify-between shrink-0 text-xs z-30">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer shrink-0 mr-1"
              title="Open Navigation Sidebar"
            >
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
                {doc.id === activeDocId && docs.length > 1 && (
                  <span onClick={(e) => handleDeleteDoc(doc.id, e)} className="p-0.5 hover:text-red-600 rounded text-neutral-400 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button onClick={handleCreateDoc} className="p-1 hover:bg-neutral-100 text-neutral-500 rounded-md cursor-pointer shrink-0" title="New Canvas Note">
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
              <button type="submit" className="p-1 bg-neutral-900 text-white rounded cursor-pointer">
                <Check className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setRenameTitle(activeDoc.title); setIsRenaming(true); }}
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
            onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
            title="Toggle Full Screen"
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Workspace */}
      <div className="flex-1 w-full h-full relative overflow-hidden flex">
        
        {/* Left Style Inspector Properties Panel */}
        <div className="w-52 bg-white/95 border-r border-neutral-200 p-3 flex flex-col gap-3.5 text-xs select-none shadow-2xs z-20 overflow-y-auto shrink-0">
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
                <button
                  key={s.w}
                  onClick={() => setStrokeWidth(s.w)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                    strokeWidth === s.w ? 'bg-white shadow-2xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke style</span>
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
              {[{ s: 'solid', l: 'Solid' }, { s: 'dashed', l: 'Dashed' }, { s: 'dotted', l: 'Dotted' }].map((s) => (
                <button
                  key={s.s}
                  onClick={() => setStrokeStyle(s.s as any)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                    strokeStyle === s.s ? 'bg-white shadow-2xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
              <span>Opacity</span>
              <span className="text-neutral-800">{opacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Selection Actions Panel */}
          {selectedIds.length > 0 && (
            <div className="pt-2 border-t border-neutral-200 mt-1 flex flex-col gap-2">
              <span className="font-bold text-[11px] text-indigo-600 uppercase tracking-wider block">
                Selected ({selectedIds.length})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDeleteSelected}
                  className="flex-1 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-all"
                  title="Delete Selected Elements (Delete key)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={handleDuplicateSelected}
                  className="p-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded-md font-semibold cursor-pointer transition-all"
                  title="Duplicate Selected"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dual Canvas Display Container */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          
          {/* Top Excalidraw Floating Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-md rounded-2xl px-2 py-1.5 flex items-center gap-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    tool === t.id ? 'bg-indigo-600 text-white shadow-2xs font-bold' : 'text-neutral-700 hover:bg-neutral-100'
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
                placeholder="Type note & press Enter…"
                autoFocus
                className="px-2.5 py-1 bg-white border-2 border-indigo-500 rounded-lg shadow-lg text-xs font-semibold outline-none text-neutral-900 min-w-[180px]"
              />
            </form>
          )}

          {/* Floating Selection Dock Floating DIRECTLY ABOVE Selected Element(s) */}
          {selectedIds.length > 0 && selectedElems.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: `${Math.max(52, selectionScreenY)}px`,
                left: `${selectionScreenX}px`,
                transform: 'translateX(-50%)',
                zIndex: 40,
              }}
              className="bg-white/95 backdrop-blur-md border border-neutral-300 shadow-lg rounded-full px-3 py-1 flex items-center gap-2 text-xs font-bold animate-fade-in shrink-0"
            >
              <span className="text-neutral-600 text-[11px] font-semibold">{selectedIds.length} selected</span>
              <div className="h-3.5 w-px bg-neutral-250" />
              <button
                onClick={handleDuplicateSelected}
                className="p-1 hover:bg-neutral-100 text-neutral-700 rounded-full cursor-pointer transition-colors"
                title="Duplicate Element"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-1 hover:bg-red-50 text-red-600 rounded-full cursor-pointer transition-colors"
                title="Delete Element (Delete key)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom-Left Zoom & Undo Bar */}
          <div className="absolute bottom-4 left-4 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-md rounded-xl p-1.5 flex items-center gap-2 text-xs font-bold select-none">
            <button
              onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-12 text-center text-neutral-800">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3.0, +(z + 0.1).toFixed(2)))}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-700 cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-neutral-200 mx-0.5" />

            <button
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer"
              title="Undo"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="p-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 rounded-lg cursor-pointer"
              title="Redo"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scroll Back to Content Button */}
          {(panOffset.x !== 0 || panOffset.y !== 0 || zoom !== 1.0) && (
            <button
              onClick={() => { setPanOffset({ x: 0, y: 0 }); setZoom(1.0); }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-white/95 border border-neutral-250 shadow-md rounded-full text-xs font-bold text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-all"
            >
              Scroll back to content
            </button>
          )}

          {/* DUAL CANVAS LAYERS */}
          {/* Layer 1: Static Background Layer (Committed elements) */}
          <canvas
            ref={bgCanvasRef}
            className="w-full h-full block absolute inset-0 z-0 pointer-events-none"
          />

          {/* Layer 2: Interactive Foreground Layer (Live drawing & mouse events) */}
          <canvas
            ref={fgCanvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full block absolute inset-0 z-10"
            style={{ cursor: cursorStyle }}
          />
        </div>
      </div>
    </div>
  );
}
