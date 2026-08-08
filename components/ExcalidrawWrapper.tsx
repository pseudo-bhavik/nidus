'use client';

import React, { useEffect, useRef } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

interface ExcalidrawWrapperProps {
  initialElements: any[];
  initialAppState: any;
  theme: 'light' | 'dark';
  onApiReady: (api: any) => void;
  onChange: (elements: readonly any[], appState: any, files: any) => void;
}

export default function ExcalidrawWrapper({
  initialElements,
  initialAppState,
  theme,
  onApiReady,
  onChange,
}: ExcalidrawWrapperProps) {
  const apiRef = useRef<any>(null);

  const handleApiReady = (api: any) => {
    apiRef.current = api;
    onApiReady(api);
    if (api && typeof api.refresh === 'function') {
      api.refresh();
    }
  };

  // Dispatch resize event and api.refresh() after layout settles to guarantee 100% 1:1 canvas mouse alignment
  useEffect(() => {
    const triggerRefresh = () => {
      window.dispatchEvent(new Event('resize'));
      if (apiRef.current && typeof apiRef.current.refresh === 'function') {
        apiRef.current.refresh();
      }
    };

    const timer1 = setTimeout(triggerRefresh, 50);
    const timer2 = setTimeout(triggerRefresh, 250);
    const timer3 = setTimeout(triggerRefresh, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden touch-none"
      style={{ touchAction: 'none' }}
    >
      <Excalidraw
        excalidrawAPI={handleApiReady}
        initialData={{
          elements: initialElements,
          appState: initialAppState,
          scrollToContent: true,
        }}
        onChange={onChange}
        theme={theme}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}

export { exportToBlob };
