import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { events } = await req.json().catch(() => ({ events: null }));

    let eventsToCheck = events;

    // If events are not passed from client, query from Supabase
    if (!eventsToCheck || !Array.isArray(eventsToCheck)) {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .neq('reminder_type', 'none');
      if (!error && data) {
        eventsToCheck = data;
      } else {
        eventsToCheck = [];
      }
    }

    const now = Date.now();
    const dispatched: string[] = [];
    const errors: string[] = [];

    for (const evt of eventsToCheck) {
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

      // Check if due: within last 1 hour or current time up to reminder time + tolerance
      const isDue = now >= reminderMs && now - reminderMs <= 60 * 60 * 1000;

      if (isDue) {
        const hasTg = evt.reminder_channel_telegram && evt.reminder_telegram_chat_id;
        const hasEmail = evt.reminder_channel_email && evt.reminder_email;

        if (hasTg || hasEmail) {
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

          const formattedTime = new Date(evt.start_time).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }) + ' IST (GMT+5:30)';

          const messageText = `🔔 *Nidus Calendar Reminder*\n\n📌 *${evt.title}*\n⏰ *Time:* ${formattedTime}\n⏱ *Alert:* ${reminderLabel}${evt.description ? `\n📝 *Notes:* ${evt.description}` : ''}\n\n_Sent from Nidus Workspace_`;

          // Dispatch Telegram
          if (hasTg) {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (token) {
              try {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: evt.reminder_telegram_chat_id,
                    text: messageText,
                    parse_mode: 'Markdown',
                  }),
                });
                dispatched.push(`Telegram: ${evt.title}`);
              } catch (e: any) {
                errors.push(`Telegram fail for ${evt.title}: ${e.message}`);
              }
            }
          }

          // Dispatch Email
          if (hasEmail) {
            const resendApiKey = process.env.RESEND_API_KEY;
            if (resendApiKey) {
              try {
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${resendApiKey}`,
                  },
                  body: JSON.stringify({
                    from: 'Nidus Calendar <notifications@nidus.app>',
                    to: [evt.reminder_email],
                    subject: `Reminder: ${evt.title}`,
                    html: `<p><strong>${evt.title}</strong></p><p>Time: ${formattedTime}</p>`,
                  }),
                });
                dispatched.push(`Email: ${evt.title}`);
              } catch (e: any) {
                errors.push(`Email fail for ${evt.title}: ${e.message}`);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      dispatchedCount: dispatched.length,
      dispatched,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
