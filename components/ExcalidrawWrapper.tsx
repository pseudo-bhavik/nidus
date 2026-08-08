'use client';

import React from 'react';
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
  return (
    <div className="w-full h-full relative">
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
