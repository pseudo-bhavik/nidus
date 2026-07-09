'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Bookmark, ViewType } from '../lib/types';
import LeftSidebar from '../components/LeftSidebar';
import CentralMonitor from '../components/CentralMonitor';
import InspectorPanel from '../components/InspectorPanel';
import CommandPalette from '../components/CommandPalette';
import ImportExportModal from '../components/ImportExportModal';
import AuthModal from '../components/AuthModal';
import SettingsModal from '../components/SettingsModal';
import EditBookmarkModal from '../components/EditBookmarkModal';
import ContextMenu from '../components/ContextMenu';
import { AlertTriangle, Info, Terminal } from 'lucide-react';

const SEED_BOOKMARKS: Bookmark[] = [
  {
    id: 'seed-hn',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    url: 'https://news.ycombinator.com',
    title: 'Hacker News',
    description: 'A social news website focusing on computer science and entrepreneurship.',
    domain: 'news.ycombinator.com',
    thumbnail_url: 'https://news.ycombinator.com/favicon.ico',
    category: 'Reading List',
    priority: 'High',
    is_completed: false,
    is_trashed: false,
    notes: 'Main source of daily tech news and community discussions.',
    read_time_minutes: 2,
  },
  {
    id: 'seed-notion',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    url: 'https://www.notion.so',
    title: 'Notion – Your wiki, docs & projects. Together.',
    description: 'A new tool that blends your everyday work apps into one. It is the all-in-one workspace for you and your team.',
    domain: 'notion.so',
    thumbnail_url: 'https://www.notion.so/images/favicon.ico',
    category: 'Design',
    priority: 'Medium',
    is_completed: false,
    is_trashed: false,
    notes: 'Reference layout for this application. Notion table layout rules!',
    read_time_minutes: 3,
  },
  {
    id: 'seed-nextjs',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    url: 'https://nextjs.org',
    title: 'Next.js by Vercel - The React Framework for the Web',
    description: 'Used by some of the world\'s largest companies, Next.js enables you to create high-quality web applications by starting with React.',
    domain: 'nextjs.org',
    thumbnail_url: 'https://nextjs.org/favicon.ico',
    category: 'Tech',
    priority: 'High',
    is_completed: true,
    is_trashed: false,
    notes: 'Built with App Router and Tailwind CSS config.',
    read_time_minutes: 5,
  },
];

export default function Dashboard() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBookmark, setActiveBookmark] = useState<Bookmark | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modals status
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Database & Auth status
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [checkingDb, setCheckingDb] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // v1.2 Sidebar, Edit & Context Menu states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBookmark, setEditBookmark] = useState<Bookmark | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    bookmark: Bookmark | null;
  }>({ x: 0, y: 0, visible: false, bookmark: null });

  // v1.3 Custom Categories tracking state (without pseudo-links)
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // v1.4 Theme Accent & Priority Filter states
  const [activeTheme, setActiveTheme] = useState('orange');
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [defaultSettingsTab, setDefaultSettingsTab] = useState('guide');

  // v1.5 Advanced Personalization States
  const [activeFont, setActiveFont] = useState('sans');
  const [activeHighlightStyle, setActiveHighlightStyle] = useState('border');
  const [activeDensity, setActiveDensity] = useState('cozy');
  const [activeZoom, setActiveZoom] = useState(1.04);

  // Check connection status & fetch
  useEffect(() => {
    async function initApp() {
      setCheckingDb(true);
      let connected = false;
      try {
        const { error } = await supabase.from('bookmarks').select('id').limit(1);
        if (!error) {
          connected = true;
        }
      } catch (err) {
        console.warn('Supabase not reachable:', err);
      }

      setIsDbConnected(connected);
      setCheckingDb(false);

      if (connected) {
        // Retrieve current session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || null);
          setUserId(session.user.id);
          loadBookmarks(true, session.user.id);
        } else {
          loadBookmarks(true, null);
        }

        // Setup auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          const email = session?.user?.email || null;
          const uid = session?.user?.id || null;
          setUserEmail(email);
          setUserId(uid);
          loadBookmarks(true, uid);
        });

        return () => subscription.unsubscribe();
      } else {
        loadBookmarks(false, null);
      }
    }
    initApp();
  }, [isDbConnected]);

  // Load custom categories and personalize themes on mount
  useEffect(() => {
    const storedCats = localStorage.getItem('antigravity_custom_categories');
    if (storedCats) {
      try {
        setCustomCategories(JSON.parse(storedCats));
      } catch {}
    }

    const storedTheme = localStorage.getItem('antigravity_theme') || 'orange';
    setActiveTheme(storedTheme);
    applyTheme(storedTheme);

    const storedFont = localStorage.getItem('antigravity_font') || 'sans';
    setActiveFont(storedFont);
    applyFont(storedFont);

    const storedHighlight = localStorage.getItem('antigravity_highlight_style') || 'border';
    setActiveHighlightStyle(storedHighlight);

    const storedDensity = localStorage.getItem('antigravity_density') || 'cozy';
    setActiveDensity(storedDensity);

    const storedZoom = localStorage.getItem('antigravity_zoom') || '1.04';
    const zoomVal = parseFloat(storedZoom);
    setActiveZoom(zoomVal);
    applyZoom(zoomVal);
  }, []);

  const applyTheme = (theme: string) => {
    let color = '#ff6600';
    let rgb = '255, 102, 0';
    if (theme === 'emerald') { color = '#10b981'; rgb = '16, 185, 129'; }
    if (theme === 'blue') { color = '#3b82f6'; rgb = '59, 130, 246'; }
    if (theme === 'violet') { color = '#8b5cf6'; rgb = '139, 92, 246'; }
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-rgb', rgb);
  };

  const applyFont = (font: string) => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('font-sans-custom', 'font-serif-custom', 'font-mono-custom');
      document.body.classList.add(`font-${font}-custom`);
    }
  };

  const applyZoom = (zoom: number) => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.zoom = zoom.toString();
    }
  };

  const handleSelectTheme = (theme: string) => {
    setActiveTheme(theme);
    applyTheme(theme);
    localStorage.setItem('antigravity_theme', theme);
  };

  const handleSelectFont = (font: string) => {
    setActiveFont(font);
    applyFont(font);
    localStorage.setItem('antigravity_font', font);
  };

  const handleSelectHighlightStyle = (style: string) => {
    setActiveHighlightStyle(style);
    localStorage.setItem('antigravity_highlight_style', style);
  };

  const handleSelectDensity = (density: string) => {
    setActiveDensity(density);
    localStorage.setItem('antigravity_density', density);
  };

  const handleSelectZoom = (zoom: number) => {
    setActiveZoom(zoom);
    applyZoom(zoom);
    localStorage.setItem('antigravity_zoom', zoom.toString());
  };

  const handleOpenSettings = (tab?: string) => {
    setDefaultSettingsTab(tab || 'guide');
    setIsSettingsOpen(true);
  };

  // Load bookmarks (either from Supabase or localStorage fallback)
  const loadBookmarks = (connected = isDbConnected, uid = userId) => {
    if (connected) {
      let query = supabase.from('bookmarks').select('*');
      if (uid) {
        query = query.eq('user_id', uid);
      } else {
        query = query.is('user_id', null);
      }
      query.order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            console.error('Fetch bookmarks error:', error);
            fallbackToLocal();
          } else {
            setBookmarks(data || []);
          }
        });
    } else {
      fallbackToLocal();
    }
  };

  const fallbackToLocal = () => {
    const local = localStorage.getItem('antigravity_bookmarks');
    if (local) {
      try {
        setBookmarks(JSON.parse(local));
      } catch {
        setBookmarks(SEED_BOOKMARKS);
        localStorage.setItem('antigravity_bookmarks', JSON.stringify(SEED_BOOKMARKS));
      }
    } else {
      setBookmarks(SEED_BOOKMARKS);
      localStorage.setItem('antigravity_bookmarks', JSON.stringify(SEED_BOOKMARKS));
    }
  };

  // Helper to save to local storage when in fallback mode
  const saveLocal = (newList: Bookmark[]) => {
    setBookmarks(newList);
    localStorage.setItem('antigravity_bookmarks', JSON.stringify(newList));
    // Keep active bookmark detail updated if selected
    if (activeBookmark) {
      const updatedActive = newList.find(b => b.id === activeBookmark.id);
      if (updatedActive) {
        setActiveBookmark(updatedActive);
      }
    }
  };

  // 1. Add Bookmark / Scrape URL
  const handleAddBookmark = async (url: string) => {
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      
      const newBookmark: Omit<Bookmark, 'id' | 'created_at'> = {
        url: data.url || url,
        title: data.title || url,
        description: data.description || null,
        domain: data.domain || new URL(url).hostname,
        thumbnail_url: data.thumbnailUrl || null,
        category: 'Unsorted',
        priority: 'Medium',
        is_completed: false,
        is_trashed: false,
        notes: '',
        read_time_minutes: data.readTimeMinutes || 1,
      };

      if (isDbConnected) {
        const itemToInsert = userId 
          ? { ...newBookmark, user_id: userId } 
          : newBookmark;

        const { data: dbData, error } = await supabase
          .from('bookmarks')
          .insert([itemToInsert])
          .select();
        if (error) throw error;
        if (dbData && dbData.length > 0) {
          setBookmarks((prev) => [dbData[0], ...prev]);
        }
      } else {
        const localObj: Bookmark = {
          ...newBookmark,
          id: 'local-' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
        };
        saveLocal([localObj, ...bookmarks]);
      }
    } catch (err) {
      console.error('Failed to ingest bookmark:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUserEmail(null);
      setUserId(null);
      setSelectedIds([]);
      setActiveBookmark(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent, bookmark: Bookmark) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      bookmark,
    });
  };

  const handlePromptAddCategory = () => {
    const cat = prompt('Enter new Collection name:');
    if (cat && cat.trim()) {
      const trimmed = cat.trim();
      if (!customCategories.includes(trimmed)) {
        const newList = [...customCategories, trimmed];
        setCustomCategories(newList);
        localStorage.setItem('antigravity_custom_categories', JSON.stringify(newList));
      }
    }
  };

  // 2. Update Bookmark
  const handleUpdateBookmark = async (id: string, updates: Partial<Bookmark>) => {
    // Optimistic UI updates
    const updatedList = bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b));
    
    if (isDbConnected) {
      setBookmarks(updatedList);
      if (activeBookmark && activeBookmark.id === id) {
        setActiveBookmark({ ...activeBookmark, ...updates });
      }
      const { error } = await supabase.from('bookmarks').update(updates).eq('id', id);
      if (error) {
        console.error('Database update error:', error);
        loadBookmarks(); // Rollback to actual db state on error
      }
    } else {
      saveLocal(updatedList);
    }
  };

  // 3. Delete Bookmark (Trashes it first, or deletes forever if already trashed)
  const handleDeleteBookmark = async (id: string) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    if (!bookmark) return;

    if (!bookmark.is_trashed) {
      // Move to trash
      await handleUpdateBookmark(id, { is_trashed: true });
      if (activeBookmark?.id === id) {
        setActiveBookmark({ ...bookmark, is_trashed: true });
      }
    } else {
      // Delete permanently
      const updatedList = bookmarks.filter((b) => b.id !== id);
      if (isDbConnected) {
        setBookmarks(updatedList);
        if (activeBookmark?.id === id) setActiveBookmark(null);
        const { error } = await supabase.from('bookmarks').delete().eq('id', id);
        if (error) {
          console.error('Permanent delete error:', error);
          loadBookmarks(); // Rollback
        }
      } else {
        saveLocal(updatedList);
        if (activeBookmark?.id === id) setActiveBookmark(null);
      }
    }
    // Deselect if removed
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  // 4. Restore Bookmark
  const handleRestoreBookmark = async (id: string) => {
    await handleUpdateBookmark(id, { is_trashed: false });
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark && activeBookmark?.id === id) {
      setActiveBookmark({ ...bookmark, is_trashed: false });
    }
  };

  // 5. Empty Trash
  const handleEmptyTrash = async () => {
    const activeLeft = bookmarks.filter((b) => !b.is_trashed);
    if (isDbConnected) {
      setBookmarks(activeLeft);
      const { error } = await supabase.from('bookmarks').delete().eq('is_trashed', true);
      if (error) {
        console.error('Empty trash database error:', error);
        loadBookmarks();
      }
    } else {
      saveLocal(activeLeft);
    }
    setActiveBookmark(null);
    setSelectedIds([]);
  };

  // 6. Bulk Complete
  const handleBulkComplete = async () => {
    const updated = bookmarks.map((b) =>
      selectedIds.includes(b.id) ? { ...b, is_completed: true } : b
    );
    if (isDbConnected) {
      setBookmarks(updated);
      const { error } = await supabase
        .from('bookmarks')
        .update({ is_completed: true })
        .in('id', selectedIds);
      if (error) {
        console.error(error);
        loadBookmarks();
      }
    } else {
      saveLocal(updated);
    }
    setSelectedIds([]);
  };

  // 7. Bulk Trash
  const handleBulkTrash = async () => {
    const updated = bookmarks.map((b) =>
      selectedIds.includes(b.id) ? { ...b, is_trashed: true } : b
    );
    if (isDbConnected) {
      setBookmarks(updated);
      const { error } = await supabase
        .from('bookmarks')
        .update({ is_trashed: true })
        .in('id', selectedIds);
      if (error) {
        console.error(error);
        loadBookmarks();
      }
    } else {
      saveLocal(updated);
    }
    setSelectedIds([]);
  };

  // 8. Bulk Change Category
  const handleBulkChangeCategory = async (cat: string) => {
    const updated = bookmarks.map((b) =>
      selectedIds.includes(b.id) ? { ...b, category: cat } : b
    );
    if (isDbConnected) {
      setBookmarks(updated);
      const { error } = await supabase
        .from('bookmarks')
        .update({ category: cat })
        .in('id', selectedIds);
      if (error) {
        console.error(error);
        loadBookmarks();
      }
    } else {
      saveLocal(updated);
    }
    setSelectedIds([]);
  };

  // 9. Bulk Change Priority
  const handleBulkChangePriority = async (prio: 'Low' | 'Medium' | 'High') => {
    const updated = bookmarks.map((b) =>
      selectedIds.includes(b.id) ? { ...b, priority: prio } : b
    );
    if (isDbConnected) {
      setBookmarks(updated);
      const { error } = await supabase
        .from('bookmarks')
        .update({ priority: prio })
        .in('id', selectedIds);
      if (error) {
        console.error(error);
        loadBookmarks();
      }
    } else {
      saveLocal(updated);
    }
    setSelectedIds([]);
  };

  // 10. Bookmarks Import Queue Handler
  const handleImportBookmarks = async (importedLinks: { url: string; title: string }[]) => {
    // Stage 1: Build basic bookmark objects for instant UI reactivity
    const newItems: Bookmark[] = importedLinks.map((link) => {
      let domain = 'domain.xyz';
      try {
        domain = new URL(link.url).hostname.replace('www.', '');
      } catch {}

      return {
        id: 'import-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        url: link.url,
        title: link.title || domain,
        description: null,
        domain,
        thumbnail_url: null,
        category: 'Unsorted',
        priority: 'Medium',
        is_completed: false,
        is_trashed: false,
        notes: '',
        read_time_minutes: 1,
      };
    });

    // Write stage-1 bookmarks to storage
    let insertedList: Bookmark[] = [];
    if (isDbConnected) {
      // Remove local-only ID before insertion
      const cleanItems = newItems.map(({ id, ...rest }) => rest);
      const { data: dbData, error } = await supabase
        .from('bookmarks')
        .insert(cleanItems)
        .select();
      
      if (error) {
        console.error('Import database insertion error:', error);
        throw error;
      }
      insertedList = dbData || [];
      setBookmarks((prev) => [...insertedList, ...prev]);
    } else {
      insertedList = newItems;
      saveLocal([...newItems, ...bookmarks]);
    }

    // Stage 2: Background scrape queue to fetch details one-by-one (minimizing rate limit hits)
    // Run asynchronously without blocking the UI
    (async () => {
      for (const item of insertedList) {
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url }),
          });
          if (res.ok) {
            const scraped = await res.json();
            const updates = {
              title: scraped.title !== item.domain ? scraped.title : item.title,
              description: scraped.description || null,
              thumbnail_url: scraped.thumbnailUrl || null,
              read_time_minutes: scraped.readTimeMinutes || 1,
            };
            
            // Perform background updates
            if (isDbConnected) {
              await supabase.from('bookmarks').update(updates).eq('id', item.id);
            } else {
              // Update local state directly
              const localList = localStorage.getItem('antigravity_bookmarks');
              if (localList) {
                const parsed = JSON.parse(localList) as Bookmark[];
                const updatedList = parsed.map(b => b.id === item.id ? { ...b, ...updates } : b);
                localStorage.setItem('antigravity_bookmarks', JSON.stringify(updatedList));
              }
            }
          }
          // Sleep for 300ms between calls to avoid choking network
          await new Promise(r => setTimeout(r, 300));
        } catch (scrapeErr) {
          console.warn(`Scrape queue skipped url: ${item.url}`, scrapeErr);
        }
      }
      // Reload states when full scrape runs finish
      loadBookmarks();
    })();
  };

  // 11. Bookmarks Export JSON Download
  const handleExportBookmarks = () => {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nidus-bookmarks.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Categorize navigation selection filtering (supporting split comma categories and high priority filter toggles)
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      // 1. Filter by view tabs
      if (currentView === 'unsorted') {
        const cats = b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (b.is_trashed || (cats.length > 0 && !cats.includes('Unsorted'))) return false;
      } else if (currentView === 'trash') {
        if (!b.is_trashed) return false;
      } else if (currentView === 'all') {
        if (b.is_trashed) return false;
      } else {
        // Specific collection categories match (split check)
        const cats = b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : ['Unsorted'];
        if (b.is_trashed || !cats.includes(currentView)) return false;
      }

      // 2. Filter by High Priority Only toggle
      if (highPriorityOnly && b.priority !== 'High') {
        return false;
      }

      // 3. Filter by search text query (url, title, notes, tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = b.title.toLowerCase().includes(query);
        const matchesUrl = b.url.toLowerCase().includes(query);
        const matchesNotes = b.notes.toLowerCase().includes(query);
        const matchesCategory = b.category ? b.category.toLowerCase().includes(query) : false;
        return matchesTitle || matchesUrl || matchesNotes || matchesCategory;
      }

      return true;
    });
  }, [bookmarks, currentView, searchQuery, highPriorityOnly]);

  // Unique categories list (Combining custom categories and split bookmark categories)
  const categoriesList = useMemo(() => {
    const active = bookmarks.filter((b) => !b.is_trashed);
    const bookmarkCats = active.flatMap((b) => b.category ? b.category.split(',').map(s => s.trim()).filter(Boolean) : []);
    const allCats = Array.from(new Set([...customCategories, ...bookmarkCats]));
    return allCats.filter((c) => c !== 'Unsorted').concat('Unsorted');
  }, [bookmarks, customCategories]);

  // Multi-select actions helper states
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredBookmarks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBookmarks.map((b) => b.id));
    }
  };

  // Check active input focuses to ignore shortcuts
  const isInputActive = () => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true';
  };

  // Keyboard Navigation Vim Shortcuts listeners
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // 1. Open/Close Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Escape key handles universal close actions (settings, palettes, search, etc.)
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
        setIsImportExportOpen(false);
        setIsAuthOpen(false);
        setIsEditModalOpen(false);
        setIsCommandPaletteOpen(false);
        setActiveBookmark(null);
        setSearchQuery('');
        setSelectedIds([]);
        setContextMenu((prev) => ({ ...prev, visible: false }));
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      if (isInputActive()) return;

      if (isCommandPaletteOpen || isImportExportOpen) return;

      // Focus Search Bar
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Instant filter"]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // j/k selection rows
      if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (filteredBookmarks.length === 0) return;
        const currentIdx = activeBookmark
          ? filteredBookmarks.findIndex((b) => b.id === activeBookmark.id)
          : -1;
        const nextIdx = (currentIdx + 1) % filteredBookmarks.length;
        setActiveBookmark(filteredBookmarks[nextIdx]);
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (filteredBookmarks.length === 0) return;
        const currentIdx = activeBookmark
          ? filteredBookmarks.findIndex((b) => b.id === activeBookmark.id)
          : -1;
        const prevIdx = currentIdx <= 0 ? filteredBookmarks.length - 1 : currentIdx - 1;
        setActiveBookmark(filteredBookmarks[prevIdx]);
      }

      // Operations on Active Bookmark
      if (!activeBookmark) return;

      if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        window.open(activeBookmark.url, '_blank');
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        // Active bookmark is set and right panel slides out, focuses notes textarea
        const notesArea = document.querySelector('textarea[placeholder*="Write custom markdown notes"]') as HTMLTextAreaElement;
        notesArea?.focus();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleUpdateBookmark(activeBookmark.id, { is_completed: !activeBookmark.is_completed });
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleDeleteBookmark(activeBookmark.id);
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [filteredBookmarks, activeBookmark, isCommandPaletteOpen, isImportExportOpen, isSettingsOpen, isEditModalOpen]);

  return (
    <div className="flex h-full w-full overflow-hidden text-xs text-neutral-800" onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}>
      {/* Sidebar navigation container with transition animations */}
      <div
        className={`h-full border-r border-border-color bg-sidebar-bg transition-all duration-300 ease-in-out overflow-hidden flex shrink-0 md:relative absolute z-30 shadow-xl md:shadow-none ${
          isSidebarOpen ? 'w-[240px]' : 'w-0 border-r-0'
        }`}
      >
        <LeftSidebar
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            setSelectedIds([]);
          }}
          bookmarks={bookmarks}
          isDbConnected={isDbConnected}
          onOpenImportExport={() => setIsImportExportOpen(true)}
          onOpenSettings={handleOpenSettings}
          onOpenAuth={() => { window.location.href = '/login'; }}
          userEmail={userEmail}
          onCloseSidebar={() => setIsSidebarOpen(false)}
          onAddCategory={handlePromptAddCategory}
          categories={categoriesList}
        />
      </div>

      {/* Mobile backdrop shadow when sidebar is toggled open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/25 z-20 md:hidden animate-fade-in cursor-pointer"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Center Console Monitor */}
      <div className="flex-1 h-full flex flex-col min-w-0 relative">
        {/* Offline Banner when db is offline */}
        {!isDbConnected && !checkingDb && (
          <div className="bg-amber-50 border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-between text-amber-800 shrink-0 font-medium select-none animate-fade-in">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>
                <strong>Demo Mode:</strong> Running locally on local storage. Add your Supabase credentials to `.env.local` to enable cloud sync.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1 py-0.2 bg-amber-100 border border-amber-200 rounded font-mono text-[9px]">Ctrl+K</kbd>
              <span className="text-[10px] text-amber-600">Commands available</span>
            </div>
          </div>
        )}

        <CentralMonitor
          bookmarks={bookmarks}
          filteredBookmarks={filteredBookmarks}
          currentView={currentView}
          onAddBookmark={handleAddBookmark}
          onUpdateBookmark={handleUpdateBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onRestoreBookmark={handleRestoreBookmark}
          activeBookmarkId={activeBookmark ? activeBookmark.id : null}
          onSelectBookmark={(b) => setActiveBookmark(b)}
          categories={categoriesList}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onBulkComplete={handleBulkComplete}
          onBulkTrash={handleBulkTrash}
          onBulkChangeCategory={handleBulkChangeCategory}
          onBulkChangePriority={handleBulkChangePriority}
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onRowContextMenu={handleRowContextMenu}
          highPriorityOnly={highPriorityOnly}
          onToggleHighPriority={() => setHighPriorityOnly(!highPriorityOnly)}
          activeDensity={activeDensity}
          activeHighlightStyle={activeHighlightStyle}
        />
      </div>

      {/* Right Inspector Slider */}
      <InspectorPanel
        bookmark={activeBookmark}
        onClose={() => setActiveBookmark(null)}
        onUpdate={handleUpdateBookmark}
        onDelete={handleDeleteBookmark}
        onRestore={handleRestoreBookmark}
      />

      {/* Cmd+K Modal Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        bookmarks={bookmarks}
        onNavigateView={(view) => {
          setCurrentView(view);
          setSelectedIds([]);
        }}
        selectedCount={selectedIds.length}
        onBulkComplete={handleBulkComplete}
        onBulkTrash={handleBulkTrash}
        onEmptyTrash={handleEmptyTrash}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onSelectBookmark={(b) => setActiveBookmark(b)}
        onAddCategory={() => {
          const cat = prompt('Enter new Collection name:');
          if (cat && cat.trim()) {
            // Seeding category to categories list by creating a mock bookmark or assigning to active item
            if (activeBookmark) {
              handleUpdateBookmark(activeBookmark.id, { category: cat.trim() });
            } else {
              alert('Select a bookmark first to categorize it into a new Collection.');
            }
          }
        }}
      />

      {/* Import / Export Settings Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImport={handleImportBookmarks}
        onExport={handleExportBookmarks}
      />

      {/* Settings & User Manual Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userEmail={userEmail}
        isDbConnected={isDbConnected}
        onLogout={handleLogout}
        onOpenAuth={() => { window.location.href = '/login'; }}
        defaultTab={defaultSettingsTab}
        activeTheme={activeTheme}
        onSelectTheme={handleSelectTheme}
        activeFont={activeFont}
        onSelectFont={handleSelectFont}
        activeHighlightStyle={activeHighlightStyle}
        onSelectHighlightStyle={handleSelectHighlightStyle}
        activeDensity={activeDensity}
        onSelectDensity={handleSelectDensity}
        activeZoom={activeZoom}
        onSelectZoom={handleSelectZoom}
      />



      {/* Edit Bookmark Modal */}
      <EditBookmarkModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditBookmark(null);
        }}
        bookmark={editBookmark}
        onSave={handleUpdateBookmark}
        categories={categoriesList}
      />

      {/* Context Menu right click trigger */}
      {contextMenu.visible && contextMenu.bookmark && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          bookmark={contextMenu.bookmark}
          onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
          onOpenLink={() => window.open(contextMenu.bookmark!.url, '_blank')}
          onEdit={() => {
            setEditBookmark(contextMenu.bookmark);
            setIsEditModalOpen(true);
          }}
          onToggleComplete={() =>
            handleUpdateBookmark(contextMenu.bookmark!.id, {
              is_completed: !contextMenu.bookmark!.is_completed,
            })
          }
          onDelete={() => handleDeleteBookmark(contextMenu.bookmark!.id)}
        />
      )}
    </div>
  );
}
