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

export type ViewType = 'all' | 'unsorted' | 'trash' | string; // string represents specific category names
