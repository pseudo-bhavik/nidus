'use client';

import React, { useEffect } from 'react';
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
  // Dispatch resize event after layout settles to guarantee 1:1 canvas mouse alignment
  useEffect(() => {
    const timer1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    const timer2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden touch-none"
      style={{ touchAction: 'none' }}
    >
      <Excalidraw
        excalidrawAPI={(api: any) => onApiReady(api)}
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
