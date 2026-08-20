import React, { useState, useEffect } from 'react';
import { X, BookOpen, User, Keyboard, CheckCircle, Database, HelpCircle, Palette } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
  isDbConnected: boolean;
  onLogout: () => Promise<void>;
  onOpenAuth: () => void;
  defaultTab?: string;
  activeTheme: string;
  onSelectTheme: (themeName: string) => void;
  activeFont: string;
  onSelectFont: (fontName: string) => void;
  activeHighlightStyle: string;
  onSelectHighlightStyle: (styleName: string) => void;
  activeDensity: string;
  onSelectDensity: (densityName: string) => void;
  activeZoom: number;
  onSelectZoom: (zoom: number) => void;
}

type TabType = 'guide' | 'account' | 'shortcuts' | 'personalization';

export default function SettingsModal({
  isOpen,
  onClose,
  userEmail,
  isDbConnected,
  onLogout,
  onOpenAuth,
  defaultTab,
  activeTheme,
  onSelectTheme,
  activeFont,
  onSelectFont,
  activeHighlightStyle,
  onSelectHighlightStyle,
  activeDensity,
  onSelectDensity,
  activeZoom,
  onSelectZoom,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('guide');

  // Route active tab if defaultTab prop changes on modal open
  useEffect(() => {
    if (isOpen && defaultTab) {
      if (defaultTab === 'vim') {
        setActiveTab('shortcuts');
      } else if (defaultTab === 'guide') {
        setActiveTab('guide');
      } else if (defaultTab === 'account') {
        setActiveTab('account');
      }
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div 
        className="w-full max-w-2xl h-[535px] bg-white border border-neutral-200/60 rounded-lg shadow-2xl overflow-hidden flex flex-col transition-all-custom font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2 font-bold text-sm text-neutral-800 tracking-tight">
            <span>Nidus Dashboard Settings</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-neutral-200/60 rounded-md transition-all-custom cursor-pointer"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* Outer Split Layout (Left Sidebar, Right Content) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tab Selector Column */}
          <div className="w-[180px] bg-neutral-50/50 border-r border-neutral-100 p-2.5 flex flex-col gap-1 select-none text-xs">
            <button
              onClick={() => setActiveTab('guide')}
              className={`w-full px-3 py-2 rounded-md flex items-center gap-2 font-bold text-left cursor-pointer transition-all-custom ${
                activeTab === 'guide'
                  ? 'bg-neutral-900/5 text-neutral-800'
                  : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>User Guide / Manual</span>
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className={`w-full px-3 py-2 rounded-md flex items-center gap-2 font-bold text-left cursor-pointer transition-all-custom ${
                activeTab === 'account'
                  ? 'bg-neutral-900/5 text-neutral-800'
                  : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Account & Sync</span>
            </button>

            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`w-full px-3 py-2 rounded-md flex items-center gap-2 font-bold text-left cursor-pointer transition-all-custom ${
                activeTab === 'shortcuts'
                  ? 'bg-neutral-900/5 text-neutral-800'
                  : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Shortcuts Reference</span>
            </button>

            <button
              onClick={() => setActiveTab('personalization')}
              className={`w-full px-3 py-2 rounded-md flex items-center gap-2 font-bold text-left cursor-pointer transition-all-custom ${
                activeTab === 'personalization'
                  ? 'bg-neutral-900/5 text-neutral-800'
                  : 'text-neutral-500 hover:bg-neutral-900/3 hover:text-neutral-700'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Personalization</span>
            </button>
          </div>

          {/* Content Pane */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-neutral-650 leading-relaxed font-semibold">
            
            {/* 1. Guide Tab */}
            {activeTab === 'guide' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-neutral-800 text-sm mb-1.5 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
                    <span>Getting Started with Nidus</span>
                  </h3>
                  <p>
                    Nidus is a high-performance link organization tool. It is structured around three clean sections: a navigation sidebar, a central Hacker News-style bookmarks list, and a right-side detail editor/inspector.
                  </p>
                </div>

                <hr className="border-neutral-100" />

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">1. Smart Auto-Scraping & Bypasses</h4>
                  <p className="mb-2">
                    Paste any URL into the input field in the top bar and click <strong>Submit</strong>. Nidus features a multi-layered scraper with custom oEmbed API bypasses for <strong>YouTube, GitHub, Spotify, Reddit, Medium, TikTok, and Vimeo</strong>, combined with a raw Safari-simulating fetch fallback to bypass security blocks.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">2. Notion-style Badging & Editing</h4>
                  <p className="mb-2">
                    Click on the <strong>Category</strong> or <strong>Priority</strong> badges on any bookmark row to open an inline menu where you can instantly update the tag. In the right-side inspector, you can edit titles and write custom notes with real-time autosave.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">3. Collection Right-Click Management</h4>
                  <p className="mb-2">
                    Organize bookmarks using custom collections. <strong>Right-click any Collection</strong> in the Left Sidebar to trigger a custom context menu, allowing you to <strong>Rename</strong>, <strong>Merge</strong> (combine it with another collection), <strong>Empty Content</strong>, or <strong>Delete</strong> the collection completely.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">4. Bookmark Folder Imports</h4>
                  <p className="mb-2">
                    When importing bookmarks via standard browser exports (HTML files or JSON trees), Nidus automatically parses the folder structure, creates matching Collections, and maps your imported bookmarks directly into them.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">5. Sticky Notes Workspace</h4>
                  <p className="mb-2">
                    Create, edit, pin, and color-code quick sticky notes in the <strong>Sticky Notes</strong> section. Filter notes, change note palette colors, and copy note contents with one click.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">6. Whiteboard Canvas (Excalidraw Integration)</h4>
                  <p className="mb-2">
                    Access a complete <strong>Excalidraw</strong> drawing & visual note-taking canvas directly inside Nidus under the <strong>Whiteboard Canvas</strong> sidebar option. Draw diagrams, sketch wireframes, create multiple whiteboards, switch canvas light/dark themes, and export high-resolution PNG images.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">7. Link Vault & Multi-Level Folders</h4>
                  <p className="mb-2">
                    Store large batches of links and resources without cluttering your primary bookmarks view. Organize links into <strong>collapsible color-coded sections and nested subfolders</strong> (e.g. <em>AI Tools → Related Stuff → Subfolders</em>). Supports <strong>Bulk Paste</strong>, <strong>HTML/JSON browser bookmark imports</strong> (preserving folder hierarchy), background metadata auto-scraping, and bulk multi-selection deletion.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-neutral-800 mb-1">8. Vim Hotkeys, Right-Click Menus & Command Console</h4>
                  <p>
                    Navigate links instantly using Vim navigation keys (<strong>j</strong> / <strong>k</strong>). <strong>Right-click</strong> any bookmark, vault link, or folder header to open an instant action menu (Open, Copy, Re-scrape, Add Subfolder, Rename, Delete). Press <strong>Cmd+K</strong> (or <strong>Ctrl+K</strong>) to open the Command Palette to navigate views and execute actions instantly.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Account Profile Tab */}
            {activeTab === 'account' && (
              <div className="flex flex-col gap-4">
                <h3 className="font-bold text-neutral-800 text-sm mb-1.5 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
                  <span>Cloud Synchronization & Profiles</span>
                </h3>

                <div className="p-3.5 bg-neutral-50 rounded-lg border border-neutral-150 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-700">Sync Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isDbConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isDbConnected ? 'Cloud Online' : 'Local Offline (Demo Mode)'}
                    </span>
                  </div>

                  <hr className="border-neutral-200/50" />

                  {userEmail ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-neutral-500">Logged in user:</span>
                        <span className="font-bold text-neutral-800">{userEmail}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        All bookmarks created are bound to your user ID and synced across your devices.
                      </p>
                      <button
                        onClick={onLogout}
                        className="mt-2 w-full py-1.5 bg-white border border-neutral-200 text-red-650 font-bold hover:bg-red-50 rounded-md cursor-pointer transition-all-custom"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 text-center py-2">
                      <p className="font-bold text-neutral-700">You are browsing in Guest Mode.</p>
                      <p className="text-[10px] text-neutral-400 max-w-sm mx-auto mb-2">
                        Sign in to sync your link catalog with our cloud database. Guest bookmarks are saved locally.
                      </p>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAuth();
                        }}
                        className="py-1.5 bg-hn-orange text-white font-bold rounded-md cursor-pointer transition-all-custom hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        Register or Sign In
                      </button>
                    </div>
                  )}
                </div>

                {!isDbConnected && (
                  <div className="p-3 bg-amber-50 border border-amber-100 text-amber-850 rounded-lg">
                    <p className="font-bold mb-1">Supabase Keys Not Configured</p>
                    <p className="text-[10px] text-amber-750">
                      To enable full Cloud Synchronization, configure the `.env.local` file at the project root with your credentials:
                    </p>
                    <pre className="mt-1.5 p-1.5 bg-white/60 border border-amber-200/60 rounded font-mono text-[9px] text-neutral-700 select-all overflow-x-auto">
                      NEXT_PUBLIC_SUPABASE_URL=your-project-url{"\n"}
                      NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-jwt-key
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 3. Keyboard Shortcuts Tab */}
            {activeTab === 'shortcuts' && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-neutral-800 text-sm mb-1.5 flex items-center gap-1.5">
                  <Keyboard className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
                  <span>Vim & Navigation Shortcuts Reference</span>
                </h3>

                <div className="border border-neutral-150 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-150 font-bold text-neutral-700">
                        <th className="px-3 py-2">Shortcut / Action</th>
                        <th className="px-3 py-2">Triggered Function</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-bold text-neutral-600">
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">j</kbd></td>
                        <td className="px-3 py-2">Highlight Next bookmark row in the active view</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">k</kbd></td>
                        <td className="px-3 py-2">Highlight Previous bookmark row in the active view</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">o</kbd></td>
                        <td className="px-3 py-2">Open the highlighted link in a new browser tab</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">e</kbd></td>
                        <td className="px-3 py-2">Open the Inspector and focus the custom notes editor</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">c</kbd></td>
                        <td className="px-3 py-2">Toggle Completed check status of highlighted bookmark</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">t</kbd></td>
                        <td className="px-3 py-2">Send bookmark to Trash (or delete forever if in trash tab)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">/</kbd></td>
                        <td className="px-3 py-2">Focus search input for instant filtering</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">Cmd + K</kbd> / <kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">Ctrl + K</kbd></td>
                        <td className="px-3 py-2">Toggle the Command Palette Overlay (All Views, Vault & Shortcuts)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><kbd className="bg-neutral-100 border border-neutral-200 rounded px-1.5 py-0.5">Esc</kbd></td>
                        <td className="px-3 py-2">Unfocus input text, clear selection, hide inspector, or close modals</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><span className="text-[11px] font-semibold text-neutral-700">Right-Click (Link)</span></td>
                        <td className="px-3 py-2">Open instant Link context menu (Open, Copy Link, Re-scrape, Delete)</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-mono text-neutral-800"><span className="text-[11px] font-semibold text-neutral-700">Right-Click (Folder)</span></td>
                        <td className="px-3 py-2">Open Folder context menu (Add Subfolder, Bulk Paste, Rename, Delete)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Personalization Tab */}
            {activeTab === 'personalization' && (
              <div className="flex flex-col gap-4 text-xs select-none">
                <h3 className="font-bold text-neutral-800 text-sm mb-1 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-hn-orange" style={{ color: 'var(--accent-color)' }} />
                  <span>Personalize Application Theme & Layout</span>
                </h3>
                
                {/* 1. Theme Accent Grid */}
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {[
                    { id: 'orange', name: 'HN Orange', bg: 'bg-[#ff6600]' },
                    { id: 'emerald', name: 'Emerald', bg: 'bg-[#10b981]' },
                    { id: 'blue', name: 'Blue', bg: 'bg-[#3b82f6]' },
                    { id: 'violet', name: 'Violet', bg: 'bg-[#8b5cf6]' },
                  ].map((theme) => {
                    const isSelected = activeTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => onSelectTheme(theme.id)}
                        className={`py-2 px-2 rounded-md border flex flex-col items-center gap-1 cursor-pointer text-center transition-all-custom ${
                          isSelected
                            ? 'bg-neutral-50 border-neutral-350 shadow-xs font-bold text-neutral-800'
                            : 'bg-white border-neutral-250 hover:border-neutral-300 text-neutral-500'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${theme.bg} shrink-0`} />
                        <span className="text-[10px]">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>

                <hr className="border-neutral-100" />

                {/* 2. Zoom Range Slider scroller */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center font-bold text-neutral-800">
                    <span>Application Text Size / Layout Zoom</span>
                    <span className="bg-hn-orange/15 text-hn-orange px-2 py-0.5 rounded text-[10px]" style={{ color: 'var(--accent-color)', backgroundColor: 'rgba(var(--accent-rgb), 0.1)' }}>
                      {Math.round(activeZoom * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-neutral-400 font-bold">100%</span>
                    <input
                      type="range"
                      min="0.90"
                      max="1.50"
                      step="0.05"
                      value={activeZoom}
                      onChange={(e) => onSelectZoom(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 rounded-lg bg-neutral-200 appearance-none cursor-pointer"
                      style={{ accentColor: 'var(--accent-color)' }}
                    />
                    <span className="text-[10px] text-neutral-400 font-bold">150%</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {[1.0, 1.15, 1.25, 1.50].map((zVal) => (
                      <button
                        key={zVal}
                        type="button"
                        onClick={() => onSelectZoom(zVal)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border cursor-pointer transition-all ${
                          Math.abs(activeZoom - zVal) < 0.02
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {Math.round(zVal * 100)}%
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-neutral-100" />

                {/* 3. Font Selection Grid */}
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-bold text-neutral-800">Application Font Family</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'sans', name: 'Sans-Serif (Inter)', desc: 'Modern & Clean' },
                      { id: 'serif', name: 'Serif (Retro HN)', desc: 'Editorial Classic' },
                      { id: 'mono', name: 'Monospace (Terminal)', desc: 'Technical Dense' },
                    ].map((font) => {
                      const isSelected = activeFont === font.id;
                      return (
                        <button
                          key={font.id}
                          onClick={() => onSelectFont(font.id)}
                          className={`p-2 rounded-md border flex flex-col text-left cursor-pointer transition-all-custom ${
                            isSelected
                              ? 'bg-neutral-50 border-neutral-350 shadow-xs font-bold text-neutral-800'
                              : 'bg-white border-neutral-250 hover:border-neutral-300 text-neutral-500'
                          }`}
                        >
                          <span className="text-[11px] font-bold">{font.name}</span>
                          <span className="text-[9px] opacity-75">{font.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <hr className="border-neutral-100" />

                {/* 4. Row Highlight Styles */}
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-bold text-neutral-800">Bookmark Highlight Style</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'border', name: 'Accent Left Border', desc: 'Minimal side bar indicator' },
                      { id: 'background', name: 'Full Row Accent Wash', desc: 'Subtle background color wash' },
                    ].map((style) => {
                      const isSelected = activeHighlightStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          onClick={() => onSelectHighlightStyle(style.id)}
                          className={`p-2 rounded-md border flex flex-col text-left cursor-pointer transition-all-custom ${
                            isSelected
                              ? 'bg-neutral-50 border-neutral-350 shadow-xs font-bold text-neutral-800'
                              : 'bg-white border-neutral-250 hover:border-neutral-300 text-neutral-500'
                          }`}
                        >
                          <span className="text-[11px] font-bold">{style.name}</span>
                          <span className="text-[9px] opacity-75">{style.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <hr className="border-neutral-100" />

                {/* 5. Density Settings */}
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-bold text-neutral-800">Layout Row Density</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'compact', name: 'Compact', desc: 'HN traditional dense' },
                      { id: 'cozy', name: 'Cozy', desc: 'Balanced spacing' },
                      { id: 'spacious', name: 'Spacious', desc: 'Extended breathing room' },
                    ].map((dens) => {
                      const isSelected = activeDensity === dens.id;
                      return (
                        <button
                          key={dens.id}
                          onClick={() => onSelectDensity(dens.id)}
                          className={`p-2 rounded-md border flex flex-col text-left cursor-pointer transition-all-custom ${
                            isSelected
                              ? 'bg-neutral-50 border-neutral-350 shadow-xs font-bold text-neutral-800'
                              : 'bg-white border-neutral-250 hover:border-neutral-300 text-neutral-500'
                          }`}
                        >
                          <span className="text-[11px] font-bold">{dens.name}</span>
                          <span className="text-[9px] opacity-75">{dens.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-neutral-900 text-white font-bold hover:bg-neutral-800 rounded-md cursor-pointer transition-all-custom"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
