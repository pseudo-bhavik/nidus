'use client';

import React, { useCallback, useRef } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';

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
  );
}

export { exportToBlob };
