'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Archive, Plus, Search, X, ChevronDown, ChevronRight,
  ExternalLink, Copy, Check, Trash2, Edit2, GripVertical,
  Link as LinkIcon, ClipboardPaste, MoreHorizontal, RefreshCw, Clock, Globe,
  Upload, Download, FileText, CheckCircle, AlertTriangle, Folder, FolderOpen, FolderPlus,
  CheckSquare, Square
} from 'lucide-react';
import { VaultSection, VaultLink } from '../lib/types';

const STORAGE_KEY = 'nidus_vault_sections';

const SECTION_COLORS = [
  { id: 'emerald', dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', header: 'bg-emerald-500/10' },
  { id: 'blue', dot: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', header: 'bg-blue-500/10' },
  { id: 'purple', dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', header: 'bg-purple-500/10' },
  { id: 'amber', dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', header: 'bg-amber-500/10' },
  { id: 'rose', dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', header: 'bg-rose-500/10' },
  { id: 'cyan', dot: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', header: 'bg-cyan-500/10' },
  { id: 'neutral', dot: 'bg-neutral-500', bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-neutral-700', header: 'bg-neutral-500/10' },
];

function getColorConfig(colorId: string) {
  return SECTION_COLORS.find((c) => c.id === colorId) || SECTION_COLORS[0];
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Count all links in a section including all recursive subsections
function countTotalSectionLinks(section: VaultSection): number {
  let count = section.links.length;
  if (section.subsections && section.subsections.length > 0) {
    section.subsections.forEach((sub) => {
      count += countTotalSectionLinks(sub);
    });
  }
  return count;
}

// Gather all link IDs recursively in a section
function getAllSectionLinkIds(section: VaultSection): string[] {
  const ids = section.links.map((l) => l.id);
  if (section.subsections && section.subsections.length > 0) {
    section.subsections.forEach((sub) => {
      ids.push(...getAllSectionLinkIds(sub));
    });
  }
  return ids;
}

interface ScrapedMetadata {
  title: string;
  description: string | null;
  domain: string;
  thumbnail_url: string | null;
  favicon_url: string | null;
  read_time_minutes: number;
}

interface LinkVaultProps {
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

export default function LinkVault({ isSidebarOpen, onOpenSidebar }: LinkVaultProps) {
  const [sections, setSections] = useState<VaultSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [scrapingLinkIds, setScrapingLinkIds] = useState<Set<string>>(new Set());
  const [scrapingProgress, setScrapingProgress] = useState<{ current: number; total: number } | null>(null);

  // Bulk Selection State
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());

  // Top Section creation
  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionColor, setNewSectionColor] = useState('emerald');
  const newSectionInputRef = useRef<HTMLInputElement>(null);

  // Subfolder creation inside an existing section/subfolder
  const [creatingSubfolderTargetId, setCreatingSubfolderTargetId] = useState<string | null>(null);
  const [newSubfolderTitle, setNewSubfolderTitle] = useState('');
  const subfolderInputRef = useRef<HTMLInputElement>(null);

  // Link adding
  const [addingLinkToSection, setAddingLinkToSection] = useState<string | null>(null);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const addLinkInputRef = useRef<HTMLInputElement>(null);

  // Bulk paste
  const [bulkPasteSection, setBulkPasteSection] = useState<string | null>(null);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Import Modal & State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'saving' | 'success' | 'error'>('idle');
  const [importStats, setImportStats] = useState<{ sectionsCount: number; linksCount: number }>({ sectionsCount: 0, linksCount: 0 });
  const [importError, setImportError] = useState('');
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Section rename
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Section context menu
  const [sectionMenu, setSectionMenu] = useState<string | null>(null);

  // Section delete confirmation
  const [sectionToDelete, setSectionToDelete] = useState<VaultSection | null>(null);

  // Drag state for top-level sections
  const [draggedSectionIdx, setDraggedSectionIdx] = useState<number | null>(null);
  const [dragOverSectionIdx, setDragOverSectionIdx] = useState<number | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSections(parsed);
        }
      }
    } catch (e) {}
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveSections = useCallback((updated: VaultSection[]) => {
    setSections(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  }, []);

  // ── Scraper Helper (POST /api/scrape) ─────────────────────────

  const fetchLinkMetadata = async (rawUrl: string): Promise<ScrapedMetadata> => {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || getDomain(url),
          description: data.description || null,
          domain: data.domain || getDomain(url),
          thumbnail_url: null,
          favicon_url: data.faviconUrl || getFaviconUrl(url),
          read_time_minutes: data.readTimeMinutes || 1,
        };
      }
    } catch (e) {
      console.warn(`Scrape failed for ${url}:`, e);
    }

    return {
      title: getDomain(url),
      description: null,
      domain: getDomain(url),
      thumbnail_url: null,
      favicon_url: getFaviconUrl(url),
      read_time_minutes: 1,
    };
  };

  // ── Recursive Section Tree Helpers ────────────────────────────

  const updateSectionInTree = (
    tree: VaultSection[],
    targetId: string,
    updater: (sec: VaultSection) => VaultSection
  ): VaultSection[] => {
    return tree.map((sec) => {
      if (sec.id === targetId) {
        return updater(sec);
      }
      if (sec.subsections && sec.subsections.length > 0) {
        return {
          ...sec,
          subsections: updateSectionInTree(sec.subsections, targetId, updater),
        };
      }
      return sec;
    });
  };

  const deleteSectionFromTree = (tree: VaultSection[], targetId: string): VaultSection[] => {
    return tree
      .filter((sec) => sec.id !== targetId)
      .map((sec) => ({
        ...sec,
        subsections: sec.subsections ? deleteSectionFromTree(sec.subsections, targetId) : [],
      }));
  };

  const updateLinkInTree = (
    tree: VaultSection[],
    linkId: string,
    updater: (link: VaultLink) => VaultLink
  ): VaultSection[] => {
    return tree.map((sec) => ({
      ...sec,
      links: sec.links.map((l) => (l.id === linkId ? updater(l) : l)),
      subsections: sec.subsections ? updateLinkInTree(sec.subsections, linkId, updater) : [],
    }));
  };

  const deleteLinkInTree = (tree: VaultSection[], linkId: string): VaultSection[] => {
    return tree.map((sec) => ({
      ...sec,
      links: sec.links.filter((l) => l.id !== linkId),
      subsections: sec.subsections ? deleteLinkInTree(sec.subsections, linkId) : [],
    }));
  };

  // ── Bulk Selection & Delete Handlers ──────────────────────────

  const toggleSelectLink = (linkId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) {
        next.delete(linkId);
      } else {
        next.add(linkId);
      }
      return next;
    });
  };

  const toggleSelectSectionLinks = (section: VaultSection) => {
    const sectionLinkIds = getAllSectionLinkIds(section);
    const allSelected = sectionLinkIds.every((id) => selectedLinkIds.has(id));

    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        sectionLinkIds.forEach((id) => next.delete(id));
      } else {
        sectionLinkIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDeleteSelected = () => {
    if (selectedLinkIds.size === 0) return;
    const idsToDelete = new Set(selectedLinkIds);

    const removeSelected = (tree: VaultSection[]): VaultSection[] => {
      return tree.map((sec) => ({
        ...sec,
        links: sec.links.filter((l) => !idsToDelete.has(l.id)),
        subsections: sec.subsections ? removeSelected(sec.subsections) : [],
      }));
    };

    const updated = removeSelected(sections);
    saveSections(updated);
    setSelectedLinkIds(new Set());
  };

  const handleDeleteAllSectionLinks = (sectionId: string) => {
    const updated = updateSectionInTree(sections, sectionId, (sec) => ({
      ...sec,
      links: [],
      updated_at: new Date().toISOString(),
    }));
    saveSections(updated);
    setSectionMenu(null);
  };

  // ── Bulletproof Native DOM Parser for Nested Bookmarks ────────

  interface ParsedFolderNode {
    title: string;
    links: { url: string; title: string }[];
    subfolders: ParsedFolderNode[];
  }

  const parseBookmarkDOMTree = (htmlText: string): ParsedFolderNode[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Helper to crawl a DL element recursively
    const crawlDL = (dlElement: Element): ParsedFolderNode[] => {
      const result: ParsedFolderNode[] = [];
      const children = Array.from(dlElement.children);

      let currentLinksBucket: { url: string; title: string }[] = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.tagName === 'DT') {
          const h3 = child.querySelector(':scope > h3') || child.querySelector('h3');
          const a = child.querySelector(':scope > a') || child.querySelector('a');
          const innerDL = child.querySelector(':scope > dl') || child.querySelector('dl') ||
                          (child.nextElementSibling?.tagName === 'DL' ? child.nextElementSibling : null);

          if (h3) {
            const folderName = (h3.textContent || 'Folder').trim();
            const subTree = innerDL ? crawlDL(innerDL) : [];

            // Collect direct links inside innerDL (links not inside a sub-DT with H3)
            const directFolderLinks: { url: string; title: string }[] = [];
            if (innerDL) {
              const subDTs = Array.from(innerDL.children).filter((el) => el.tagName === 'DT');
              subDTs.forEach((subDT) => {
                const subH3 = subDT.querySelector(':scope > h3') || subDT.querySelector('h3');
                const subA = subDT.querySelector(':scope > a') || subDT.querySelector('a');
                if (subA && !subH3) {
                  const href = subA.getAttribute('href') || '';
                  if (href.startsWith('http://') || href.startsWith('https://')) {
                    directFolderLinks.push({ url: href, title: (subA.textContent || href).trim() });
                  }
                }
              });
            }

            result.push({
              title: folderName,
              links: directFolderLinks,
              subfolders: subTree,
            });
          } else if (a) {
            const href = a.getAttribute('href') || '';
            if (href.startsWith('http://') || href.startsWith('https://')) {
              currentLinksBucket.push({ url: href, title: (a.textContent || href).trim() });
            }
          }
        } else if (child.tagName === 'A') {
          const href = child.getAttribute('href') || '';
          if (href.startsWith('http://') || href.startsWith('https://')) {
            currentLinksBucket.push({ url: href, title: (child.textContent || href).trim() });
          }
        } else if (child.tagName === 'DL') {
          const sub = crawlDL(child);
          result.push(...sub);
        }
      }

      if (currentLinksBucket.length > 0) {
        result.unshift({
          title: 'General Bookmarks',
          links: currentLinksBucket,
          subfolders: [],
        });
      }

      return result;
    };

    const rootDL = doc.querySelector('dl');
    if (!rootDL) {
      const allAnchors = Array.from(doc.querySelectorAll('a'))
        .map((a) => ({ url: a.getAttribute('href') || '', title: (a.textContent || a.getAttribute('href') || '').trim() }))
        .filter((l) => l.url.startsWith('http://') || l.url.startsWith('https://'));

      return [{ title: 'Imported Links', links: allAnchors, subfolders: [] }];
    }

    const rawTree = crawlDL(rootDL);

    // Unwrap generic top browser wrappers like "Bookmarks bar", "Bookmarks", "Bookmarks menu"
    const unwrapGenericRoots = (nodes: ParsedFolderNode[]): ParsedFolderNode[] => {
      const unwrapped: ParsedFolderNode[] = [];
      nodes.forEach((node) => {
        const lower = node.title.toLowerCase();
        if (
          lower === 'bookmarks bar' ||
          lower === 'bookmarks menu' ||
          lower === 'other bookmarks' ||
          lower === 'synced bookmarks' ||
          lower === 'mobile bookmarks' ||
          lower === 'bookmarks'
        ) {
          if (node.subfolders.length > 0) {
            if (node.links.length > 0) {
              unwrapped.push({ title: 'General Bookmarks', links: node.links, subfolders: [] });
            }
            unwrapped.push(...node.subfolders);
          } else {
            unwrapped.push(node);
          }
        } else {
          unwrapped.push(node);
        }
      });
      return unwrapped;
    };

    return unwrapGenericRoots(rawTree);
  };

  const convertParsedTreeToVault = (
    nodes: ParsedFolderNode[],
    allNewLinks: { sectionId: string; linkId: string; url: string }[],
    depth = 0
  ): VaultSection[] => {
    return nodes.map((node, idx) => {
      const sectionId = generateId('vsec');
      const color = SECTION_COLORS[(depth + idx) % SECTION_COLORS.length].id;

      const links: VaultLink[] = node.links.map((l) => {
        const linkId = generateId('vlink');
        allNewLinks.push({ sectionId, linkId, url: l.url });
        return {
          id: linkId,
          url: l.url,
          title: l.title || getDomain(l.url),
          description: null,
          domain: getDomain(l.url),
          favicon_url: getFaviconUrl(l.url),
          read_time_minutes: 1,
          created_at: new Date().toISOString(),
        };
      });

      const subsections = convertParsedTreeToVault(node.subfolders, allNewLinks, depth + 1);

      return {
        id: sectionId,
        title: node.title,
        color,
        links,
        subsections,
        is_collapsed: false,
        position: idx,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  };

  const parseJSONBookmarksTree = (
    data: any,
    allNewLinks: { sectionId: string; linkId: string; url: string }[],
    depth = 0
  ): VaultSection[] => {
    const sectionsResult: VaultSection[] = [];

    const processFolder = (name: string, children: any[]): VaultSection => {
      const sectionId = generateId('vsec');
      const color = SECTION_COLORS[(depth + sectionsResult.length) % SECTION_COLORS.length].id;
      const links: VaultLink[] = [];
      const subSections: VaultSection[] = [];

      children.forEach((child) => {
        if (child.url) {
          const linkId = generateId('vlink');
          allNewLinks.push({ sectionId, linkId, url: child.url });
          links.push({
            id: linkId,
            url: child.url,
            title: child.name || child.title || getDomain(child.url),
            description: null,
            domain: getDomain(child.url),
            favicon_url: getFaviconUrl(child.url),
            read_time_minutes: 1,
            created_at: new Date().toISOString(),
          });
        } else if (child.children || child.type === 'folder') {
          const sub = processFolder(child.name || child.title || 'Subfolder', child.children || []);
          subSections.push(sub);
        }
      });

      return {
        id: sectionId,
        title: name,
        color,
        links,
        subsections: subSections,
        is_collapsed: false,
        position: sectionsResult.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    };

    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item.children) {
          sectionsResult.push(processFolder(item.name || item.title || 'Bookmarks', item.children));
        } else if (item.url) {
          const linkId = generateId('vlink');
          const secId = generateId('vsec');
          allNewLinks.push({ sectionId: secId, linkId, url: item.url });
          sectionsResult.push({
            id: secId,
            title: item.category || 'Imported Links',
            color: SECTION_COLORS[0].id,
            links: [{
              id: linkId,
              url: item.url,
              title: item.title || item.name || getDomain(item.url),
              description: null,
              domain: getDomain(item.url),
              favicon_url: getFaviconUrl(item.url),
              read_time_minutes: 1,
              created_at: new Date().toISOString(),
            }],
            subsections: [],
            is_collapsed: false,
            position: sectionsResult.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      });
    } else if (data.roots) {
      Object.keys(data.roots).forEach((key) => {
        const root = data.roots[key];
        if (root && root.children) {
          sectionsResult.push(processFolder(root.name || key, root.children));
        }
      });
    } else if (data.children) {
      sectionsResult.push(processFolder(data.name || 'Bookmarks', data.children));
    }

    return sectionsResult;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('parsing');
    setImportError('');

    try {
      const text = await file.text();
      const allNewLinks: { sectionId: string; linkId: string; url: string }[] = [];
      let importedSections: VaultSection[] = [];

      if (file.name.endsWith('.html') || file.name.endsWith('.htm') || text.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>') || text.includes('<H3')) {
        const parsedTree = parseBookmarkDOMTree(text);
        importedSections = convertParsedTreeToVault(parsedTree, allNewLinks);
      } else if (file.name.endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
        const jsonData = JSON.parse(text);
        importedSections = parseJSONBookmarksTree(jsonData, allNewLinks);
      } else {
        const urls = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

        const secId = generateId('vsec');
        const links: VaultLink[] = urls.map((url) => {
          const linkId = generateId('vlink');
          allNewLinks.push({ sectionId: secId, linkId, url });
          return {
            id: linkId,
            url,
            title: getDomain(url),
            description: null,
            domain: getDomain(url),
            favicon_url: getFaviconUrl(url),
            read_time_minutes: 1,
            created_at: new Date().toISOString(),
          };
        });

        importedSections = [{
          id: secId,
          title: 'Imported Links',
          color: 'emerald',
          links,
          subsections: [],
          is_collapsed: false,
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
      }

      if (importedSections.length === 0) {
        throw new Error('No valid bookmarks or folders found in the uploaded file.');
      }

      setImportStatus('saving');

      // Merge new sections with existing sections
      const updatedSections = [...sections, ...importedSections].map((s, idx) => ({ ...s, position: idx }));
      saveSections(updatedSections);

      const totalLinksImported = allNewLinks.length;
      setImportStats({ sectionsCount: importedSections.length, linksCount: totalLinksImported });
      setImportStatus('success');

      // Trigger background metadata scraper
      if (allNewLinks.length > 0) {
        runBackgroundScraper(allNewLinks, updatedSections);
      }
    } catch (err: any) {
      setImportStatus('error');
      setImportError(err.message || 'Failed to parse bookmarks file.');
    }
  };

  // Background Scraper Queue for all imported/bulk links
  const runBackgroundScraper = async (
    items: { sectionId: string; linkId: string; url: string }[],
    initialSections: VaultSection[]
  ) => {
    setScrapingProgress({ current: 0, total: items.length });
    let currentSections = initialSections;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setScrapingLinkIds((prev) => new Set(prev).add(item.linkId));
      setScrapingProgress({ current: i + 1, total: items.length });

      try {
        const meta = await fetchLinkMetadata(item.url);
        currentSections = updateLinkInTree(currentSections, item.linkId, (l) => ({
          ...l,
          title: meta.title || l.title,
          description: meta.description || l.description,
          domain: meta.domain || l.domain,
          favicon_url: meta.favicon_url || l.favicon_url,
          read_time_minutes: meta.read_time_minutes || l.read_time_minutes,
        }));
        saveSections(currentSections);
      } catch (err) {}

      setScrapingLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(item.linkId);
        return next;
      });
    }

    setScrapingProgress(null);
  };

  // ── Export Vault ──────────────────────────────────────────────

  const handleExportVault = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sections, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nidus-link-vault-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // ── Section & Subfolder CRUD ──────────────────────────────────

  const handleCreateTopSection = () => {
    if (!newSectionTitle.trim()) return;
    const newSection: VaultSection = {
      id: generateId('vsec'),
      title: newSectionTitle.trim(),
      color: newSectionColor,
      links: [],
      subsections: [],
      is_collapsed: false,
      position: sections.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveSections([...sections, newSection]);
    setNewSectionTitle('');
    setNewSectionColor('emerald');
    setIsCreatingSection(false);
  };

  const handleCreateSubfolder = (parentSectionId: string) => {
    if (!newSubfolderTitle.trim()) return;
    const newSubfolder: VaultSection = {
      id: generateId('vsec'),
      title: newSubfolderTitle.trim(),
      color: 'neutral',
      links: [],
      subsections: [],
      is_collapsed: false,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = updateSectionInTree(sections, parentSectionId, (sec) => ({
      ...sec,
      subsections: [...(sec.subsections || []), newSubfolder],
      is_collapsed: false,
      updated_at: new Date().toISOString(),
    }));

    saveSections(updated);
    setNewSubfolderTitle('');
    setCreatingSubfolderTargetId(null);
  };

  const handleDeleteSection = () => {
    if (!sectionToDelete) return;
    saveSections(deleteSectionFromTree(sections, sectionToDelete.id));
    setSectionToDelete(null);
  };

  const handleRenameSection = (id: string) => {
    if (!renameValue.trim()) return;
    saveSections(
      updateSectionInTree(sections, id, (sec) => ({
        ...sec,
        title: renameValue.trim(),
        updated_at: new Date().toISOString(),
      }))
    );
    setRenamingSectionId(null);
    setRenameValue('');
  };

  const handleToggleCollapse = (id: string) => {
    saveSections(
      updateSectionInTree(sections, id, (sec) => ({
        ...sec,
        is_collapsed: !sec.is_collapsed,
      }))
    );
  };

  // ── Link CRUD ─────────────────────────────────────────────────

  const handleAddLink = async (sectionId: string) => {
    const rawUrl = newLinkUrl.trim();
    if (!rawUrl) return;

    let url = rawUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setIsFetchingTitle(true);
    const metadata = await fetchLinkMetadata(url);

    const newLink: VaultLink = {
      id: generateId('vlink'),
      url,
      title: metadata.title,
      description: metadata.description,
      domain: metadata.domain,
      favicon_url: metadata.favicon_url,
      read_time_minutes: metadata.read_time_minutes,
      created_at: new Date().toISOString(),
    };

    saveSections(
      updateSectionInTree(sections, sectionId, (sec) => ({
        ...sec,
        links: [...sec.links, newLink],
        updated_at: new Date().toISOString(),
      }))
    );
    setNewLinkUrl('');
    setIsFetchingTitle(false);
  };

  const handleBulkPaste = async (sectionId: string) => {
    const lines = bulkPasteText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;
    setIsBulkAdding(true);

    const initialLinks: VaultLink[] = [];
    const rawUrlMap: { sectionId: string; linkId: string; url: string }[] = [];

    for (const line of lines) {
      let url = line;
      const urlMatch = line.match(/(?:https?:\/\/)?[\w.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
      if (urlMatch) {
        url = urlMatch[0];
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const bulletParts = line.split(/[•\-–—]/).map((p) => p.trim());
      const desc = bulletParts.length > 1 ? bulletParts.slice(1).join(' • ') : undefined;

      const linkId = generateId('vlink');
      initialLinks.push({
        id: linkId,
        url,
        title: getDomain(url),
        description: desc || null,
        domain: getDomain(url),
        favicon_url: getFaviconUrl(url),
        read_time_minutes: 1,
        created_at: new Date().toISOString(),
      });
      rawUrlMap.push({ sectionId, linkId, url });
    }

    const updatedWithInitial = updateSectionInTree(sections, sectionId, (sec) => ({
      ...sec,
      links: [...sec.links, ...initialLinks],
      updated_at: new Date().toISOString(),
    }));

    saveSections(updatedWithInitial);
    setBulkPasteText('');
    setBulkPasteSection(null);
    setIsBulkAdding(false);

    // Background scrape queue
    runBackgroundScraper(rawUrlMap, updatedWithInitial);
  };

  const handleRescrapeLink = async (linkId: string, url: string) => {
    setScrapingLinkIds((prev) => new Set(prev).add(linkId));
    try {
      const meta = await fetchLinkMetadata(url);
      saveSections(
        updateLinkInTree(sections, linkId, (l) => ({
          ...l,
          title: meta.title,
          description: meta.description,
          domain: meta.domain,
          favicon_url: meta.favicon_url,
          read_time_minutes: meta.read_time_minutes,
        }))
      );
    } catch (err) {}
    setScrapingLinkIds((prev) => {
      const next = new Set(prev);
      next.delete(linkId);
      return next;
    });
  };

  const handleDeleteLink = (linkId: string) => {
    saveSections(deleteLinkInTree(sections, linkId));
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      next.delete(linkId);
      return next;
    });
  };

  const handleCopyLink = (linkId: string, url: string) => {
    try { navigator.clipboard.writeText(url); } catch (e) {}
    setCopiedLinkId(linkId);
    setTimeout(() => setCopiedLinkId(null), 1500);
  };

  // ── Drag & Drop for Top-Level Sections ────────────────────────

  const handleSectionDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedSectionIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSectionIdx(idx);
  };

  const handleSectionDrop = (dropIdx: number) => {
    if (draggedSectionIdx === null || draggedSectionIdx === dropIdx) {
      setDraggedSectionIdx(null);
      setDragOverSectionIdx(null);
      return;
    }
    const reordered = [...sections];
    const [moved] = reordered.splice(draggedSectionIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    saveSections(reordered.map((s, i) => ({ ...s, position: i })));
    setDraggedSectionIdx(null);
    setDragOverSectionIdx(null);
  };

  // ── Recursive Filtering ───────────────────────────────────────

  const filterSectionTree = (section: VaultSection, query: string): VaultSection | null => {
    const q = query.toLowerCase();
    const matchesSection = section.title.toLowerCase().includes(q);

    const matchingLinks = section.links.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.domain || '').toLowerCase().includes(q)
    );

    const matchingSubsections = (section.subsections || [])
      .map((sub) => filterSectionTree(sub, query))
      .filter(Boolean) as VaultSection[];

    if (matchesSection) {
      return { ...section, is_collapsed: false };
    }
    if (matchingLinks.length > 0 || matchingSubsections.length > 0) {
      return {
        ...section,
        links: matchingLinks.length > 0 ? matchingLinks : section.links,
        subsections: matchingSubsections,
        is_collapsed: false,
      };
    }
    return null;
  };

  const filteredSections = searchQuery
    ? (sections.map((s) => filterSectionTree(s, searchQuery)).filter(Boolean) as VaultSection[])
    : sections;

  const totalLinks = sections.reduce((sum, s) => sum + countTotalSectionLinks(s), 0);

  // ── Focus Refs ────────────────────────────────────────────────

  useEffect(() => {
    if (isCreatingSection && newSectionInputRef.current) {
      newSectionInputRef.current.focus();
    }
  }, [isCreatingSection]);

  useEffect(() => {
    if (creatingSubfolderTargetId && subfolderInputRef.current) {
      subfolderInputRef.current.focus();
    }
  }, [creatingSubfolderTargetId]);

  useEffect(() => {
    if (addingLinkToSection && addLinkInputRef.current) {
      addLinkInputRef.current.focus();
    }
  }, [addingLinkToSection]);

  useEffect(() => {
    if (renamingSectionId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingSectionId]);

  if (!isLoaded) return null;

  // ── Recursive Section & Subfolder Renderer ────────────────────

  const renderSectionCard = (section: VaultSection, depth = 0) => {
    const colorCfg = getColorConfig(section.color);
    const isCollapsed = section.is_collapsed;
    const isTopLevel = depth === 0;
    const totalCount = countTotalSectionLinks(section);
    const hasSubsections = section.subsections && section.subsections.length > 0;
    const allSecLinkIds = getAllSectionLinkIds(section);
    const areAllSelected = allSecLinkIds.length > 0 && allSecLinkIds.every((id) => selectedLinkIds.has(id));

    return (
      <div
        key={section.id}
        className={`bg-white border rounded-lg shadow-xs overflow-hidden transition-all ${
          isTopLevel ? 'border-neutral-200 mb-3' : 'border-neutral-200/80 my-2 ml-3 sm:ml-5 border-l-2'
        }`}
        style={!isTopLevel ? { borderLeftColor: 'var(--accent-color, #ff6600)' } : undefined}
      >
        {/* Section Header */}
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${
            isTopLevel ? colorCfg.header : 'bg-neutral-50/90'
          } border-b border-neutral-100 hover:bg-neutral-100/70 transition-all`}
          onClick={() => handleToggleCollapse(section.id)}
        >
          {isTopLevel ? (
            <>
              <GripVertical className="w-3.5 h-3.5 text-neutral-300 shrink-0 cursor-grab" />
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorCfg.dot}`} />
            </>
          ) : (
            <div className="flex items-center text-neutral-500 shrink-0">
              {isCollapsed ? <Folder className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5 text-amber-500" />}
            </div>
          )}

          {renamingSectionId === section.id ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSection(section.id);
                if (e.key === 'Escape') setRenamingSectionId(null);
              }}
              onBlur={() => handleRenameSection(section.id)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-xs font-bold bg-white border border-neutral-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          ) : (
            <span className={`flex-1 text-xs font-bold ${isTopLevel ? 'text-neutral-800' : 'text-neutral-700'} truncate`}>
              {section.title}
            </span>
          )}

          {/* Badge count */}
          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}`}>
            {totalCount}
          </span>

          {/* Context 3-dots Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSectionMenu(sectionMenu === section.id ? null : section.id);
              }}
              className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-600 cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {sectionMenu === section.id && (
              <div
                className="absolute right-0 top-7 z-30 w-44 bg-white border border-neutral-200 rounded-md shadow-xl py-1 text-xs font-semibold animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCreatingSubfolderTargetId(section.id);
                    setNewSubfolderTitle('');
                    setSectionMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer text-neutral-700"
                >
                  <FolderPlus className="w-3 h-3 text-neutral-400" /> Add Subfolder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleSelectSectionLinks(section);
                    setSectionMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer text-neutral-700"
                >
                  <CheckSquare className="w-3 h-3 text-neutral-400" /> {areAllSelected ? 'Deselect Links' : 'Select All Links'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingSectionId(section.id);
                    setRenameValue(section.title);
                    setSectionMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer text-neutral-700"
                >
                  <Edit2 className="w-3 h-3 text-neutral-400" /> Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkPasteSection(section.id);
                    setSectionMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2 text-left cursor-pointer text-neutral-700"
                >
                  <ClipboardPaste className="w-3 h-3 text-neutral-400" /> Bulk Paste Links
                </button>
                {section.links.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAllSectionLinks(section.id)}
                    className="w-full px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-left text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" /> Clear All Links
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSectionToDelete(section);
                    setSectionMenu(null);
                  }}
                  className="w-full px-3 py-1.5 hover:bg-red-50 flex items-center gap-2 text-left text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-red-500" /> Delete {isTopLevel ? 'Section' : 'Folder'}
                </button>
              </div>
            )}
          </div>

          {/* Expand/Collapse Chevron */}
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
        </div>

        {/* Section Body (Expanded) */}
        {!isCollapsed && (
          <div className="divide-y divide-neutral-100">
            {/* Inline Subfolder Creation Form */}
            {creatingSubfolderTargetId === section.id && (
              <div className="px-3 py-2 bg-amber-50/50 border-b border-amber-200/60 flex items-center gap-2 animate-fade-in">
                <FolderPlus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <input
                  ref={subfolderInputRef}
                  type="text"
                  value={newSubfolderTitle}
                  onChange={(e) => setNewSubfolderTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubfolder(section.id);
                    if (e.key === 'Escape') setCreatingSubfolderTargetId(null);
                  }}
                  placeholder="Subfolder name (e.g. Related Stuff)..."
                  className="flex-1 text-xs bg-white border border-neutral-300 rounded px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => handleCreateSubfolder(section.id)}
                  disabled={!newSubfolderTitle.trim()}
                  className="px-2.5 py-1 text-xs font-bold bg-neutral-900 text-white rounded cursor-pointer disabled:opacity-40"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingSubfolderTargetId(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Nested Subsections / Subfolders */}
            {hasSubsections && (
              <div className="p-1.5 sm:p-2 bg-neutral-50/30">
                {section.subsections!.map((sub) => renderSectionCard(sub, depth + 1))}
              </div>
            )}

            {/* Direct Links in This Section/Folder */}
            {section.links.map((link) => {
              const isScrapingThis = scrapingLinkIds.has(link.id);
              const isSelected = selectedLinkIds.has(link.id);

              return (
                <div
                  key={link.id}
                  className={`flex items-start gap-2.5 px-3 py-2 transition-all ${
                    isSelected ? 'bg-indigo-50/60' : 'hover:bg-neutral-50/80'
                  } group`}
                >
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => toggleSelectLink(link.id, e)}
                    className="mt-0.5 text-neutral-400 hover:text-indigo-600 cursor-pointer shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-neutral-300 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>

                  {/* Favicon */}
                  <div className="mt-0.5 shrink-0">
                    {link.favicon_url ? (
                      <img
                        src={link.favicon_url}
                        alt=""
                        className="w-4 h-4 rounded shrink-0 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-neutral-300" />
                    )}
                  </div>

                  {/* Clean Text Typography: Title, Domain, Read Time, Description (NO blurry thumbnail) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-neutral-900 hover:text-indigo-600 transition-colors truncate max-w-full"
                      >
                        {link.title || getDomain(link.url)}
                      </a>
                      {link.domain && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-neutral-100 border border-neutral-200 text-neutral-500 rounded text-[9px] font-medium shrink-0">
                          <Globe className="w-2.5 h-2.5 text-neutral-400" />
                          {link.domain}
                        </span>
                      )}
                      {link.read_time_minutes ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-neutral-50 border border-neutral-200 text-neutral-400 rounded text-[9px] shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {link.read_time_minutes} min
                        </span>
                      ) : null}
                    </div>

                    {/* Scraped Description (clean subtitle) */}
                    {link.description && (
                      <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed font-normal">
                        {link.description}
                      </p>
                    )}

                    <div className="text-[10px] text-neutral-400 mt-0.5 truncate font-mono">
                      {link.url}
                    </div>
                  </div>

                  {/* Link Hover Action Buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      title="Open Link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link.id, link.url)}
                      className="p-1 hover:bg-neutral-200/60 rounded text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      title="Copy Link"
                    >
                      {copiedLinkId === link.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRescrapeLink(link.id, link.url)}
                      disabled={isScrapingThis}
                      className="p-1 hover:bg-indigo-100 rounded text-neutral-400 hover:text-indigo-600 cursor-pointer disabled:opacity-50"
                      title="Re-scrape Metadata"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScrapingThis ? 'animate-spin text-indigo-500' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-1 hover:bg-red-100 rounded text-neutral-400 hover:text-red-600 cursor-pointer"
                      title="Remove Link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty Folder State */}
            {section.links.length === 0 && (!section.subsections || section.subsections.length === 0) && (
              <div className="px-4 py-5 text-center text-neutral-400">
                <Folder className="w-5 h-5 mx-auto mb-1.5 text-neutral-300" />
                <p className="text-xs font-medium">Empty folder. Add links or subfolders below.</p>
              </div>
            )}

            {/* Add Link / Subfolder Action Row */}
            {addingLinkToSection === section.id ? (
              <div className="px-3 py-2 bg-neutral-50/80 flex items-center gap-2">
                <LinkIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  ref={addLinkInputRef}
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddLink(section.id);
                    if (e.key === 'Escape') { setAddingLinkToSection(null); setNewLinkUrl(''); }
                  }}
                  placeholder="Paste URL and press Enter (scraping metadata)..."
                  className="flex-1 text-xs bg-white border border-neutral-200 rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  disabled={isFetchingTitle}
                />
                {isFetchingTitle && (
                  <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scraping...</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setAddingLinkToSection(null); setNewLinkUrl(''); }}
                  className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 flex items-center gap-2.5 flex-wrap bg-white">
                <button
                  type="button"
                  onClick={() => setAddingLinkToSection(section.id)}
                  className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Link
                </button>
                <span className="text-neutral-200">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingSubfolderTargetId(section.id);
                    setNewSubfolderTitle('');
                  }}
                  className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" /> Add Subfolder
                </button>
                <span className="text-neutral-200">|</span>
                <button
                  type="button"
                  onClick={() => setBulkPasteSection(section.id)}
                  className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-700 flex items-center gap-1 cursor-pointer"
                >
                  <ClipboardPaste className="w-3 h-3" /> Bulk Paste
                </button>
              </div>
            )}

            {/* Bulk Paste Modal (inline) */}
            {bulkPasteSection === section.id && (
              <div className="px-3 py-3 bg-neutral-50/80 border-t border-neutral-100 animate-fade-in">
                <h4 className="text-[11px] font-bold text-neutral-700 mb-1 flex items-center gap-1">
                  <ClipboardPaste className="w-3 h-3" /> Bulk Paste Links into {section.title}
                </h4>
                <p className="text-[10px] text-neutral-400 mb-2">
                  Paste links (one per line). All rich metadata, titles, and descriptions will be scraped automatically!
                </p>
                <textarea
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder={"Paste one URL per line:\nraphael.ai\nkrea.ai\nmagnific.ai\n\nOr paste with descriptions:\n1. raphael.ai • unlimited AI image generation\n2. krea.ai • generate images in real time as you draw\n3. magnific.ai • AI image upscaling"}
                  rows={5}
                  className="w-full text-xs bg-white border border-neutral-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none font-mono"
                />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setBulkPasteSection(null); setBulkPasteText(''); }}
                    className="px-3 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-200 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPaste(section.id)}
                    disabled={!bulkPasteText.trim() || isBulkAdding}
                    className="px-3 py-1 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isBulkAdding && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Add {bulkPasteText.split('\n').filter((l) => l.trim()).length} Links & Scrape Info
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none">

      {/* ── Top Header Bar ── */}
      <div className="min-h-[52px] py-2 px-3 sm:px-4 bg-white/95 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs z-20">
        <div className="flex items-center gap-2.5 shrink-0">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer mr-0.5"
              title="Open Sidebar"
            >
              <Archive className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Archive className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--accent-color)' }} />
            <h1 className="font-bold text-sm text-neutral-900 tracking-tight">Link Vault</h1>
            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded-full text-[10px] font-bold text-neutral-600">
              {totalLinks} links
            </span>
            {scrapingProgress && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[10px] font-bold text-indigo-700 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Scraping {scrapingProgress.current}/{scrapingProgress.total}...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input with Non-Overlapping Icon */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search links..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-7 py-1 bg-neutral-100 border border-neutral-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 w-36 sm:w-48 transition-all"
              style={{ paddingLeft: '2.25rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Import Bookmarks Button */}
          <button
            type="button"
            onClick={() => {
              setImportStatus('idle');
              setImportError('');
              setIsImportModalOpen(true);
            }}
            className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
            title="Import browser bookmark files (.html or .json) and organize into nested Vault sections"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Import Bookmarks</span>
          </button>

          {/* Export Vault Button */}
          {sections.length > 0 && (
            <button
              type="button"
              onClick={handleExportVault}
              className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
              title="Export Link Vault as JSON backup"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* New Section Button */}
          <button
            type="button"
            onClick={() => setIsCreatingSection(true)}
            className="px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Section</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable Sections Container ── */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-neutral-50/50 pb-20">

        {/* New Top-Level Section Form */}
        {isCreatingSection && (
          <div className="mb-4 bg-white border border-neutral-200 rounded-lg p-4 shadow-xs animate-fade-in">
            <h3 className="font-bold text-xs text-neutral-700 mb-3 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create New Section
            </h3>
            <input
              ref={newSectionInputRef}
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTopSection()}
              placeholder="Section name (e.g. Free AI Tools)"
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3"
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-neutral-500 font-semibold">Color:</span>
              {SECTION_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewSectionColor(c.id)}
                  className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${c.dot} ${
                    newSectionColor === c.id ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIsCreatingSection(false); setNewSectionTitle(''); }}
                className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTopSection}
                disabled={!newSectionTitle.trim()}
                className="px-3 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Section
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredSections.length === 0 && !isCreatingSection && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-3 py-20">
            <Archive className="w-12 h-12 text-neutral-300" />
            <div className="text-center">
              <p className="font-bold text-sm text-neutral-600 mb-1">
                {searchQuery ? 'No matching links found' : 'Your Link Vault is empty'}
              </p>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed mb-4">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Import your browser bookmarks file (with nested subfolders) or create custom sections to organize links separately from your main dashboard.'}
              </p>
              {!searchQuery && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportStatus('idle');
                      setImportError('');
                      setIsImportModalOpen(true);
                    }}
                    className="px-4 py-2 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-lg cursor-pointer hover:bg-neutral-200 transition-all flex items-center gap-1.5 border border-neutral-200"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Bookmarks File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingSection(true)}
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-neutral-800 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Section</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sections Tree */}
        <div className="flex flex-col">
          {filteredSections.map((section, sectionIdx) => {
            const isDraggingOver = dragOverSectionIdx === sectionIdx && draggedSectionIdx !== sectionIdx;

            return (
              <div
                key={section.id}
                draggable
                onDragStart={(e) => handleSectionDragStart(sectionIdx, e)}
                onDragOver={(e) => handleSectionDragOver(sectionIdx, e)}
                onDrop={() => handleSectionDrop(sectionIdx)}
                onDragEnd={() => { setDraggedSectionIdx(null); setDragOverSectionIdx(null); }}
                className={`transition-all ${isDraggingOver ? 'ring-2 ring-indigo-400 rounded-lg' : ''} ${
                  draggedSectionIdx === sectionIdx ? 'opacity-50' : ''
                }`}
              >
                {renderSectionCard(section, 0)}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Floating Bulk Action Bar ── */}
      {selectedLinkIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-3 border border-neutral-700 animate-fade-in text-xs font-bold pointer-events-auto">
          <span className="flex items-center gap-1.5 text-amber-400">
            <CheckSquare className="w-4 h-4" />
            {selectedLinkIds.size} link{selectedLinkIds.size > 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedLinkIds(new Set())}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white cursor-pointer transition-all"
          >
            Deselect All
          </button>
          <button
            type="button"
            onClick={handleBulkDeleteSelected}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Selected ({selectedLinkIds.size})</span>
          </button>
        </div>
      )}

      {/* ── Import Bookmarks Modal ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-200 rounded-lg shadow-2xl p-5 w-full max-w-md text-neutral-800 animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm">Import Bookmarks into Vault</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed mb-4">
              Upload your exported browser bookmarks file (<strong>.html</strong> or <strong>.json</strong>).
              Nidus will automatically preserve your <strong>nested subfolder hierarchy</strong> into Vault Sections & Subfolders and scrape rich metadata!
            </p>

            {/* Hidden native file input */}
            <input
              ref={importFileInputRef}
              type="file"
              accept=".html,.htm,.json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* File Dropzone Button */}
            {importStatus === 'idle' && (
              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-indigo-500 bg-neutral-50/50 hover:bg-indigo-50/20 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all mb-4"
              >
                <FileText className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-xs font-bold text-neutral-700 mb-1">Click to select bookmarks file</span>
                <span className="text-[10px] text-neutral-400">Supports nested folder trees from Chrome, Brave, Edge, Firefox, Safari, and JSON</span>
              </div>
            )}

            {/* Parsing State */}
            {importStatus === 'parsing' && (
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50 rounded-lg mb-4">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs font-bold text-neutral-700">Reading & Parsing Folders Hierarchy...</span>
              </div>
            )}

            {/* Saving State */}
            {importStatus === 'saving' && (
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50 rounded-lg mb-4">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-neutral-700">Building Nested Vault Folders...</span>
              </div>
            )}

            {/* Success State */}
            {importStatus === 'success' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 mb-0.5">Import Completed!</h4>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Successfully imported <strong>{importStats.linksCount} links</strong> into <strong>{importStats.sectionsCount} root folders</strong> with full subfolder hierarchy.
                    Metadata is scraping in the background!
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {importStatus === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-900 mb-0.5">Import Failed</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed">{importError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded-md cursor-pointer transition-all"
              >
                {importStatus === 'success' ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Delete Confirmation Modal */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 shadow-2xl p-4 sm:p-5 w-full max-w-xs text-neutral-800">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <Trash2 className="w-4 h-4 shrink-0" />
              <h3 className="font-extrabold text-xs sm:text-sm">Delete Folder/Section?</h3>
            </div>
            <p className="text-xs text-neutral-600 mb-1 leading-relaxed">
              Are you sure you want to delete <strong className="text-neutral-900">"{sectionToDelete.title}"</strong>?
            </p>
            <p className="text-[10px] text-neutral-400 mb-4">
              This will permanently remove all {countTotalSectionLinks(sectionToDelete)} link(s) and subfolders inside it.
            </p>
            <div className="flex items-center justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-none cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSection}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-none cursor-pointer transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
