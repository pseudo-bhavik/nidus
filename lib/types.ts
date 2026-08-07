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

export type ViewType = 'all' | 'unsorted' | 'trash' | 'sticky-notes' | 'canvas' | string; // string represents specific category names

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange' | 'dark';
  is_pinned?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhiteboardCanvasDoc {
  id: string;
  title: string;
  elementsData: any[];
  appStateData?: any;
  created_at: string;
  updated_at: string;
}
