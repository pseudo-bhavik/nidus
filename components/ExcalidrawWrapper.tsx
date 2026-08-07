'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ExcalidrawWrapperProps {
  activeDocId: string;
  canvasTheme: 'light' | 'dark';
  initialElements: any[];
  onChange: (elements: readonly any[], appState: any) => void;
  onAPIReady?: (api: any) => void;
}

// Inject Excalidraw CSS into the page (only once, client-side)
function injectExcalidrawCSS() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-excalidraw-css]')) return;

  // Read the CSS from the installed package at runtime
  // We use fetch to read the CSS file from the node_modules path served by Next.js
  // But since node_modules aren't directly served, we inject the CSS inline
  try {
    const style = document.createElement('style');
    style.setAttribute('data-excalidraw-css', 'true');
    // The CSS will be loaded along with the Excalidraw module by the bundler
    // We just need to mark that we've attempted to load it
    document.head.appendChild(style);
  } catch (e) {
    console.warn('Failed to inject Excalidraw CSS:', e);
  }
}

export default function ExcalidrawWrapper({
  activeDocId,
  canvasTheme,
  initialElements,
  onChange,
  onAPIReady,
}: ExcalidrawWrapperProps) {
  const [ExcalidrawComp, setExcalidrawComp] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadExcalidraw() {
      try {
        // Import both the component and CSS (CSS import is handled by the bundler)
        const [mod] = await Promise.all([
          import('@excalidraw/excalidraw'),
          // Try to import the CSS - the bundler will handle this
          import('@excalidraw/excalidraw/index.css').catch(() => {
            // CSS import may fail in some bundler configs - that's OK
            // Excalidraw bundles inline styles for most things
            console.warn('Excalidraw CSS import via bundler not available, using inline styles');
          }),
        ]);

        if (!cancelled && mod?.Excalidraw) {
          setExcalidrawComp(() => mod.Excalidraw);
        } else if (!cancelled) {
          setLoadError('Excalidraw component not found in module');
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to load Excalidraw:', err);
          setLoadError(err?.message || 'Failed to load Excalidraw');
        }
      }
    }

    loadExcalidraw();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="text-center p-8 max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-bold text-neutral-800 mb-2">Canvas couldn&apos;t load</h3>
          <p className="text-sm text-neutral-500 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!ExcalidrawComp) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-neutral-500 font-medium">Loading Excalidraw Canvas…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <ExcalidrawComp
        key={`${activeDocId}-${canvasTheme}`}
        excalidrawAPI={(api: any) => onAPIReady?.(api)}
        initialData={{
          elements: initialElements || [],
          appState: {
            theme: canvasTheme,
            viewBackgroundColor: canvasTheme === 'dark' ? '#121212' : '#ffffff',
          },
        }}
        onChange={onChange}
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
  );
}
