'use client';

import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import rough from 'roughjs';
import { 
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun, 
  RotateCcw, Check, Maximize2, Minimize2, Circle, Square, 
  ArrowRight, Type, Eraser, Undo, Redo, Palette, Sparkles, Layers,
  PanelLeftOpen, Hand, MousePointer, Minus, Lock, Unlock, Menu,
  Move, ZoomIn, ZoomOut, Eye, ArrowUp, ArrowDown, ChevronRight
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

interface WhiteboardCanvasProps {
  activeTheme?: string;
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

// React Error Boundary for client safety (logs error without breaking UI layout)
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn('Canvas Engine caught exception:', err);
  }
  render() {
    return this.props.children;
  }
}

// Helper to safely get Rough.js canvas instance across ES Module and CJS module interops
const getRoughCanvas = (canvas: HTMLCanvasElement) => {
  try {
    if (typeof rough === 'function') {
      return (rough as any)(canvas);
    }
    if (rough && typeof (rough as any).canvas === 'function') {
      return (rough as any).canvas(canvas);
    }
    if (rough && (rough as any).default && typeof (rough as any).default.canvas === 'function') {
      return (rough as any).default.canvas(canvas);
    }
    if (rough && typeof (rough as any).default === 'function') {
      return (rough as any).default(canvas);
    }
  } catch (e) {
    console.warn('Rough.js instance init fallback:', e);
  }
  return null;
};

// Palette presets matching Excalidraw screenshot 2
const STROKE_COLORS = ['#000000', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#121212'];
const BG_COLORS = ['transparent', '#ffec99', '#b2f2bb', '#a5d8ff', '#ffc9c9', '#eebefa'];

interface CanvasElement {
  id: string;
  type: 'select' | 'pan' | 'pencil' | 'rect' | 'diamond' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor: string;
  bgColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  cornerRadius: boolean;
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
  onOpenSidebar 
}: WhiteboardCanvasProps) {
  // Excalidraw Client Component state
  const [ExcalidrawModule, setExcalidrawModule] = useState<any>(null);
  const [excalidrawLoadFailed, setExcalidrawLoadFailed] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  // Canvas Engine state
  const [docs, setDocs] = useState<WhiteboardCanvasDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Excalidraw Toolbar State (matching Screenshot 1 & 2)
  const [tool, setTool] = useState<CanvasElement['type']>('select');
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [roughness, setRoughness] = useState(1);
  const [cornerRadius, setCornerRadius] = useState(true);
  const [opacity, setOpacity] = useState(100);

  // Infinite Canvas Pan & Zoom State
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawing elements
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  // Text Tool Overlay
  const [activeTextInput, setActiveTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Try dynamic client import of real Excalidraw package
  useEffect(() => {
    let isMounted = true;
    import('@excalidraw/excalidraw')
      .then((mod) => {
        if (isMounted && mod && mod.Excalidraw) {
          setExcalidrawModule(() => mod.Excalidraw);
        }
      })
      .catch((err) => {
        console.warn('Excalidraw client load notice:', err);
        if (isMounted) setExcalidrawLoadFailed(true);
      });
    return () => { isMounted = false; };
  }, []);

  // Sync canvas stroke color on theme toggle
  useEffect(() => {
    if (canvasTheme === 'dark' && strokeColor === '#000000') {
      setStrokeColor('#ffffff');
    } else if (canvasTheme === 'light' && strokeColor === '#ffffff') {
      setStrokeColor('#000000');
    }
  }, [canvasTheme]);

  // Load docs from localStorage
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem('nidus_whiteboard_docs');
      if (savedDocs) {
        const parsed = JSON.parse(savedDocs);
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

  // Active doc change
  useEffect(() => {
    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      const loaded = doc.elementsData || [];
      setElements(loaded);
      setHistory([loaded]);
      setHistoryStep(0);
    }
  }, [activeDocId]);

  // Save docs to storage
  const saveDocsToStorage = (updatedDocs: WhiteboardCanvasDoc[]) => {
    setDocs(updatedDocs);
    try {
      localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updatedDocs));
    } catch (e) {}
  };

  const activeDoc = docs.find((d) => d.id === activeDocId) || docs[0] || DEFAULT_DOC;

  const updateCurrentDocElements = (newElements: CanvasElement[]) => {
    setElements(newElements);
    const updated = docs.map((d) =>
      d.id === activeDocId ? { ...d, elementsData: newElements, updated_at: new Date().toISOString() } : d
    );
    saveDocsToStorage(updated);
  };

  const pushHistory = (newElements: CanvasElement[]) => {
    const newHist = history.slice(0, historyStep + 1);
    newHist.push(newElements);
    setHistory(newHist);
    setHistoryStep(newHist.length - 1);
    updateCurrentDocElements(newElements);
  };

  // Document Management Handlers
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
    const updated = docs.map((d) =>
      d.id === activeDocId ? { ...d, title: renameTitle.trim(), updated_at: new Date().toISOString() } : d
    );
    saveDocsToStorage(updated);
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

  // Reset View / Scroll Back to Content
  const handleScrollBackToContent = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1.0);
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((prev) => Math.min(3.0, Math.max(0.1, +(prev + zoomDelta).toFixed(2))));
    } else {
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Canvas Hand-Drawn Rendering Effect
  useEffect(() => {
    let animId: number;

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Canvas size matching container bounds
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
          canvas.width = Math.floor(rect.width);
          canvas.height = Math.floor(rect.height);
        }
      }

      // Safely get Rough.js instance with fallbacks
      const rc = getRoughCanvas(canvas);

      // Clear background
      ctx.fillStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save context transform state for Infinite Pan & Zoom
      const safeZoom = Math.max(0.1, zoom);
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(safeZoom, safeZoom);

      // Draw Excalidraw Dots Grid (safely bounded)
      ctx.fillStyle = canvasTheme === 'dark' ? '#2b2b2b' : '#e0e0e0';
      const gridSize = 24;
      const startX = Math.floor(-panOffset.x / safeZoom / gridSize) * gridSize - gridSize * 2;
      const startY = Math.floor(-panOffset.y / safeZoom / gridSize) * gridSize - gridSize * 2;
      const canvasW = canvas.width || 800;
      const canvasH = canvas.height || 600;
      const endX = Math.min(startX + 3000, startX + Math.ceil(canvasW / safeZoom) + gridSize * 4);
      const endY = Math.min(startY + 3000, startY + Math.ceil(canvasH / safeZoom) + gridSize * 4);

      if (gridSize > 0 && endX > startX && endY > startY) {
        for (let x = startX; x < endX; x += gridSize) {
          for (let y = startY; y < endY; y += gridSize) {
            ctx.fillRect(x, y, 1.5, 1.5);
          }
        }
      }

    // Render elements using Rough.js or 2D Context fallback
    elements.forEach((elem) => {
      ctx.globalAlpha = (elem.opacity ?? 100) / 100;

      const roughOptions: any = {
        stroke: elem.strokeColor,
        strokeWidth: elem.strokeWidth,
        roughness: elem.roughness,
        bowing: elem.roughness * 1.5,
        fill: elem.bgColor !== 'transparent' ? elem.bgColor : undefined,
        fillStyle: 'hachure',
        strokeLineDash: elem.strokeStyle === 'dashed' ? [8, 8] : elem.strokeStyle === 'dotted' ? [3, 3] : undefined,
      };

      if (elem.type === 'pencil' && elem.points && elem.points.length > 0) {
        ctx.strokeStyle = elem.strokeColor;
        ctx.lineWidth = elem.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        elem.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (elem.type === 'eraser' && elem.points && elem.points.length > 0) {
        ctx.strokeStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
        ctx.lineWidth = elem.strokeWidth * 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        elem.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (elem.type === 'rect' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        if (rc) {
          rc.rectangle(elem.x, elem.y, elem.width, elem.height, roughOptions);
        } else {
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
          if (elem.bgColor !== 'transparent') {
            ctx.fillStyle = elem.bgColor;
            ctx.fillRect(elem.x, elem.y, elem.width, elem.height);
          }
          ctx.strokeRect(elem.x, elem.y, elem.width, elem.height);
        }
      } else if (elem.type === 'diamond' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        const cx = elem.x + elem.width / 2;
        const cy = elem.y + elem.height / 2;
        const pts: [number, number][] = [
          [cx, elem.y],
          [elem.x + elem.width, cy],
          [cx, elem.y + elem.height],
          [elem.x, cy],
        ];
        if (rc) {
          rc.polygon(pts, roughOptions);
        } else {
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
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
        }
      } else if (elem.type === 'circle' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        const rx = Math.abs(elem.width);
        const ry = Math.abs(elem.height);
        const cx = elem.x + elem.width / 2;
        const cy = elem.y + elem.height / 2;
        if (rc) {
          rc.ellipse(cx, cy, rx, ry, roughOptions);
        } else {
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.abs(elem.width) / 2, Math.abs(elem.height) / 2, 0, 0, 2 * Math.PI);
          if (elem.bgColor !== 'transparent') {
            ctx.fillStyle = elem.bgColor;
            ctx.fill();
          }
          ctx.stroke();
        }
      } else if (elem.type === 'arrow' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        const toX = elem.x + elem.width;
        const toY = elem.y + elem.height;
        if (rc) {
          rc.line(elem.x, elem.y, toX, toY, roughOptions);
        } else {
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
          ctx.beginPath();
          ctx.moveTo(elem.x, elem.y);
          ctx.lineTo(toX, toY);
          ctx.stroke();
        }

        const angle = Math.atan2(elem.height, elem.width);
        const headLen = Math.max(12, elem.strokeWidth * 3.5);
        ctx.fillStyle = elem.strokeColor;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (elem.type === 'line' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        if (rc) {
          rc.line(elem.x, elem.y, elem.x + elem.width, elem.y + elem.height, roughOptions);
        } else {
          ctx.strokeStyle = elem.strokeColor;
          ctx.lineWidth = elem.strokeWidth;
          ctx.beginPath();
          ctx.moveTo(elem.x, elem.y);
          ctx.lineTo(elem.x + elem.width, elem.y + elem.height);
          ctx.stroke();
        }
      } else if (elem.type === 'text' && elem.x !== undefined && elem.y !== undefined && elem.text) {
        ctx.fillStyle = elem.strokeColor;
        ctx.font = '600 16px "Comic Sans MS", "Virgil", Inter, sans-serif';
        ctx.fillText(elem.text, elem.x, elem.y);
      }
    });

    // Render active drawing path preview
    if (isDrawing && currentPath.length > 0) {
      ctx.globalAlpha = opacity / 100;
      const roughOptions: any = {
        stroke: strokeColor,
        strokeWidth,
        roughness,
        fill: bgColor !== 'transparent' ? bgColor : undefined,
        fillStyle: 'hachure',
        strokeLineDash: strokeStyle === 'dashed' ? [8, 8] : strokeStyle === 'dotted' ? [3, 3] : undefined,
      };

      if (tool === 'pencil' || tool === 'eraser') {
        ctx.strokeStyle = tool === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#ffffff') : strokeColor;
        ctx.lineWidth = tool === 'eraser' ? strokeWidth * 4 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (startPos && currentPath.length > 1) {
        const lastPt = currentPath[currentPath.length - 1];
        const w = lastPt.x - startPos.x;
        const h = lastPt.y - startPos.y;

        if (tool === 'rect') {
          if (rc) rc.rectangle(startPos.x, startPos.y, w, h, roughOptions);
          else { ctx.strokeStyle = strokeColor; ctx.strokeRect(startPos.x, startPos.y, w, h); }
        } else if (tool === 'diamond') {
          const cx = startPos.x + w / 2;
          const cy = startPos.y + h / 2;
          if (rc) rc.polygon([[cx, startPos.y], [startPos.x + w, cy], [cx, startPos.y + h], [startPos.x, cy]], roughOptions);
          else {
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(cx, startPos.y); ctx.lineTo(startPos.x + w, cy); ctx.lineTo(cx, startPos.y + h); ctx.lineTo(startPos.x, cy); ctx.closePath();
            ctx.stroke();
          }
        } else if (tool === 'circle') {
          if (rc) rc.ellipse(startPos.x + w / 2, startPos.y + h / 2, Math.abs(w), Math.abs(h), roughOptions);
          else {
            ctx.strokeStyle = strokeColor;
            ctx.beginPath(); ctx.ellipse(startPos.x + w / 2, startPos.y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, 2 * Math.PI); ctx.stroke();
          }
        } else if (tool === 'arrow' || tool === 'line') {
          if (rc) rc.line(startPos.x, startPos.y, lastPt.x, lastPt.y, roughOptions);
        }
      }
    }

    ctx.restore();
    };

    animId = requestAnimationFrame(renderCanvas);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [elements, currentPath, isDrawing, canvasTheme, tool, strokeColor, bgColor, strokeWidth, strokeStyle, roughness, opacity, panOffset, zoom, startPos]);

  // Convert Screen Coordinates to World Infinite Canvas Coordinates
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - panOffset.x) / zoom,
      y: (screenY - panOffset.y) / zoom,
    };
  };

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || tool === 'pan' || (e as any).spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panStart.y });
      return;
    }

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (tool === 'text') {
      setActiveTextInput({ x, y, text: '' });
      if (!isToolLocked) setTool('select');
      return;
    }

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentPath([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    setCurrentPath((prev) => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (startPos && currentPath.length > 0) {
      const lastPt = currentPath[currentPath.length - 1];
      let newElem: CanvasElement | null = null;

      if (tool === 'pencil' || tool === 'eraser') {
        newElem = {
          id: 'elem-' + Date.now(),
          type: tool,
          points: currentPath,
          strokeColor,
          bgColor,
          strokeWidth,
          strokeStyle,
          roughness,
          cornerRadius,
          opacity,
        };
      } else if (tool !== 'select' && tool !== 'pan') {
        const w = lastPt.x - startPos.x;
        const h = lastPt.y - startPos.y;
        newElem = {
          id: 'elem-' + Date.now(),
          type: tool,
          x: startPos.x,
          y: startPos.y,
          width: w,
          height: h,
          strokeColor,
          bgColor,
          strokeWidth,
          strokeStyle,
          roughness,
          cornerRadius,
          opacity,
        };
      }

      if (newElem) {
        pushHistory([...elements, newElem]);
      }
    }

    setCurrentPath([]);
    setStartPos(null);
    if (!isToolLocked && tool !== 'pan' && tool !== 'select') {
      setTool('select');
    }
  };

  // Submit Text Input Element
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTextInput && activeTextInput.text.trim()) {
      const newElem: CanvasElement = {
        id: 'elem-' + Date.now(),
        type: 'text',
        x: activeTextInput.x,
        y: activeTextInput.y,
        text: activeTextInput.text.trim(),
        strokeColor,
        bgColor,
        strokeWidth,
        strokeStyle,
        roughness,
        cornerRadius,
        opacity,
      };
      pushHistory([...elements, newElem]);
    }
    setActiveTextInput(null);
  };

  // Export PNG Image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-excalidraw.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const ExcalidrawComp = ExcalidrawModule;

  return (
    <CanvasErrorBoundary>
      <div className={`w-full h-full flex flex-col bg-[#f8f9fa] text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
        
        {/* Top Navigation & Document Pills Header */}
        <div className="h-10 px-3 bg-white/90 border-b border-border-color flex items-center justify-between shrink-0 text-xs z-30">
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
            
            {/* Left Sidebar Restore Button (Appears if Nidus sidebar is closed) */}
            {!isSidebarOpen && onOpenSidebar && (
              <button
                onClick={onOpenSidebar}
                className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 hover:text-neutral-900 cursor-pointer transition-all-custom shrink-0 mr-1"
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
                    onClick={() => setActiveDocId(doc.id)}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-semibold text-[11px] transition-all-custom cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-900 shadow-2xs border border-neutral-250 font-bold'
                        : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/60'
                    }`}
                  >
                    <span className="max-w-[90px] truncate">{doc.title}</span>
                    {isActive && (
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
                className="p-1 hover:bg-neutral-200/70 text-neutral-500 rounded-md transition-all-custom cursor-pointer shrink-0"
                title="New Whiteboard"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
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
              onClick={handleExportPNG}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
              title="Export Canvas PNG Image"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
              title="Toggle Dark/Light Theme"
            >
              {canvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Whiteboard'}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* If Real Excalidraw Component loaded, render 100% Real Excalidraw */}
        {ExcalidrawComp && !excalidrawLoadFailed ? (
          <div className="flex-1 w-full h-full relative">
            <ExcalidrawComp
              key={`${activeDoc.id}-${canvasTheme}`}
              excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
              initialData={{
                elements: activeDoc.elementsData || [],
                appState: {
                  theme: canvasTheme,
                  viewBackgroundColor: canvasTheme === 'dark' ? '#121212' : '#ffffff',
                },
              }}
              onChange={(elems: readonly any[], appState: any) => {
                const updated = docs.map((d) =>
                  d.id === activeDocId
                    ? { ...d, elementsData: Array.from(elems), updated_at: new Date().toISOString() }
                    : d
                );
                setDocs(updated);
                try {
                  localStorage.setItem('nidus_whiteboard_docs', JSON.stringify(updated));
                } catch (e) {}
              }}
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
        ) : (
          /* Standalone Rough.js Excalidraw Canvas Engine (Matching Screenshots 1 & 2 95%+) */
          <div className="flex-1 w-full h-full relative overflow-hidden flex">
            
            {/* Left Excalidraw Inspector Properties Panel (Matching Screenshot 2) */}
            <div className="w-56 bg-white/95 border-r border-neutral-200 p-3 flex flex-col gap-3.5 text-xs select-none shadow-sm z-30 overflow-y-auto">
              
              {/* Stroke Colors */}
              <div>
                <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke</span>
                <div className="flex items-center gap-1.5">
                  {STROKE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setStrokeColor(c)}
                      className={`w-6 h-6 rounded-md border border-black/10 transition-all ${
                        strokeColor === c ? 'scale-115 ring-2 ring-indigo-500 shadow-xs' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Background Fill Colors */}
              <div>
                <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Background</span>
                <div className="flex items-center gap-1.5">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={`w-6 h-6 rounded-md border border-black/10 transition-all ${
                        bgColor === c ? 'scale-115 ring-2 ring-indigo-500 shadow-xs' : 'hover:scale-105'
                      } ${c === 'transparent' ? 'bg-[radial-gradient(#ccc_1px,transparent_1px)] [background-size:6px_6px]' : ''}`}
                      style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Width */}
              <div>
                <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke width</span>
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                  {[
                    { width: 1, label: 'Thin' },
                    { width: 2, label: 'Medium' },
                    { width: 4, label: 'Thick' },
                  ].map((w) => (
                    <button
                      key={w.width}
                      onClick={() => setStrokeWidth(w.width)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                        strokeWidth === w.width ? 'bg-white shadow-xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke Style */}
              <div>
                <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Stroke style</span>
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                  {[
                    { style: 'solid', label: 'Solid' },
                    { style: 'dashed', label: 'Dashed' },
                    { style: 'dotted', label: 'Dotted' },
                  ].map((s) => (
                    <button
                      key={s.style}
                      onClick={() => setStrokeStyle(s.style as any)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold transition-all capitalize ${
                        strokeStyle === s.style ? 'bg-white shadow-xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sloppiness */}
              <div>
                <span className="font-bold text-[11px] text-neutral-500 uppercase tracking-wider block mb-1.5">Sloppiness</span>
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                  {[
                    { val: 0, label: 'Architect' },
                    { val: 1, label: 'Artist' },
                    { val: 2, label: 'Cartoon' },
                  ].map((r) => (
                    <button
                      key={r.val}
                      onClick={() => setRoughness(r.val)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                        roughness === r.val ? 'bg-white shadow-xs text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
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
            </div>

            {/* Top Excalidraw Floating Toolbar (Matching Screenshot 1) */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-md rounded-2xl px-2 py-1.5 flex items-center gap-1">
              
              {/* Lock tool toggle */}
              <button
                onClick={() => setIsToolLocked(!isToolLocked)}
                className={`p-2 rounded-xl transition-all ${
                  isToolLocked ? 'bg-indigo-100 text-indigo-600' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                title={isToolLocked ? 'Keep tool selected' : 'Lock tool'}
              >
                {isToolLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>

              <div className="h-5 w-[1px] bg-neutral-200 mx-0.5" />

              {/* Main Tools Palette */}
              {[
                { id: 'pan', label: 'Hand (Pan)', icon: Hand },
                { id: 'select', label: 'Selection', icon: MousePointer },
                { id: 'rect', label: 'Rectangle', icon: Square },
                { id: 'diamond', label: 'Diamond', icon: Sparkles },
                { id: 'circle', label: 'Ellipse', icon: Circle },
                { id: 'arrow', label: 'Arrow', icon: ArrowRight },
                { id: 'line', label: 'Line', icon: Minus },
                { id: 'pencil', label: 'Draw / Pencil', icon: PenTool },
                { id: 'text', label: 'Text (Click on canvas to type)', icon: Type },
                { id: 'eraser', label: 'Eraser', icon: Eraser },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id as any)}
                    className={`p-2 rounded-xl transition-all font-semibold flex items-center gap-1 text-xs cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title={t.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            {/* Inline Text Tool Overlay Input */}
            {activeTextInput && (
              <form
                onSubmit={handleTextSubmit}
                style={{
                  position: 'absolute',
                  top: activeTextInput.y * zoom + panOffset.y,
                  left: activeTextInput.x * zoom + panOffset.x,
                  zIndex: 50,
                }}
                className="animate-fade-in"
              >
                <input
                  type="text"
                  value={activeTextInput.text}
                  onChange={(e) => setActiveTextInput({ ...activeTextInput, text: e.target.value })}
                  onBlur={handleTextSubmit}
                  placeholder="Type note & press Enter..."
                  autoFocus
                  className="px-2.5 py-1 bg-white border-2 border-indigo-500 rounded-lg shadow-lg text-xs font-semibold outline-none text-neutral-900 min-w-[180px]"
                />
              </form>
            )}

            {/* Bottom-Left Zoom & Undo Bar (Matching Screenshot 2) */}
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

              <div className="h-4 w-[1px] bg-neutral-200 mx-0.5" />

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

            {/* Bottom Center "Scroll Back to Content" Button (Matching Screenshot 2) */}
            {(panOffset.x !== 0 || panOffset.y !== 0 || zoom !== 1.0) && (
              <button
                onClick={handleScrollBackToContent}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-white/95 border border-neutral-250 shadow-md rounded-full text-xs font-bold text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 cursor-pointer transition-all duration-200"
              >
                Scroll back to content
              </button>
            )}

            {/* Infinite HTML5 Rough.js Canvas Container */}
            <div className="flex-1 w-full h-full relative cursor-crosshair">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="w-full h-full block"
              />
            </div>
          </div>
        )}
      </div>
    </CanvasErrorBoundary>
  );
}
