'use client';

import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  PenTool, Plus, Trash2, Edit2, Download, Moon, Sun, 
  RotateCcw, Check, Maximize2, Minimize2, Circle, Square, 
  ArrowRight, Type, Eraser, Undo, Redo, Palette, Sparkles, Layers
} from 'lucide-react';
import { WhiteboardCanvasDoc } from '../lib/types';

// React Error Boundary to catch any canvas rendering or dynamic bundle failures gracefully
interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Canvas Error Boundary caught an engine exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface WhiteboardCanvasProps {
  activeTheme?: string;
}

// Color options for drawing engine
const PALETTE = [
  '#000000', '#ff6600', '#ef4444', '#10b981', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#ffffff'
];

interface CanvasElement {
  id: string;
  type: 'pencil' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser';
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  size: number;
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

  // Drawing state
  const [tool, setTool] = useState<'pencil' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser'>('pencil');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(3);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  // Text Tool State
  const [textInput, setTextInput] = useState<{ x: number; y: number; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync color when dark mode toggled if default black/white
  useEffect(() => {
    if (canvasTheme === 'dark' && color === '#000000') {
      setColor('#ffffff');
    } else if (canvasTheme === 'light' && color === '#ffffff') {
      setColor('#000000');
    }
  }, [canvasTheme]);

  // Load docs from storage
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
    } catch (e) {
      console.error('Failed to load whiteboard docs:', e);
    }
    setDocs([DEFAULT_DOC]);
    setActiveDocId(DEFAULT_DOC.id);
  }, []);

  // When active doc changes, load elements
  useEffect(() => {
    const doc = docs.find((d) => d.id === activeDocId);
    if (doc) {
      const loadedElems = doc.elementsData || [];
      setElements(loadedElems);
      setHistory([loadedElems]);
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

  // Save elements to current doc
  const updateCurrentDocElements = (newElements: CanvasElement[]) => {
    setElements(newElements);
    const updated = docs.map((d) =>
      d.id === activeDocId ? { ...d, elementsData: newElements, updated_at: new Date().toISOString() } : d
    );
    saveDocsToStorage(updated);
  };

  // Push new history state
  const pushHistory = (newElements: CanvasElement[]) => {
    const newHist = history.slice(0, historyStep + 1);
    newHist.push(newElements);
    setHistory(newHist);
    setHistoryStep(newHist.length - 1);
    updateCurrentDocElements(newElements);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      updateCurrentDocElements(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      updateCurrentDocElements(history[nextStep]);
    }
  };

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
  };

  // Delete document
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

  // Clear Canvas
  const handleClearCanvas = () => {
    pushHistory([]);
  };

  // Render Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas resolution to container
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Clear background
    ctx.fillStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Dots
    ctx.fillStyle = canvasTheme === 'dark' ? '#262626' : '#e5e5e5';
    const gridSize = 24;
    for (let x = 0; x < canvas.width; x += gridSize) {
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // Render elements
    elements.forEach((elem) => {
      ctx.strokeStyle = elem.color;
      ctx.fillStyle = elem.color;
      ctx.lineWidth = elem.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (elem.type === 'pencil' && elem.points && elem.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        elem.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (elem.type === 'eraser' && elem.points && elem.points.length > 0) {
        ctx.strokeStyle = canvasTheme === 'dark' ? '#121212' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(elem.points[0].x, elem.points[0].y);
        elem.points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (elem.type === 'rect' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        ctx.strokeRect(elem.x, elem.y, elem.width, elem.height);
      } else if (elem.type === 'circle' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        ctx.beginPath();
        const rx = Math.abs(elem.width) / 2;
        const ry = Math.abs(elem.height) / 2;
        const cx = elem.x + elem.width / 2;
        const cy = elem.y + elem.height / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (elem.type === 'arrow' && elem.x !== undefined && elem.y !== undefined && elem.width && elem.height) {
        ctx.beginPath();
        ctx.moveTo(elem.x, elem.y);
        const toX = elem.x + elem.width;
        const toY = elem.y + elem.height;
        ctx.lineTo(toX, toY);
        ctx.stroke();

        // Draw Arrowhead
        const angle = Math.atan2(elem.height, elem.width);
        const headLen = Math.max(10, elem.size * 3);
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (elem.type === 'text' && elem.x !== undefined && elem.y !== undefined && elem.text) {
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText(elem.text, elem.x, elem.y);
      }
    });

    // Render active drawing path preview
    if (isDrawing && currentPath.length > 0) {
      ctx.strokeStyle = tool === 'eraser' ? (canvasTheme === 'dark' ? '#121212' : '#ffffff') : color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';

      if (tool === 'pencil' || tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.forEach((pt) => ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      } else if (startPos && currentPath.length > 1) {
        const lastPt = currentPath[currentPath.length - 1];
        const w = lastPt.x - startPos.x;
        const h = lastPt.y - startPos.y;

        if (tool === 'rect') {
          ctx.strokeRect(startPos.x, startPos.y, w, h);
        } else if (tool === 'circle') {
          ctx.beginPath();
          ctx.ellipse(startPos.x + w / 2, startPos.y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (tool === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(lastPt.x, lastPt.y);
          ctx.stroke();
        }
      }
    }
  }, [elements, currentPath, isDrawing, canvasTheme, tool, color, size, startPos]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'text') {
      setTextInput({ x, y, text: '' });
      return;
    }

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentPath([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPath((prev) => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
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
          color,
          size,
        };
      } else {
        const w = lastPt.x - startPos.x;
        const h = lastPt.y - startPos.y;
        newElem = {
          id: 'elem-' + Date.now(),
          type: tool,
          x: startPos.x,
          y: startPos.y,
          width: w,
          height: h,
          color,
          size,
        };
      }

      if (newElem) {
        pushHistory([...elements, newElem]);
      }
    }

    setCurrentPath([]);
    setStartPos(null);
  };

  // Submit Text Node
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput && textInput.text.trim()) {
      const newElem: CanvasElement = {
        id: 'elem-' + Date.now(),
        type: 'text',
        x: textInput.x,
        y: textInput.y,
        text: textInput.text.trim(),
        color,
        size,
      };
      pushHistory([...elements, newElem]);
    }
    setTextInput(null);
  };

  // Export PNG Image
  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeDoc.title.toLowerCase().replace(/\s+/g, '-')}-canvas.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <CanvasErrorBoundary
      fallback={
        <div className="w-full h-full flex flex-col items-center justify-center bg-white text-neutral-800 p-6 text-center">
          <PenTool className="w-8 h-8 text-amber-500 mb-2" />
          <h3 className="font-bold text-sm">Whiteboard Canvas Engine</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            Ready to sketch visual notes and diagrams.
          </p>
        </div>
      }
    >
      <div className={`w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
        {/* Top Navigation & Controls Bar */}
        <div className="h-11 px-4 bg-neutral-50/90 border-b border-border-color flex items-center justify-between shrink-0 text-xs">
          {/* Left: Document Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-[60%] no-scrollbar">
            <div className="flex items-center gap-1.5 font-bold text-neutral-700 mr-2 shrink-0">
              <PenTool className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
              <span className="hidden sm:inline">Whiteboard Canvas</span>
            </div>

            {/* Document Pills */}
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
                title="New Whiteboard Document"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Actions */}
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
              onClick={handleClearCanvas}
              className="p-1.5 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-all-custom"
              title="Clear Canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCanvasTheme(canvasTheme === 'light' ? 'dark' : 'light')}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer transition-all-custom"
              title="Toggle Canvas Dark/Light Theme"
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

        {/* Floating Drawing Tools Toolbar */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-neutral-250 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
          {/* Tools Selection */}
          <div className="flex items-center gap-1 border-r border-neutral-200 pr-2">
            {[
              { id: 'pencil', label: 'Pencil', icon: PenTool },
              { id: 'rect', label: 'Rectangle', icon: Square },
              { id: 'circle', label: 'Circle', icon: Circle },
              { id: 'arrow', label: 'Arrow', icon: ArrowRight },
              { id: 'text', label: 'Text', icon: Type },
              { id: 'eraser', label: 'Eraser', icon: Eraser },
            ].map((t) => {
              const IconComp = t.icon;
              const isActive = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id as any)}
                  className={`p-1.5 rounded-full transition-all duration-150 cursor-pointer ${
                    isActive ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-600 hover:bg-neutral-150'
                  }`}
                  title={t.label}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1 border-r border-neutral-200 pr-2">
            {PALETTE.slice(0, 7).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border border-black/10 cursor-pointer transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-neutral-400' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 border-r border-neutral-200 pr-2">
            {[2, 4, 8].map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all-custom ${
                  size === s ? 'bg-neutral-200 text-neutral-900 font-extrabold' : 'text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                {s === 2 ? 'Thin' : s === 4 ? 'Med' : 'Thick'}
              </button>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={historyStep <= 0}
              className="p-1.5 text-neutral-600 hover:bg-neutral-150 disabled:opacity-30 rounded-full cursor-pointer"
              title="Undo"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyStep >= history.length - 1}
              className="p-1.5 text-neutral-600 hover:bg-neutral-150 disabled:opacity-30 rounded-full cursor-pointer"
              title="Redo"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text Tool Overlay Input */}
        {textInput && (
          <form
            onSubmit={handleTextSubmit}
            style={{ position: 'absolute', top: textInput.y, left: textInput.x, zIndex: 40 }}
            className="animate-fade-in"
          >
            <input
              type="text"
              value={textInput.text}
              onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
              onBlur={handleTextSubmit}
              placeholder="Type note & press Enter..."
              autoFocus
              className="px-2 py-1 bg-white border border-neutral-300 rounded shadow-md text-xs font-semibold outline-none text-neutral-900 min-w-[150px]"
            />
          </form>
        )}

        {/* Interactive HTML5 Canvas Container */}
        <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full block"
          />
        </div>
      </div>
    </CanvasErrorBoundary>
  );
}
