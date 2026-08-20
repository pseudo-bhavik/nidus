export interface Bookmark {
  id: string;
  created_at: string;
  url: string;
  title: string;
  description: string | null;
  domain: string;
  thumbnail_url: string | null;
  category: string;
  priority: 'Low' | 'Medium' | 'High';
  is_completed: boolean;
  is_trashed: boolean;
  notes: string;
  read_time_minutes: number;
}

export type ViewType = 'all' | 'unsorted' | 'trash' | 'sticky-notes' | 'canvas' | 'vault' | string; // string represents specific category names

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange' | 'dark';
  is_pinned?: boolean;
  position?: number;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardCanvasDoc {
  id: string;
  title: string;
  elementsData: any[];
  appStateData?: any;
  position?: number;
  created_at: string;
  updated_at: string;
}

export interface VaultLink {
  id: string;
  url: string;
  title: string;
  description?: string;
  favicon_url?: string;
  created_at: string;
}

export interface VaultSection {
  id: string;
  title: string;
  color: string;
  links: VaultLink[];
  is_collapsed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}
