import React, { useRef, useState } from 'react';
import { X, Upload, Download, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (links: { url: string; title: string }[]) => Promise<void>;
  onExport: () => void;
}

export default function ImportExportModal({ isOpen, onClose, onImport, onExport }: ImportExportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'saving' | 'success' | 'error'>('idle');
  const [parsedCount, setParsedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const parseNetscapeHTML = (htmlText: string): { url: string; title: string }[] => {
    const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const links: { url: string; title: string }[] = [];
    let match;
    
    while ((match = regex.exec(htmlText)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim(); // Remove nested HTML tags in title
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        links.push({ url, title: title || url });
      }
    }
    return links;
  };

  const parseJSON = (jsonText: string): { url: string; title: string }[] => {
    const data = JSON.parse(jsonText);
    const list = Array.isArray(data) ? data : data.bookmarks || [];
    const links: { url: string; title: string }[] = [];
    
    for (const item of list) {
      const url = item.url || item.href;
      const title = item.title || item.name || url;
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        links.push({ url, title });
      }
    }
    return links;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMessage('');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let links: { url: string; title: string }[] = [];

        if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          links = parseNetscapeHTML(text);
        } else if (file.name.endsWith('.json')) {
          links = parseJSON(text);
        } else {
          throw new Error('Unsupported file format. Please upload .html or .json.');
        }

        if (links.length === 0) {
          throw new Error('No valid links found in the file.');
        }

        setParsedCount(links.length);
        setStatus('saving');
        await onImport(links);
        setStatus('success');
      } catch (err: any) {
        console.error('File parsing error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Failed to parse bookmarks file.');
      }
    };

    reader.onerror = () => {
      setStatus('error');
      setErrorMessage('Failed to read the file.');
    };

    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div 
        className="w-full max-w-md bg-white border border-neutral-200/60 rounded-lg shadow-xl overflow-hidden flex flex-col transition-all-custom scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <h3 className="text-sm font-semibold text-neutral-800">Import & Export Bookmarks</h3>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-neutral-200/60 rounded-md transition-all-custom cursor-pointer"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          <p className="text-neutral-500 leading-relaxed font-medium">
            Migrate your bookmarks seamlessly. Upload a standard Chrome/Firefox export HTML file or a custom JSON list. You can also download your full library.
          </p>

          <div className="grid grid-cols-2 gap-3 mt-1">
            {/* Import Card */}
            <button
              onClick={triggerFileSelect}
              disabled={status === 'parsing' || status === 'saving'}
              className="border border-dashed border-neutral-300 hover:border-hn-orange/50 hover:bg-neutral-50 p-4 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all-custom group text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5 text-neutral-400 group-hover:text-hn-orange transition-all-custom" />
              <span className="font-semibold text-neutral-700">Import File</span>
              <span className="text-[10px] text-neutral-400">HTML or JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".html,.htm,.json"
              className="hidden"
            />

            {/* Export Card */}
            <button
              onClick={onExport}
              className="border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 p-4 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all-custom group text-center"
            >
              <Download className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600 transition-all-custom" />
              <span className="font-semibold text-neutral-700">Export Library</span>
              <span className="text-[10px] text-neutral-400">Download JSON</span>
            </button>
          </div>

          {/* Status logs */}
          {status === 'parsing' && (
            <div className="mt-2 p-3 bg-neutral-50 rounded-lg flex items-center gap-3 text-neutral-600 font-medium">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-300 border-t-neutral-600" />
              <span>Parsing files...</span>
            </div>
          )}

          {status === 'saving' && (
            <div className="mt-2 p-3 bg-neutral-50 rounded-lg flex items-center gap-3 text-neutral-600 font-medium">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-300 border-t-neutral-600" />
              <span>Saving {parsedCount} links to Supabase...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg flex items-start gap-2.5 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Complete</p>
                <p className="text-[10px] text-emerald-700/80">Successfully imported and scheduled scraping queue for {parsedCount} bookmarks.</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-2 p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Import Failed</p>
                <p className="text-[10px] text-red-700/80">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-neutral-200 rounded-md font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-all-custom"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
