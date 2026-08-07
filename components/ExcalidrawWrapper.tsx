'use client';

import React, { useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

interface ExcalidrawWrapperProps {
  activeDocId: string;
  canvasTheme: 'light' | 'dark';
  initialElements: any[];
  onChange: (elements: readonly any[], appState: any) => void;
  onAPIReady?: (api: any) => void;
}

export default function ExcalidrawWrapper({
  activeDocId,
  canvasTheme,
  initialElements,
  onChange,
  onAPIReady,
}: ExcalidrawWrapperProps) {
  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <Excalidraw
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
