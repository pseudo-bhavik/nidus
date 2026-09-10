'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search, X,
  Clock, MapPin, AlignLeft, CheckSquare, Square, Tag, Trash2, Edit3,
  ExternalLink, Upload, Download, RefreshCw, CheckCircle2, CloudUpload,
  Layers, AlertTriangle, FileText, Check, Repeat, Bell, Mail, Send, MessageSquare, PanelLeft
} from 'lucide-react';
import { CalendarEvent, CalendarViewMode } from '../lib/types';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nidus_calendar_events';

const COLOR_PALETTES = [
  { id: 'orange', name: 'HN Orange', bg: 'bg-[#ff6600]/10', border: 'border-[#ff6600]/30', text: 'text-[#ff6600]', badge: 'bg-[#ff6600]' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500' },
  { id: 'blue', name: 'Blue', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500' },
  { id: 'purple', name: 'Purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500' },
  { id: 'amber', name: 'Amber', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500' },
  { id: 'rose', name: 'Rose', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-500' },
  { id: 'cyan', name: 'Cyan', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-500' },
  { id: 'neutral', name: 'Neutral', bg: 'bg-neutral-100', border: 'border-neutral-300', text: 'text-neutral-700', badge: 'bg-neutral-500' },
];

function getColorConfig(colorId: string) {
  return COLOR_PALETTES.find((c) => c.id === colorId) || COLOR_PALETTES[0];
}

function generateId(prefix = 'evt') {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to format Date to YYYY-MM-DD
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format Time to HH:mm
function toTimeString(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper to format 12-hour AM/PM
function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Helper to format clean event time range (handles events with no end time)
function formatEventTimeRange(evt: CalendarEvent): string {
  if (evt.is_all_day) return 'All day';
  const startStr = formatTime12h(toTimeString(new Date(evt.start_time)));
  if (!evt.end_time || evt.end_time === evt.start_time) {
    return startStr;
  }
  const endStr = formatTime12h(toTimeString(new Date(evt.end_time!)));
  if (startStr === endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

// Helper to sanitize external links and block javascript: / data: pseudo-protocols
function sanitizeSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

const DEFAULT_SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-welcome-1',
    title: '🚀 Launch Nidus Calendar Workspace',
    description: 'Welcome to your integrated Google Calendar clone in Nidus with hotkeys, sync, and multiple views!',
    location_url: 'https://nidus.app',
    start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
    is_all_day: false,
    color: 'orange',
    category: 'Productivity',
    is_completed: false,
    is_task: false,
    recurrence_rule: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-welcome-2',
    title: 'Review weekly roadmap & backlog',
    description: 'Weekly team sprint planning and architecture sync.',
    location_url: '',
    start_time: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(15, 0, 0, 0)).toISOString(),
    is_all_day: false,
    color: 'blue',
    category: 'Work',
    is_completed: false,
    is_task: false,
    recurrence_rule: 'weekly',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-welcome-3',
    title: 'Daily Deep Work & Reading',
    description: 'Focus block for research and coding.',
    location_url: '',
    start_time: new Date(new Date().setHours(16, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(17, 30, 0, 0)).toISOString(),
    is_all_day: false,
    color: 'emerald',
    category: 'Personal',
    is_completed: false,
    is_task: true,
    recurrence_rule: 'daily',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

interface CalendarViewProps {
  isSidebarOpen?: boolean;
  onOpenSidebar?: () => void;
}

export default function CalendarView({ isSidebarOpen, onOpenSidebar }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Event Modal (Create & Edit)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formHasEndTime, setFormHasEndTime] = useState(true);
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formColor, setFormColor] = useState('orange');
  const [formCategory, setFormCategory] = useState('General');
  const [formDescription, setFormDescription] = useState('');
  const [formLocationUrl, setFormLocationUrl] = useState('');
  const [formIsTask, setFormIsTask] = useState(false);
  const [formRecurrence, setFormRecurrence] = useState<string>('');

  // Reminder & Notification Channels
  const [formReminderType, setFormReminderType] = useState<string>('none');
  const [formReminderCustomDate, setFormReminderCustomDate] = useState<string>('');
  const [formReminderCustomTime, setFormReminderCustomTime] = useState<string>('09:00');
  const [formReminderChannelEmail, setFormReminderChannelEmail] = useState<boolean>(true);
  const [formReminderEmail, setFormReminderEmail] = useState<string>('');
  const [formReminderChannelTelegram, setFormReminderChannelTelegram] = useState<boolean>(false);
  const [formReminderTelegramChatId, setFormReminderTelegramChatId] = useState<string>('');
  const [testNotifyStatus, setTestNotifyStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [testNotifyMsg, setTestNotifyMsg] = useState<string>('');

  // Delete Confirmation Modal
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);

  // Day Overflow Popover in Month View
  const [overflowPopoverDay, setOverflowPopoverDay] = useState<string | null>(null);

  // Day Events Viewer Modal (Tapped Day)
  const [selectedDayDetails, setSelectedDayDetails] = useState<string | null>(null);

  // .ics Import Modal
  const [isIcsImportModalOpen, setIsIcsImportModalOpen] = useState(false);
  const [icsImportStatus, setIcsImportStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [icsImportCount, setIcsImportCount] = useState(0);
  const [icsImportError, setIcsImportError] = useState('');
  const icsFileInputRef = useRef<HTMLInputElement>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sentAlertsRef = useRef<Set<string>>(new Set());

  // ── Cloud Database Sync Helper ─────────────────────────────────

  const syncEventsToCloud = useCallback(async (eventsToSync: CalendarEvent[]) => {
    if (!eventsToSync) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) {
        // Guest mode: Do NOT sync to shared cloud database
        setCloudSyncStatus('idle');
        return;
      }

      setCloudSyncStatus('syncing');
      const upsertPayload = eventsToSync.map((evt) => ({
        id: evt.id,
        user_id: uid,
        title: evt.title,
        description: evt.description || null,
        location_url: evt.location_url || null,
        start_time: evt.start_time,
        end_time: evt.end_time,
        is_all_day: evt.is_all_day ?? false,
        color: evt.color || 'orange',
        category: evt.category || 'General',
        is_completed: evt.is_completed ?? false,
        is_task: evt.is_task ?? false,
        recurrence_rule: evt.recurrence_rule || null,
        reminder_type: evt.reminder_type || 'none',
        reminder_custom_time: evt.reminder_custom_time || null,
        reminder_channel_email: evt.reminder_channel_email ?? false,
        reminder_email: evt.reminder_email || null,
        reminder_channel_telegram: evt.reminder_channel_telegram ?? false,
        reminder_telegram_chat_id: evt.reminder_telegram_chat_id || null,
        created_at: evt.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('calendar_events').upsert(upsertPayload);
      if (error) {
        console.warn('Supabase calendar upsert warning/error:', error);
        setCloudSyncStatus('error');
      } else {
        setCloudSyncStatus('synced');
      }
    } catch (err) {
      console.warn('Failed to sync calendar to cloud:', err);
      setCloudSyncStatus('error');
    }
  }, []);

  // ── Initial Load on Mount ──────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    const loadCalendarData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;

        if (uid) {
          // Logged in: fetch ONLY this user's private events
          const { data: dbEvents, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', uid)
            .order('start_time', { ascending: true });

          if (!error && dbEvents && isMounted) {
            const mapped: CalendarEvent[] = dbEvents.map((d: any) => ({
              id: d.id,
              user_id: d.user_id,
              title: d.title || 'Untitled Event',
              description: d.description || null,
              location_url: d.location_url || null,
              start_time: d.start_time,
              end_time: d.end_time,
              is_all_day: d.is_all_day ?? false,
              color: d.color || 'orange',
              category: d.category || 'General',
              is_completed: d.is_completed ?? false,
              is_task: d.is_task ?? false,
              recurrence_rule: d.recurrence_rule || null,
              reminder_type: d.reminder_type || 'none',
              reminder_custom_time: d.reminder_custom_time || null,
              reminder_channel_email: d.reminder_channel_email ?? false,
              reminder_email: d.reminder_email || null,
              reminder_channel_telegram: d.reminder_channel_telegram ?? false,
              reminder_telegram_chat_id: d.reminder_telegram_chat_id || null,
              created_at: d.created_at,
              updated_at: d.updated_at,
            }));

            setEvents(mapped);
            setCloudSyncStatus('synced');
            try {
              localStorage.setItem(`${STORAGE_KEY}_${uid}`, JSON.stringify(mapped));
            } catch (e) {}
            setIsLoaded(true);
            return;
          }
        }
      } catch (e) {}

      // Guest / Offline Mode: load strictly from user's local browser storage
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local && isMounted) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            setEvents(parsed);
            setIsLoaded(true);
            return;
          }
        }
      } catch (e) {}

      if (isMounted) {
        setEvents([]);
        setIsLoaded(true);
      }
    };

    loadCalendarData();
    return () => { isMounted = false; };
  }, [syncEventsToCloud]);

  // ── Save & Sync Events ─────────────────────────────────────────

  const saveEvents = useCallback((updated: CalendarEvent[]) => {
    setEvents(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      syncEventsToCloud(updated);
    }, 400);
  }, [syncEventsToCloud]);

  // ── Automated Scheduled Reminder Watcher (Asia/Kolkata / IST GMT+5:30) ──
  useEffect(() => {
    if (!events || events.length === 0) return;

    const checkDueReminders = async () => {
      const now = Date.now();

      for (const evt of events) {
        if (!evt.reminder_type || evt.reminder_type === 'none') continue;
        if (!evt.start_time) continue;

        const eventStartMs = new Date(evt.start_time).getTime();
        let reminderMs = eventStartMs;

        if (evt.reminder_type === 'at_event') {
          reminderMs = eventStartMs;
        } else if (evt.reminder_type === '15m') {
          reminderMs = eventStartMs - 15 * 60 * 1000;
        } else if (evt.reminder_type === '30m') {
          reminderMs = eventStartMs - 30 * 60 * 1000;
        } else if (evt.reminder_type === '1h') {
          reminderMs = eventStartMs - 60 * 60 * 1000;
        } else if (evt.reminder_type === '3h') {
          reminderMs = eventStartMs - 3 * 60 * 60 * 1000;
        } else if (evt.reminder_type === '1d') {
          reminderMs = eventStartMs - 24 * 60 * 60 * 1000;
        } else if (evt.reminder_type === 'custom' && evt.reminder_custom_time) {
          reminderMs = new Date(evt.reminder_custom_time).getTime();
        }

        // Is it due now? (Trigger strictly when now >= reminderMs, up to 10 minutes tolerance)
        if (now >= reminderMs && now - reminderMs <= 10 * 60 * 1000) {
          const sentKey = `nidus_alert_sent_${evt.id}_${evt.start_time}_${evt.reminder_type}`;
          if (!sentAlertsRef.current.has(sentKey) && !localStorage.getItem(sentKey)) {
            // Mark as sent immediately in both memory ref and localStorage to prevent duplicate triggers
            sentAlertsRef.current.add(sentKey);
            try {
              localStorage.setItem(sentKey, new Date().toISOString());
            } catch (e) {}

            const reminderLabel =
              evt.reminder_type === '3h'
                ? '3 hours before'
                : evt.reminder_type === '1h'
                ? '1 hour before'
                : evt.reminder_type === '30m'
                ? '30 minutes before'
                : evt.reminder_type === '15m'
                ? '15 minutes before'
                : evt.reminder_type === '1d'
                ? '1 day before'
                : evt.reminder_type === 'at_event'
                ? 'At event start'
                : 'Scheduled Alert';

            const defaultTg = evt.reminder_telegram_chat_id || localStorage.getItem('nidus_telegram_chat_id') || '';
            const defaultEmail = evt.reminder_email || localStorage.getItem('nidus_default_alert_email') || '';

            // Dispatch to Notification API
            try {
              fetch('/api/calendar/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  eventTitle: evt.title,
                  startTime: evt.start_time,
                  description: evt.description || '',
                  channel: evt.reminder_channel_telegram && evt.reminder_channel_email ? 'all' : evt.reminder_channel_telegram ? 'telegram' : 'email',
                  telegramChatId: defaultTg,
                  email: defaultEmail,
                  reminderLabel,
                }),
              }).catch(() => {});
            } catch (e) {}

            // In-browser Notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`Reminder: ${evt.title}`, {
                  body: `${reminderLabel} • Time: ${new Date(evt.start_time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST`,
                  icon: '/favicon.ico',
                });
              } catch (e) {}
            }
          }
        }
      }
    };

    // Request notification permission if needed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    checkDueReminders();
    const interval = setInterval(checkDueReminders, 15000);
    return () => clearInterval(interval);
  }, [events]);

  // ── Date Navigation Helpers ────────────────────────────────────

  const handlePrevPeriod = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() - 1);
    } else if (viewMode === 'agenda') {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNextPeriod = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'day') {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === 'year') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (viewMode === 'agenda') {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // ── Form & Modal Management ────────────────────────────────────

  const openCreateModal = async (presetDate?: string, presetHour?: number) => {
    const baseDate = presetDate ? new Date(presetDate) : new Date(currentDate);
    const dateStr = toDateString(baseDate);
    const startH = presetHour !== undefined ? presetHour : 9;
    const endH = (startH + 1) % 24;

    // Auto-fetch saved Telegram Chat ID and Default Alert Email from localStorage & user session
    let defaultEmail = '';
    let defaultTg = '';
    try {
      defaultTg = localStorage.getItem('nidus_telegram_chat_id') || '';
      defaultEmail = localStorage.getItem('nidus_default_alert_email') || '';
      const { data: { session } } = await supabase.auth.getSession();
      if (!defaultEmail && session?.user?.email) defaultEmail = session.user.email;
      if (!defaultEmail && session?.user?.user_metadata?.default_alert_email) defaultEmail = session.user.user_metadata.default_alert_email;
      if (!defaultTg && session?.user?.user_metadata?.telegram_chat_id) {
        defaultTg = session.user.user_metadata.telegram_chat_id;
        localStorage.setItem('nidus_telegram_chat_id', defaultTg);
      }
    } catch (e) {}

    setEditingEvent(null);
    setFormTitle('');
    setFormStartDate(dateStr);
    setFormEndDate(dateStr);
    setFormStartTime(`${String(startH).padStart(2, '0')}:00`);
    setFormEndTime(`${String(endH).padStart(2, '0')}:00`);
    setFormHasEndTime(true);
    setFormIsAllDay(presetHour === undefined && viewMode === 'month');
    setFormColor('orange');
    setFormCategory('General');
    setFormDescription('');
    setFormLocationUrl('');
    setFormIsTask(false);
    setFormRecurrence('');
    setFormReminderType('none');
    setFormReminderCustomDate(dateStr);
    setFormReminderCustomTime(`${String(Math.max(0, startH - 3)).padStart(2, '0')}:00`);
    setFormReminderChannelEmail(Boolean(defaultEmail));
    setFormReminderEmail(defaultEmail);
    setFormReminderChannelTelegram(Boolean(defaultTg));
    setFormReminderTelegramChatId(defaultTg);
    setTestNotifyStatus('idle');
    setTestNotifyMsg('');
    setIsEventModalOpen(true);
  };

  const openEditModal = async (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);

    const startD = new Date(evt.start_time);
    const hasEnd = Boolean(evt.end_time && evt.end_time !== evt.start_time);
    const endD = evt.end_time ? new Date(evt.end_time) : startD;

    let defaultEmail = evt.reminder_email || '';
    let defaultTg = evt.reminder_telegram_chat_id || '';
    try {
      if (!defaultTg) defaultTg = localStorage.getItem('nidus_telegram_chat_id') || '';
      if (!defaultEmail) defaultEmail = localStorage.getItem('nidus_default_alert_email') || '';
      const { data: { session } } = await supabase.auth.getSession();
      if (!defaultEmail && session?.user?.email) defaultEmail = session.user.email;
      if (!defaultEmail && session?.user?.user_metadata?.default_alert_email) defaultEmail = session.user.user_metadata.default_alert_email;
      if (!defaultTg && session?.user?.user_metadata?.telegram_chat_id) {
        defaultTg = session.user.user_metadata.telegram_chat_id;
        localStorage.setItem('nidus_telegram_chat_id', defaultTg);
      }
    } catch (e) {}

    setFormStartDate(toDateString(startD));
    setFormEndDate(toDateString(endD));
    setFormStartTime(toTimeString(startD));
    setFormEndTime(toTimeString(endD));
    setFormHasEndTime(hasEnd);
    setFormIsAllDay(evt.is_all_day);
    setFormColor(evt.color || 'orange');
    setFormCategory(evt.category || 'General');
    setFormDescription(evt.description || '');
    setFormLocationUrl(evt.location_url || '');
    setFormIsTask(Boolean(evt.is_task));
    setFormRecurrence(evt.recurrence_rule || '');

    setFormReminderType(evt.reminder_type || 'none');
    if (evt.reminder_custom_time) {
      const custD = new Date(evt.reminder_custom_time);
      setFormReminderCustomDate(toDateString(custD));
      setFormReminderCustomTime(toTimeString(custD));
    } else {
      setFormReminderCustomDate(toDateString(startD));
      setFormReminderCustomTime(toTimeString(startD));
    }
    setFormReminderChannelEmail(evt.reminder_channel_email ?? Boolean(defaultEmail));
    setFormReminderEmail(defaultEmail);
    setFormReminderChannelTelegram(evt.reminder_channel_telegram ?? Boolean(defaultTg));
    setFormReminderTelegramChatId(defaultTg);
    setTestNotifyStatus('idle');
    setTestNotifyMsg('');
    setIsEventModalOpen(true);
  };

  const handleSendTestNotification = async () => {
    setTestNotifyStatus('sending');
    setTestNotifyMsg('');

    try {
      const res = await fetch('/api/calendar/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTitle: formTitle.trim() || 'Sample Calendar Event',
          startTime: formIsAllDay ? `${formStartDate}T00:00:00` : `${formStartDate}T${formStartTime}:00`,
          description: formDescription.trim() || 'This is a test notification from Nidus Calendar.',
          channel: formReminderChannelEmail && formReminderChannelTelegram ? 'all' : formReminderChannelTelegram ? 'telegram' : 'email',
          telegramChatId: formReminderTelegramChatId.trim(),
          email: formReminderEmail.trim(),
          reminderLabel: formReminderType === '3h' ? '3 hours before' : formReminderType === '1h' ? '1 hour before' : formReminderType === '30m' ? '30 minutes before' : formReminderType === 'custom' ? `At custom time: ${formReminderCustomDate} ${formReminderCustomTime}` : 'Event scheduled reminder',
        }),
      });
      const data = await res.json();
      if (data.success || data.results?.telegram?.ok || (data.results?.email && !data.results?.email?.error)) {
        setTestNotifyStatus('sent');
        setTestNotifyMsg('Test reminder dispatched successfully!');
      } else {
        setTestNotifyStatus('error');
        setTestNotifyMsg(data.errors?.join(' | ') || data.error || 'Failed to dispatch test reminder.');
      }
    } catch (err: any) {
      setTestNotifyStatus('error');
      setTestNotifyMsg(err.message || 'Error communicating with notification server.');
    }
  };

  const handleSaveEvent = () => {
    if (!formTitle.trim()) return;

    let startIso: string;
    let endIso: string;

    if (formIsAllDay) {
      startIso = new Date(`${formStartDate}T00:00:00`).toISOString();
      endIso = formHasEndTime ? new Date(`${formEndDate || formStartDate}T23:59:59`).toISOString() : startIso;
    } else {
      startIso = new Date(`${formStartDate}T${formStartTime}:00`).toISOString();
      endIso = formHasEndTime ? new Date(`${formEndDate || formStartDate}T${formEndTime}:00`).toISOString() : startIso;
    }

    let customReminderIso: string | null = null;
    if (formReminderType === 'custom' && formReminderCustomDate) {
      customReminderIso = new Date(`${formReminderCustomDate}T${formReminderCustomTime || '09:00'}:00`).toISOString();
    }

    if (editingEvent) {
      const updated = events.map((e) =>
        e.id === editingEvent.id
          ? {
              ...e,
              title: formTitle.trim(),
              start_time: startIso,
              end_time: endIso,
              is_all_day: formIsAllDay,
              color: formColor,
              category: formCategory,
              description: formDescription.trim() || null,
              location_url: sanitizeSafeUrl(formLocationUrl),
              is_task: formIsTask,
              recurrence_rule: formRecurrence || null,
              reminder_type: formReminderType,
              reminder_custom_time: customReminderIso,
              reminder_channel_email: formReminderChannelEmail,
              reminder_email: formReminderEmail.trim() || null,
              reminder_channel_telegram: formReminderChannelTelegram,
              reminder_telegram_chat_id: formReminderTelegramChatId.trim() || null,
              updated_at: new Date().toISOString(),
            }
          : e
      );
      saveEvents(updated);
    } else {
      const newEvt: CalendarEvent = {
        id: generateId('evt'),
        title: formTitle.trim(),
        start_time: startIso,
        end_time: endIso,
        is_all_day: formIsAllDay,
        color: formColor,
        category: formCategory,
        description: formDescription.trim() || null,
        location_url: sanitizeSafeUrl(formLocationUrl),
        is_completed: false,
        is_task: formIsTask,
        recurrence_rule: formRecurrence || null,
        reminder_type: formReminderType,
        reminder_custom_time: customReminderIso,
        reminder_channel_email: formReminderChannelEmail,
        reminder_email: formReminderEmail.trim() || null,
        reminder_channel_telegram: formReminderChannelTelegram,
        reminder_telegram_chat_id: formReminderTelegramChatId.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveEvents([...events, newEvt]);
    }

    setIsEventModalOpen(false);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    const targetId = eventToDelete.id;
    const updated = events.filter((e) => e.id !== targetId);
    saveEvents(updated);
    setEventToDelete(null);
    setIsEventModalOpen(false);

    try {
      await supabase.from('calendar_events').delete().eq('id', targetId);
    } catch (err) {}
  };

  const handleToggleTaskComplete = (evtId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = events.map((evt) =>
      evt.id === evtId ? { ...evt, is_completed: !evt.is_completed, updated_at: new Date().toISOString() } : evt
    );
    saveEvents(updated);
  };

  // ── iCalendar (.ics) Export & Import ───────────────────────────

  const handleExportIcs = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nidus//NIDUS Calendar Workspace//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    events.forEach((evt) => {
      const startD = new Date(evt.start_time);
      const endD = evt.end_time ? new Date(evt.end_time) : startD;

      const formatIcsDate = (d: Date) =>
        d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${evt.id}@nidus.app`);
      icsContent.push(`DTSTAMP:${formatIcsDate(new Date())}`);
      icsContent.push(`DTSTART:${formatIcsDate(startD)}`);
      icsContent.push(`DTEND:${formatIcsDate(endD)}`);
      icsContent.push(`SUMMARY:${evt.title.replace(/\n/g, ' ')}`);
      if (evt.description) {
        icsContent.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n')}`);
      }
      if (evt.location_url) {
        icsContent.push(`LOCATION:${evt.location_url}`);
      }
      if (evt.recurrence_rule) {
        icsContent.push(`RRULE:FREQ=${evt.recurrence_rule.toUpperCase()}`);
      }
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `nidus-calendar-${toDateString(new Date())}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleIcsFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIcsImportStatus('parsing');
    setIcsImportError('');

    try {
      const text = await file.text();
      const newEvents: CalendarEvent[] = [];

      const eventBlocks = text.split(/BEGIN:VEVENT/i).slice(1);

      eventBlocks.forEach((block) => {
        const getField = (field: string) => {
          const match = block.match(new RegExp(`${field}[^:]*:(.*)`, 'i'));
          return match ? match[1].trim() : '';
        };

        const summary = getField('SUMMARY') || 'Imported Event';
        const description = getField('DESCRIPTION').replace(/\\n/g, '\n');
        const location = getField('LOCATION');
        const dtstart = getField('DTSTART');
        const dtend = getField('DTEND');
        const rrule = getField('RRULE');

        const parseIcsDate = (str: string): Date => {
          if (!str) return new Date();
          // format: YYYYMMDDTHHmmssZ or YYYYMMDD
          if (str.length === 8) {
            const y = parseInt(str.substring(0, 4), 10);
            const m = parseInt(str.substring(4, 6), 10) - 1;
            const d = parseInt(str.substring(6, 8), 10);
            return new Date(y, m, d);
          }
          const cleaned = str.replace(/[^0-9T]/g, '');
          const y = parseInt(cleaned.substring(0, 4), 10);
          const m = parseInt(cleaned.substring(4, 6), 10) - 1;
          const d = parseInt(cleaned.substring(6, 8), 10);
          const hh = parseInt(cleaned.substring(9, 11) || '0', 10);
          const mm = parseInt(cleaned.substring(11, 13) || '0', 10);
          const ss = parseInt(cleaned.substring(13, 15) || '0', 10);
          return new Date(Date.UTC(y, m, d, hh, mm, ss));
        };

        const startD = parseIcsDate(dtstart);
        const endD = dtend ? parseIcsDate(dtend) : new Date(startD.getTime() + 60 * 60 * 1000);

        let recurrence: string | null = null;
        if (rrule) {
          const freqMatch = rrule.match(/FREQ=([A-Z]+)/i);
          if (freqMatch) recurrence = freqMatch[1].toLowerCase();
        }

        newEvents.push({
          id: generateId('evt'),
          title: summary,
          description: description || null,
          location_url: sanitizeSafeUrl(location),
          start_time: startD.toISOString(),
          end_time: endD.toISOString(),
          is_all_day: dtstart.length === 8,
          color: 'blue',
          category: 'Imported',
          is_completed: false,
          is_task: false,
          recurrence_rule: recurrence,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      if (newEvents.length === 0) {
        throw new Error('No valid VEVENT blocks found in the .ics file.');
      }

      const merged = [...events, ...newEvents];
      saveEvents(merged);
      setIcsImportCount(newEvents.length);
      setIcsImportStatus('success');
    } catch (err: any) {
      setIcsImportStatus('error');
      setIcsImportError(err.message || 'Failed to parse .ics calendar file.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // ── Keyboard Shortcuts (Google Calendar Hotkeys) ───────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, or modal is open
      const isInput =
        document.activeElement instanceof HTMLElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

      if (isEventModalOpen || isIcsImportModalOpen || eventToDelete || overflowPopoverDay || selectedDayDetails) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setIsEventModalOpen(false);
          setIsIcsImportModalOpen(false);
          setEventToDelete(null);
          setOverflowPopoverDay(null);
          setSelectedDayDetails(null);
        }
        return;
      }

      if (isInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          setSearchQuery('');
          return;
        }
      }

      // Hotkey view switches
      if (e.key.toLowerCase() === 'm') { e.preventDefault(); setViewMode('month'); }
      else if (e.key.toLowerCase() === 'w') { e.preventDefault(); setViewMode('week'); }
      else if (e.key.toLowerCase() === 'd') { e.preventDefault(); setViewMode('day'); }
      else if (e.key.toLowerCase() === 'a') { e.preventDefault(); setViewMode('agenda'); }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); setViewMode('year'); }
      else if (e.key.toLowerCase() === 't') { e.preventDefault(); handleToday(); }
      else if (e.key.toLowerCase() === 'c') { e.preventDefault(); openCreateModal(); }
      else if (e.key.toLowerCase() === 'j') { e.preventDefault(); handleNextPeriod(); }
      else if (e.key.toLowerCase() === 'k') { e.preventDefault(); handlePrevPeriod(); }
      else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search events"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isEventModalOpen, isIcsImportModalOpen, eventToDelete, overflowPopoverDay,
    searchQuery, viewMode, currentDate
  ]);

  // Focus modal title input on open
  useEffect(() => {
    if (isEventModalOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isEventModalOpen]);

  // ── Filtered Events by Search Query ────────────────────────────

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.category || '').toLowerCase().includes(q) ||
        (e.location_url || '').toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  // ── Month Grid Computations ────────────────────────────────────

  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, totalDaysInPrevMonth - i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isCurrentMonth: false,
        isToday: toDateString(d) === toDateString(new Date()),
      });
    }

    // Days in current month
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isCurrentMonth: true,
        isToday: toDateString(d) === toDateString(new Date()),
      });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        isCurrentMonth: false,
        isToday: toDateString(d) === toDateString(new Date()),
      });
    }

    return days;
  }, [currentDate]);

  // ── Week Days Computations ─────────────────────────────────────

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay(); // 0 = Sun
    startOfWeek.setDate(startOfWeek.getDate() - day);

    const days: { date: Date; dateStr: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        dateStr: toDateString(d),
        dayName: DAY_NAMES_SHORT[d.getDay()],
        dayNum: d.getDate(),
        isToday: toDateString(d) === toDateString(new Date()),
      });
    }
    return days;
  }, [currentDate]);

  // Events grouped by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const dateStr = toDateString(new Date(evt.start_time));
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(evt);
    });

    // Sort by start_time
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    });

    return map;
  }, [filteredEvents]);

  // Header formatted date label
  const headerDateLabel = useMemo(() => {
    const year = currentDate.getFullYear();
    const monthName = MONTH_NAMES[currentDate.getMonth()];

    if (viewMode === 'month' || viewMode === 'agenda') {
      return `${monthName} ${year}`;
    }
    if (viewMode === 'year') {
      return `${year}`;
    }
    if (viewMode === 'day') {
      return `${monthName} ${currentDate.getDate()}, ${year}`;
    }
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      return `${MONTH_NAMES[first.date.getMonth()].slice(0, 3)} ${first.dayNum} – ${
        MONTH_NAMES[last.date.getMonth()].slice(0, 3)
      } ${last.dayNum}, ${year}`;
    }
    return `${monthName} ${year}`;
  }, [currentDate, viewMode, weekDays]);

  if (!isLoaded) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white text-neutral-800 relative overflow-hidden select-none">

      {/* ── Top Header Bar ── */}
      <div className="min-h-[58px] py-2.5 px-4 sm:px-6 bg-white border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {!isSidebarOpen && onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="p-1.5 hover:bg-neutral-100 rounded-md text-neutral-600 cursor-pointer mr-0.5"
              title="Open Sidebar"
            >
              <PanelLeft className="w-4.5 h-4.5 text-neutral-600" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-color)' }} />
            <h1 className="font-extrabold text-base text-neutral-900 tracking-tight">Calendar</h1>
          </div>

          {/* Today Button & Period Jumpers */}
          <div className="flex items-center gap-1.5 ml-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-extrabold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg cursor-pointer transition-all shadow-2xs"
              title="Jump to Today (t)"
            >
              Today
            </button>
            <div className="flex items-center bg-neutral-100 rounded-lg border border-neutral-200 p-0.5">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1.5 hover:bg-neutral-200/80 rounded-md text-neutral-700 cursor-pointer"
                title="Previous (k)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1.5 hover:bg-neutral-200/80 rounded-md text-neutral-700 cursor-pointer"
                title="Next (j)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span className="font-extrabold text-sm text-neutral-900 ml-2 whitespace-nowrap">
              {headerDateLabel}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Switcher (Clean, Spacious & Readable) */}
          <div className="flex items-center bg-neutral-100/90 p-1 rounded-lg border border-neutral-200 text-xs font-bold text-neutral-600 gap-0.5 shadow-2xs max-sm:overflow-x-auto max-sm:no-scrollbar max-sm:max-w-full">
            {[
              { id: 'month', label: 'Month', key: 'm' },
              { id: 'week', label: 'Week', key: 'w' },
              { id: 'day', label: 'Day', key: 'd' },
              { id: 'agenda', label: 'Agenda', key: 'a' },
              { id: 'year', label: 'Year', key: 'y' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id as CalendarViewMode)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === tab.id
                    ? 'bg-white text-neutral-900 shadow-xs ring-1 ring-black/5 font-extrabold'
                    : 'hover:bg-neutral-200/60 hover:text-neutral-900 text-neutral-600'
                }`}
                title={`Switch to ${tab.label} view (${tab.key})`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-neutral-800 w-40 sm:w-52 transition-all font-medium"
              style={{ paddingLeft: '2.5rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Event Button */}
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="px-3.5 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0"
            title="Create Event (c)"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* ── Main Views Container ── */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">

        {/* ── VIEW 1: MONTH VIEW (m) ── */}
        {viewMode === 'month' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Weekday Column Headers */}
            <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-xs font-extrabold text-neutral-600 py-2.5 select-none uppercase tracking-wider">
              {DAY_NAMES_SHORT.map((day) => (
                <div key={day} className="truncate">{day}</div>
              ))}
            </div>

            {/* Month Day Cells Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 sm:grid-rows-6 divide-x divide-y divide-neutral-200 overflow-y-auto bg-neutral-100/30">
              {monthGridDays.map((cell, idx) => {
                const dayEvents = eventsByDate[cell.dateStr] || [];
                const maxVisible = 3;
                const visibleEvents = dayEvents.slice(0, maxVisible);
                const overflowCount = dayEvents.length - maxVisible;

                return (
                  <div
                    key={`${cell.dateStr}-${idx}`}
                    onClick={() => setSelectedDayDetails(cell.dateStr)}
                    className={`min-h-[105px] sm:min-h-[120px] p-2 flex flex-col transition-colors cursor-pointer group ${
                      cell.isCurrentMonth ? 'bg-white hover:bg-neutral-50/80' : 'bg-neutral-50/50 text-neutral-400'
                    }`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                          cell.isToday
                            ? 'bg-[#ff6600] text-white shadow-xs'
                            : cell.isCurrentMonth
                            ? 'text-neutral-900 group-hover:text-black'
                            : 'text-neutral-400'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {cell.date.getDate() === 1 && (
                        <span className="text-[11px] font-extrabold text-neutral-500 uppercase">
                          {MONTH_NAMES[cell.date.getMonth()].slice(0, 3)}
                        </span>
                      )}
                    </div>

                    {/* Events List in Day Cell */}
                    <div className="flex-1 flex flex-col gap-1.5 overflow-hidden">
                      {visibleEvents.map((evt) => {
                        const colorCfg = getColorConfig(evt.color);
                        const isTask = evt.is_task;
                        const isDone = evt.is_completed;

                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(evt);
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold border flex items-center gap-1.5 truncate shadow-2xs hover:opacity-85 cursor-pointer transition-all ${
                              colorCfg.bg
                            } ${colorCfg.border} ${colorCfg.text} ${isDone ? 'line-through opacity-50' : ''}`}
                            title={`${evt.title} (${formatEventTimeRange(evt)})`}
                          >
                            {isTask ? (
                              <button
                                type="button"
                                onClick={(e) => handleToggleTaskComplete(evt.id, e)}
                                className="shrink-0 hover:scale-110 cursor-pointer"
                              >
                                {isDone ? (
                                  <CheckSquare className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Square className="w-3 h-3 opacity-60" />
                                )}
                              </button>
                            ) : (
                              <span className={`w-2 h-2 rounded-full shrink-0 ${colorCfg.badge}`} />
                            )}
                            {!evt.is_all_day && !isTask && (
                              <span className="opacity-75 font-mono shrink-0 text-[10px]">
                                {formatTime12h(toTimeString(new Date(evt.start_time)))}
                              </span>
                            )}
                            <span className="truncate flex-1">{evt.title}</span>
                            {evt.reminder_type && evt.reminder_type !== 'none' && (
                              <Bell className="w-2.5 h-2.5 shrink-0 text-[#ff6600]" />
                            )}
                          </div>
                        );
                      })}

                      {/* +N More Popover Trigger */}
                      {overflowCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayDetails(cell.dateStr);
                          }}
                          className="text-[11px] font-bold text-neutral-600 hover:text-neutral-900 text-left px-1.5 py-0.5 hover:bg-neutral-100 rounded cursor-pointer"
                        >
                          +{overflowCount} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VIEW 2: WEEK VIEW (w) ── */}
        {viewMode === 'week' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-auto bg-white">
            <div className="min-w-full sm:min-w-0 max-sm:min-w-[640px] flex-1 flex flex-col">
              {/* Week Header Row */}
              <div className="grid grid-cols-8 border-b border-neutral-200 bg-neutral-50/90 sticky top-0 z-10 select-none">
                <div className="py-2.5 text-center text-xs font-bold text-neutral-400 border-r border-neutral-200">
                  GMT
                </div>
                {weekDays.map((d) => (
                  <div
                    key={d.dateStr}
                    onClick={() => openCreateModal(d.dateStr)}
                    className={`py-2.5 text-center border-r border-neutral-200 cursor-pointer hover:bg-neutral-100/70 transition-colors ${
                      d.isToday ? 'bg-orange-50/50' : ''
                    }`}
                  >
                    <div className="text-[11px] font-extrabold text-neutral-500 uppercase">{d.dayName}</div>
                    <div
                      className={`text-sm font-extrabold w-7 h-7 mx-auto rounded-full flex items-center justify-center mt-0.5 ${
                        d.isToday ? 'bg-[#ff6600] text-white shadow-xs' : 'text-neutral-900'
                      }`}
                    >
                      {d.dayNum}
                    </div>
                  </div>
                ))}
              </div>

              {/* 24-Hour Time Grid */}
              <div className="flex-1 grid grid-cols-8 divide-x divide-neutral-200 relative">
                {/* Hour Labels Column */}
                <div className="flex flex-col text-[11px] font-mono text-neutral-500 text-right pr-2.5 py-1 select-none bg-neutral-50/40">
                  {HOURS_OF_DAY.map((h) => (
                    <div key={h} className="h-14 -mt-2.5">
                      {formatTime12h(`${String(h).padStart(2, '0')}:00`)}
                    </div>
                  ))}
                </div>

                {/* 7 Columns for Days of the Week */}
                {weekDays.map((d) => {
                  const dayEvents = eventsByDate[d.dateStr] || [];
                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => openCreateModal(d.dateStr)}
                      className={`relative flex flex-col transition-colors cursor-pointer ${
                        d.isToday ? 'bg-orange-50/20' : 'hover:bg-neutral-50/60'
                      }`}
                      style={{ height: '1344px' }} // 24 hours * 56px per hour
                    >
                      {/* Grid hour line dividers */}
                      {HOURS_OF_DAY.map((h) => (
                        <div
                          key={h}
                          className="h-14 border-b border-neutral-100/80 hover:bg-black/2 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateModal(d.dateStr, h);
                          }}
                        />
                      ))}

                      {/* Render Events within this day column */}
                      {dayEvents.map((evt) => {
                        const start = new Date(evt.start_time);
                        const end = evt.end_time ? new Date(evt.end_time) : start;
                        const colorCfg = getColorConfig(evt.color);

                        const startMinutes = start.getHours() * 60 + start.getMinutes();
                        let durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                        if (durationMinutes <= 0) durationMinutes = 45;

                        const topPercent = (startMinutes / 1440) * 100;
                        const heightPercent = (durationMinutes / 1440) * 100;

                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(evt);
                            }}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                              minHeight: '32px',
                            }}
                            className={`absolute left-1 right-1 rounded-md p-1.5 text-xs border shadow-xs overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-400/50 transition-all ${
                              colorCfg.bg
                            } ${colorCfg.border} ${colorCfg.text}`}
                          >
                            <div className="font-bold truncate flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${colorCfg.badge}`} />
                              <span className="truncate text-[11px] sm:text-xs flex-1">{evt.title}</span>
                              {evt.reminder_type && evt.reminder_type !== 'none' && (
                                <Bell className="w-2.5 h-2.5 shrink-0 text-[#ff6600]" />
                              )}
                            </div>
                            <div className="text-[10px] opacity-80 font-mono truncate mt-0.5">
                              {formatEventTimeRange(evt)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW 3: DAY VIEW (d) ── */}
        {viewMode === 'day' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-neutral-900">
                  {DAY_NAMES_SHORT[currentDate.getDay()]}, {MONTH_NAMES[currentDate.getMonth()]}{' '}
                  {currentDate.getDate()}
                </span>
                <span className="px-2.5 py-1 bg-neutral-200 text-neutral-800 rounded-full text-xs font-bold">
                  {(eventsByDate[toDateString(currentDate)] || []).length} events
                </span>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(toDateString(currentDate))}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Event
              </button>
            </div>

            {/* Single Day 24-hour timeline */}
            <div className="flex-1 flex divide-x divide-neutral-200">
              <div className="w-24 text-[11px] font-mono text-neutral-500 text-right pr-3.5 py-1 select-none bg-neutral-50/40">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="h-18 border-b border-neutral-150 flex items-start justify-end pt-2 font-semibold">
                    {formatTime12h(`${String(h).padStart(2, '0')}:00`)}
                  </div>
                ))}
              </div>

              <div className="flex-1 relative min-h-[1728px]">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div
                    key={h}
                    onClick={() => openCreateModal(toDateString(currentDate), h)}
                    className="h-18 border-b border-neutral-150 hover:bg-neutral-50 cursor-pointer transition-colors"
                  />
                ))}

                {(eventsByDate[toDateString(currentDate)] || []).map((evt) => {
                  const colorCfg = getColorConfig(evt.color);
                  const start = new Date(evt.start_time);
                  const end = evt.end_time ? new Date(evt.end_time) : start;

                  const startMinutes = start.getHours() * 60 + start.getMinutes();
                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                  const durationMinutes = Math.max(30, endMinutes - startMinutes || 60);

                  const topPercent = (startMinutes / 1440) * 100;
                  const heightPercent = (durationMinutes / 1440) * 100;

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(evt);
                      }}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '40px',
                      }}
                      className={`absolute left-4 right-4 rounded-xl p-3 text-xs border shadow-sm cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${
                        colorCfg.bg
                      } ${colorCfg.border} ${colorCfg.text}`}
                    >
                      <div className="font-extrabold flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate text-sm sm:text-base">{evt.title}</span>
                          {evt.reminder_type && evt.reminder_type !== 'none' && (
                            <Bell className="w-3.5 h-3.5 shrink-0 text-[#ff6600]" />
                          )}
                        </div>
                        <span className="text-xs font-mono shrink-0 opacity-80 font-bold">
                          {formatEventTimeRange(evt)}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs opacity-85 mt-1.5 line-clamp-2 leading-relaxed">
                          {evt.description}
                        </p>
                      )}
                      {evt.location_url && (
                        <div className="flex items-center gap-1.5 text-xs mt-1.5 opacity-80 font-mono truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{evt.location_url}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW 4: AGENDA / SCHEDULE VIEW (a) ── */}
        {viewMode === 'agenda' && (
          <div className="flex-1 p-5 sm:p-8 overflow-y-auto bg-neutral-50/50">
            <div className="max-w-3xl mx-auto flex flex-col gap-5">
              {Object.keys(eventsByDate).length === 0 ? (
                <div className="py-24 text-center text-neutral-400">
                  <CalendarIcon className="w-14 h-14 mx-auto mb-3 text-neutral-300" />
                  <p className="font-extrabold text-base text-neutral-800">No scheduled events or tasks</p>
                  <p className="text-xs text-neutral-500 mt-1 mb-5">Press 'c' or click below to create an event.</p>
                  <button
                    type="button"
                    onClick={() => openCreateModal()}
                    className="px-5 py-2.5 bg-neutral-900 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-neutral-800 shadow-xs"
                  >
                    Create Event
                  </button>
                </div>
              ) : (
                Object.keys(eventsByDate)
                  .sort()
                  .map((dateStr) => {
                    const dateObj = new Date(`${dateStr}T00:00:00`);
                    const isToday = dateStr === toDateString(new Date());
                    const dayEvts = eventsByDate[dateStr];

                    return (
                      <div key={dateStr} className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
                        <div
                          className={`px-5 py-3 flex items-center justify-between border-b border-neutral-100 ${
                            isToday ? 'bg-orange-50/70 text-[#ff6600]' : 'bg-neutral-50 text-neutral-800'
                          }`}
                        >
                          <span className="font-extrabold text-sm">
                            {DAY_NAMES_SHORT[dateObj.getDay()]}, {MONTH_NAMES[dateObj.getMonth()]}{' '}
                            {dateObj.getDate()}, {dateObj.getFullYear()}{' '}
                            {isToday && <span className="ml-1.5 text-[11px] bg-[#ff6600] text-white px-2 py-0.5 rounded-full font-bold">Today</span>}
                          </span>
                          <span className="text-xs text-neutral-500 font-bold">{dayEvts.length} item(s)</span>
                        </div>

                        <div className="divide-y divide-neutral-100">
                          {dayEvts.map((evt) => {
                            const colorCfg = getColorConfig(evt.color);
                            const isTask = evt.is_task;
                            const isDone = evt.is_completed;

                            return (
                              <div
                                key={evt.id}
                                onClick={() => openEditModal(evt)}
                                className={`px-5 py-3.5 flex items-start gap-3.5 hover:bg-neutral-50/80 cursor-pointer transition-colors ${
                                  isDone ? 'opacity-50' : ''
                                }`}
                              >
                                {isTask ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleTaskComplete(evt.id, e)}
                                    className="mt-0.5 hover:scale-110 cursor-pointer"
                                  >
                                    {isDone ? (
                                      <CheckSquare className="w-4.5 h-4.5 text-emerald-600" />
                                    ) : (
                                      <Square className="w-4.5 h-4.5 text-neutral-400" />
                                    )}
                                  </button>
                                ) : (
                                  <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${colorCfg.badge}`} />
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className={`text-sm font-bold text-neutral-900 ${isDone ? 'line-through' : ''}`}>
                                      {evt.title}
                                    </span>
                                    {evt.category && (
                                      <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-600 rounded text-[10px] font-semibold">
                                        {evt.category}
                                      </span>
                                    )}
                                    {evt.reminder_type && evt.reminder_type !== 'none' && (
                                      <span className="inline-flex items-center gap-1 text-[10px] bg-orange-50 text-[#ff6600] border border-orange-200/80 px-1.5 py-0.2 rounded-full font-bold">
                                        <Bell className="w-2.5 h-2.5" />
                                        {evt.reminder_type === '3h' ? '3h before' : evt.reminder_type === '1h' ? '1h before' : evt.reminder_type === '30m' ? '30m before' : evt.reminder_type === 'at_event' ? 'At start' : 'Reminder'}
                                      </span>
                                    )}
                                    {evt.recurrence_rule && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
                                        <Repeat className="w-3 h-3" />
                                        {evt.recurrence_rule}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-neutral-500 font-mono mt-1">
                                    {formatEventTimeRange(evt)}
                                  </div>

                                  {evt.description && (
                                    <p className="text-xs text-neutral-600 mt-1.5 line-clamp-2 leading-relaxed">
                                      {evt.description}
                                    </p>
                                  )}

                                  {sanitizeSafeUrl(evt.location_url) && (
                                    <a
                                      href={sanitizeSafeUrl(evt.location_url)!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1.5 font-medium"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>{evt.location_url}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        )}

        {/* ── VIEW 5: YEAR VIEW (y) ── */}
        {viewMode === 'year' && (
          <div className="flex-1 p-5 sm:p-8 overflow-y-auto bg-neutral-50/50">
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {MONTH_NAMES.map((monthName, mIdx) => {
                const year = currentDate.getFullYear();
                const totalDays = new Date(year, mIdx + 1, 0).getDate();
                const firstDayIdx = new Date(year, mIdx, 1).getDay();

                return (
                  <div
                    key={monthName}
                    onClick={() => {
                      const d = new Date(currentDate);
                      d.setMonth(mIdx);
                      setCurrentDate(d);
                      setViewMode('month');
                    }}
                    className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs hover:ring-2 hover:ring-indigo-400 cursor-pointer transition-all"
                  >
                    <h3 className="font-extrabold text-sm text-neutral-900 mb-2.5">{monthName}</h3>
                    <div className="grid grid-cols-7 text-center text-[9px] font-extrabold text-neutral-400 mb-1.5">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <span key={i}>{d}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs gap-y-1.5 font-medium">
                      {Array.from({ length: firstDayIdx }).map((_, i) => (
                        <span key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: totalDays }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const hasEvents = (eventsByDate[dateStr] || []).length > 0;
                        const isToday = dateStr === toDateString(new Date());

                        return (
                          <span
                            key={dayNum}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayDetails(dateStr);
                            }}
                            className={`w-6 h-6 mx-auto flex items-center justify-center rounded-full cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${
                              isToday
                                ? 'bg-[#ff6600] text-white font-bold'
                                : hasEvents
                                ? 'bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200'
                                : 'text-neutral-700 hover:bg-neutral-100'
                            }`}
                          >
                            {dayNum}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Day Events Inspection & Management Modal ── */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 rounded-2xl shadow-2xl p-6 w-full max-w-lg text-neutral-800 animate-scale-in flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#ff6600]">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-neutral-900 leading-tight">
                    {(() => {
                      const d = new Date(`${selectedDayDetails}T00:00:00`);
                      return `${DAY_NAMES_SHORT[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                    })()}
                  </h3>
                  <span className="text-xs text-neutral-500 font-semibold">
                    {(eventsByDate[selectedDayDetails] || []).length} scheduled item(s)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${selectedDayDetails}T00:00:00`);
                    setCurrentDate(d);
                    setViewMode('day');
                    setSelectedDayDetails(null);
                  }}
                  className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  title="Open 24-hour Day Timeline"
                >
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDayDetails(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Events List for this Day */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 py-1">
              {(eventsByDate[selectedDayDetails] || []).length === 0 ? (
                <div className="py-12 text-center text-neutral-400 flex flex-col items-center justify-center">
                  <Clock className="w-10 h-10 text-neutral-300 mb-2" />
                  <p className="font-bold text-sm text-neutral-700">No events on this day</p>
                  <p className="text-xs text-neutral-400 mt-0.5 mb-4">Click below to schedule an event or task.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const day = selectedDayDetails;
                      setSelectedDayDetails(null);
                      openCreateModal(day);
                    }}
                    className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" /> Add Event
                  </button>
                </div>
              ) : (
                (eventsByDate[selectedDayDetails] || []).map((evt) => {
                  const colorCfg = getColorConfig(evt.color);
                  const isTask = evt.is_task;
                  const isDone = evt.is_completed;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => {
                        setSelectedDayDetails(null);
                        openEditModal(evt);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${
                        colorCfg.bg
                      } ${colorCfg.border} ${isDone ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          {isTask ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleTaskComplete(evt.id, e)}
                              className="mt-0.5 hover:scale-110 cursor-pointer shrink-0"
                            >
                              {isDone ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-400" />
                              )}
                            </button>
                          ) : (
                            <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${colorCfg.badge}`} />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className={`text-xs sm:text-sm font-extrabold text-neutral-900 ${isDone ? 'line-through' : ''}`}>
                                {evt.title}
                              </h4>
                              {evt.category && (
                                <span className="px-1.5 py-0.5 bg-white/80 border border-neutral-200 text-neutral-600 rounded text-[10px] font-bold">
                                  {evt.category}
                                </span>
                              )}
                              {evt.reminder_type && evt.reminder_type !== 'none' && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-orange-50 text-[#ff6600] border border-orange-200 px-1.5 py-0.2 rounded-full font-bold">
                                  <Bell className="w-2.5 h-2.5" />
                                  {evt.reminder_type === '3h' ? '3h before' : evt.reminder_type === '1h' ? '1h before' : evt.reminder_type === '30m' ? '30m before' : evt.reminder_type === 'at_event' ? 'At start' : 'Reminder'}
                                </span>
                              )}
                              {evt.recurrence_rule && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
                                  <Repeat className="w-3 h-3" />
                                  {evt.recurrence_rule}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] font-mono font-semibold text-neutral-600 mt-1">
                              {formatEventTimeRange(evt)}
                            </div>

                            {evt.description && (
                              <p className="text-xs text-neutral-600 mt-1.5 line-clamp-2 leading-relaxed">
                                {evt.description}
                              </p>
                            )}

                            {sanitizeSafeUrl(evt.location_url) && (
                              <a
                                href={sanitizeSafeUrl(evt.location_url)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1.5 font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>{evt.location_url}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayDetails(null);
                              openEditModal(evt);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-white/80 rounded-lg cursor-pointer transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEventToDelete(evt);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-white/80 rounded-lg cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3.5 border-t border-neutral-100 mt-3">
              <button
                type="button"
                onClick={() => {
                  const day = selectedDayDetails;
                  setSelectedDayDetails(null);
                  openCreateModal(day);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Event</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayDetails(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Create / Edit Modal Popover (Expanded Window Size) ── */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 rounded-xl shadow-2xl p-6 sm:p-7 w-full max-w-xl sm:max-w-2xl text-neutral-800 animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                <span>{editingEvent ? 'Edit Event / Task' : 'Create Event or Task'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg cursor-pointer hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Event vs Task Toggle */}
            <div className="flex items-center gap-2 mb-4 bg-neutral-100 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormIsTask(false)}
                className={`flex-1 py-1.5 rounded-md text-center cursor-pointer transition-all ${
                  !formIsTask ? 'bg-white shadow-xs text-neutral-900 font-extrabold' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Event
              </button>
              <button
                type="button"
                onClick={() => setFormIsTask(true)}
                className={`flex-1 py-1.5 rounded-md text-center cursor-pointer transition-all ${
                  formIsTask ? 'bg-white shadow-xs text-neutral-900 font-extrabold' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                Task (Checkable To-Do)
              </button>
            </div>

            {/* Title Input */}
            <div className="mb-4">
              <label className="text-xs font-bold text-neutral-700 mb-1.5 block">Title</label>
              <input
                ref={titleInputRef}
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Add title and event details..."
                className="w-full text-base font-bold bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-neutral-900"
              />
            </div>

            {/* Date Pickers */}
            <div className={`grid ${formHasEndTime ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 mb-3`}>
              <div>
                <label className="text-xs font-bold text-neutral-700 mb-1.5 block">Start Date</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => {
                    setFormStartDate(e.target.value);
                    if (!formEndDate || formEndDate < e.target.value) {
                      setFormEndDate(e.target.value);
                    }
                  }}
                  className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {formHasEndTime && (
                <div>
                  <label className="text-xs font-bold text-neutral-700 mb-1.5 block">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}
            </div>

            {/* End Time & All-Day Options Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2 text-xs font-semibold">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Checkbox to add End Time */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formHasEndTime}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormHasEndTime(checked);
                      if (checked && !formEndDate) {
                        setFormEndDate(formStartDate);
                      }
                    }}
                    className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-neutral-800 font-bold">Has end time / duration</span>
                </label>

                {/* All Day Toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsAllDay}
                    onChange={(e) => setFormIsAllDay(e.target.checked)}
                    className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-neutral-700 font-bold">All day</span>
                </label>
              </div>

              {/* Recurrence Dropdown */}
              <div className="flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-neutral-500" />
                <select
                  value={formRecurrence}
                  onChange={(e) => setFormRecurrence(e.target.value)}
                  className="text-xs bg-white border border-neutral-200 rounded-md px-2.5 py-1 outline-none font-bold text-neutral-700 cursor-pointer shadow-2xs"
                >
                  <option value="">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            {/* Time Pickers (if not all day) */}
            {!formIsAllDay && (
              <div className={`grid ${formHasEndTime ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 mb-3`}>
                <div>
                  <label className="text-xs font-bold text-neutral-700 mb-1.5 block">Start Time</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full text-xs font-mono font-bold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                {formHasEndTime && (
                  <div>
                    <label className="text-xs font-bold text-neutral-700 mb-1.5 block">End Time</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full text-xs font-mono font-bold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Color Palette & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-bold text-neutral-700 mb-1.5 block">Color Tag</label>
                <div className="flex items-center gap-2.5 pt-0.5">
                  {COLOR_PALETTES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormColor(c.id)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${c.badge} ${
                        formColor === c.id ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-xs' : 'hover:scale-110'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 mb-1.5 block">Category / Tag</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Work, Personal, Meeting"
                  className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Location / URL Input */}
            <div className="mb-3">
              <label className="text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-500" /> Location or Meeting Link
              </label>
              <input
                type="text"
                value={formLocationUrl}
                onChange={(e) => setFormLocationUrl(e.target.value)}
                placeholder="Add meeting URL (Google Meet, Zoom) or room..."
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-medium"
              />
            </div>

            {/* Reminder & Notification Channels */}
            <div className="mb-4 bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#ff6600]" /> Remind When
                </label>
                <select
                  value={formReminderType}
                  onChange={(e) => setFormReminderType(e.target.value)}
                  className="text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 outline-none font-bold text-neutral-800 cursor-pointer shadow-2xs"
                >
                  <option value="none">No reminder</option>
                  <option value="at_event">At time of event (0 min)</option>
                  <option value="15m">15 minutes before</option>
                  <option value="30m">30 minutes before</option>
                  <option value="1h">1 hour before</option>
                  <option value="3h">3 hours before</option>
                  <option value="1d">1 day before</option>
                  <option value="custom">Specific custom time...</option>
                </select>
              </div>

              {/* Custom Date & Time if selected */}
              {formReminderType === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-neutral-200/70">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-600 mb-1 block">Alert Date</label>
                    <input
                      type="date"
                      value={formReminderCustomDate}
                      onChange={(e) => setFormReminderCustomDate(e.target.value)}
                      className="w-full text-xs font-semibold bg-white border border-neutral-200 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-neutral-600 mb-1 block">Alert Time</label>
                    <input
                      type="time"
                      value={formReminderCustomTime}
                      onChange={(e) => setFormReminderCustomTime(e.target.value)}
                      className="w-full text-xs font-mono font-bold bg-white border border-neutral-200 rounded-lg px-3 py-1.5 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Notification Channels (Email & Telegram) */}
              {formReminderType !== 'none' && (
                <div className="flex flex-col gap-3 pt-2.5 border-t border-neutral-200/70">
                  <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                    Notification Channels (Email & Telegram)
                  </span>

                  {/* Email Channel */}
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-neutral-800">
                      <input
                        type="checkbox"
                        checked={formReminderChannelEmail}
                        onChange={(e) => setFormReminderChannelEmail(e.target.checked)}
                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-neutral-500" /> Send Email Notification
                      </span>
                    </label>
                    {formReminderChannelEmail && (
                      <input
                        type="email"
                        value={formReminderEmail}
                        onChange={(e) => setFormReminderEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        className="w-full text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 outline-none font-medium"
                      />
                    )}
                  </div>

                  {/* Telegram Channel */}
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-neutral-800">
                      <input
                        type="checkbox"
                        checked={formReminderChannelTelegram}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormReminderChannelTelegram(checked);
                          if (checked && !formReminderTelegramChatId) {
                            const savedTg = localStorage.getItem('nidus_telegram_chat_id') || '';
                            if (savedTg) setFormReminderTelegramChatId(savedTg);
                          }
                        }}
                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-sky-500" /> Send Telegram Bot Alert
                      </span>
                    </label>
                    {formReminderChannelTelegram && (
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={formReminderTelegramChatId}
                          onChange={(e) => setFormReminderTelegramChatId(e.target.value)}
                          placeholder="Your Telegram Chat ID (e.g. 123456789)"
                          className="w-full text-xs bg-white border border-neutral-200 rounded-lg px-3 py-1.5 outline-none font-medium"
                        />
                        <span className="text-[10px] text-neutral-400">
                          Tip: Message <strong>@userinfobot</strong> on Telegram to instantly find your numeric Chat ID.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Test Dispatch Button */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      disabled={testNotifyStatus === 'sending' || (!formReminderChannelEmail && !formReminderChannelTelegram)}
                      className="px-3 py-1.5 text-xs font-bold bg-neutral-200/80 hover:bg-neutral-300 text-neutral-800 rounded-md cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {testNotifyStatus === 'sending' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-600" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                      <span>{testNotifyStatus === 'sending' ? 'Sending Test...' : 'Send Test Notification Now'}</span>
                    </button>

                    {testNotifyMsg && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          testNotifyStatus === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {testNotifyMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description Notes */}
            <div className="mb-5">
              <label className="text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <AlignLeft className="w-3.5 h-3.5 text-neutral-500" /> Description / Notes
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Add description, agenda items or notes..."
                rows={3}
                className="w-full text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 resize-none font-medium"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              {editingEvent ? (
                <button
                  type="button"
                  onClick={() => setEventToDelete(editingEvent)}
                  className="px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvent}
                  disabled={!formTitle.trim()}
                  className="px-5 py-2 text-xs font-extrabold bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all"
                >
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── .ics iCalendar Import Modal ── */}
      {isIcsImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 rounded-lg shadow-2xl p-5 w-full max-w-md text-neutral-800 animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm">Import iCalendar (.ics) File</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsIcsImportModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed mb-4">
              Upload standard <strong>.ics</strong> files exported from Google Calendar, Apple Calendar, or Outlook.
            </p>

            <input
              ref={icsFileInputRef}
              type="file"
              accept=".ics,.ical,text/calendar"
              onChange={handleIcsFileUpload}
              className="hidden"
            />

            {icsImportStatus === 'idle' && (
              <div
                onClick={() => icsFileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-indigo-500 bg-neutral-50/50 hover:bg-indigo-50/20 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all mb-4"
              >
                <FileText className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-xs font-bold text-neutral-700 mb-1">Click to select .ics file</span>
                <span className="text-[10px] text-neutral-400">Supports standard VEVENT calendar exports</span>
              </div>
            )}

            {icsImportStatus === 'parsing' && (
              <div className="p-6 flex flex-col items-center justify-center text-center gap-2 bg-neutral-50 rounded-lg mb-4">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs font-bold text-neutral-700">Reading & parsing calendar events...</span>
              </div>
            )}

            {icsImportStatus === 'success' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 mb-0.5">Import Completed!</h4>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Successfully imported <strong>{icsImportCount} events</strong> into your calendar workspace.
                  </p>
                </div>
              </div>
            )}

            {icsImportStatus === 'error' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-900 mb-0.5">Import Failed</h4>
                  <p className="text-[11px] text-red-700 leading-relaxed">{icsImportError}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsIcsImportModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded-md cursor-pointer"
              >
                {icsImportStatus === 'success' ? 'Done' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Delete Confirmation Modal ── */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-neutral-300 shadow-2xl p-4 sm:p-5 w-full max-w-xs text-neutral-800">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <Trash2 className="w-4 h-4 shrink-0" />
              <h3 className="font-extrabold text-xs sm:text-sm">Delete Event / Task?</h3>
            </div>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              Are you sure you want to delete <strong className="text-neutral-900">"{eventToDelete.title}"</strong>?
            </p>
            <div className="flex items-center justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-none cursor-pointer"
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
