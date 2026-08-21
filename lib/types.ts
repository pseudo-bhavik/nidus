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

export type ViewType = 'all' | 'unsorted' | 'trash' | 'sticky-notes' | 'canvas' | 'vault' | 'calendar' | string; // string represents specific category names

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
  description?: string | null;
  domain?: string;
  thumbnail_url?: string | null;
  favicon_url?: string | null;
  read_time_minutes?: number;
  created_at: string;
}

export interface VaultSection {
  id: string;
  title: string;
  color: string;
  links: VaultLink[];
  subsections?: VaultSection[];
  is_collapsed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda' | 'year';

export interface CalendarEvent {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  location_url?: string | null;
  start_time: string; // ISO timestamp
  end_time: string;   // ISO timestamp
  is_all_day: boolean;
  color: string; // 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'cyan' | 'orange' | 'neutral'
  category?: string;
  is_completed?: boolean; // For checkable tasks
  is_task?: boolean;      // Distinguishes tasks from events
  recurrence_rule?: string | null; // 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  reminder_type?: 'none' | 'at_event' | '15m' | '30m' | '1h' | '3h' | '1d' | 'custom' | string | null;
  reminder_custom_time?: string | null;
  reminder_channel_email?: boolean;
  reminder_email?: string | null;
  reminder_channel_telegram?: boolean;
  reminder_telegram_chat_id?: string | null;
  created_at: string;
  updated_at: string;
}
