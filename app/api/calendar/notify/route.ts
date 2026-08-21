import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      eventTitle,
      startTime,
      description,
      channel, // 'telegram' | 'email' | 'all'
      telegramChatId,
      telegramBotToken,
      email,
      resendApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      reminderLabel,
    } = body;

    const results: { telegram?: any; email?: any; errors?: string[] } = {};
    const errors: string[] = [];

    const formattedTime = startTime
      ? new Date(startTime).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST (GMT+5:30)'
      : 'Scheduled time';

    const messageText = `🔔 *Nidus Calendar Reminder*\n\n📌 *${eventTitle || 'Upcoming Event'}*\n⏰ *Time:* ${formattedTime}\n⏱ *Alert:* ${reminderLabel || 'Reminder'}${description ? `\n📝 *Notes:* ${description}` : ''}\n\n_Sent from Nidus Workspace_`;

    // 1. Dispatch Telegram Notification
    if ((channel === 'telegram' || channel === 'all') && telegramChatId) {
      const token = telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: messageText,
              parse_mode: 'Markdown',
            }),
          });
          const tgData = await tgRes.json();
          results.telegram = tgData;
          if (!tgData.ok) {
            errors.push(`Telegram error: ${tgData.description || 'Unknown error'}`);
          }
        } catch (err: any) {
          errors.push(`Telegram send failed: ${err.message}`);
        }
      } else {
        results.telegram = {
          ok: false,
          error: 'Missing TELEGRAM_BOT_TOKEN in .env or Vercel settings.',
        };
        errors.push('Missing TELEGRAM_BOT_TOKEN. Please set TELEGRAM_BOT_TOKEN in your .env / Vercel settings.');
      }
    }

    // 2. Dispatch Email Notification (Personal Mail / SMTP / Supabase Mailer / Resend)
    if ((channel === 'email' || channel === 'all') && email) {
      const host = smtpHost || process.env.SMTP_HOST || (process.env.SMTP_USER?.includes('@gmail.com') ? 'smtp.gmail.com' : '');
      const port = Number(smtpPort || process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
      const user = smtpUser || process.env.SMTP_USER || process.env.EMAIL_USER;
      const pass = smtpPass || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
      const apiKey = resendApiKey || process.env.RESEND_API_KEY;

      let emailDispatched = false;

      // Method A: Personal Email SMTP (e.g. Gmail / Outlook / Custom SMTP configured in Supabase or Nidus)
      if (user && pass) {
        try {
          const transporter = nodemailer.createTransport({
            host: host || 'smtp.gmail.com',
            port: port || 465,
            secure: port === 465,
            auth: { user, pass },
          });

          const info = await transporter.sendMail({
            from: `"Nidus Workspace" <${user}>`,
            to: email,
            subject: `Reminder: ${eventTitle || 'Upcoming Event'}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                  <span style="font-size: 24px;">📅</span>
                  <h2 style="margin: 0; font-size: 18px; color: #111827; font-weight: 800;">Nidus Calendar Reminder</h2>
                </div>
                <div style="padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #ff6600; margin-bottom: 16px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827; font-weight: 700;">${eventTitle}</h3>
                  <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Time:</strong> ${formattedTime}</p>
                  <p style="margin: 6px 0 0 0; font-size: 13px; color: #6b7280;"><strong>Reminder:</strong> ${reminderLabel || 'Alert'}</p>
                  ${description ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #374151; line-height: 1.5;">${description}</p>` : ''}
                </div>
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">Sent directly from your personal email via Nidus Workspace.</p>
              </div>
            `,
          });

          results.email = { ok: true, provider: 'smtp', messageId: info.messageId };
          emailDispatched = true;
        } catch (err: any) {
          errors.push(`Personal SMTP failed: ${err.message}`);
        }
      }

      // Method B: Resend (if configured)
      if (!emailDispatched && apiKey) {
        try {
          const fromEmail = process.env.EMAIL_FROM || 'Nidus Calendar <onboarding@resend.dev>';
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: `🔔 Reminder: ${eventTitle || 'Upcoming Event'}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <span style="font-size: 24px;">📅</span>
                    <h2 style="margin: 0; font-size: 18px; color: #111827; font-weight: 800;">Nidus Calendar Reminder</h2>
                  </div>
                  <div style="padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #ff6600; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827; font-weight: 700;">${eventTitle}</h3>
                    <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Time:</strong> ${formattedTime}</p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #6b7280;"><strong>Reminder:</strong> ${reminderLabel || 'Alert'}</p>
                    ${description ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #374151; line-height: 1.5;">${description}</p>` : ''}
                  </div>
                  <p style="font-size: 12px; color: #9ca3af; margin: 0;">Sent automatically by your Nidus Workspace.</p>
                </div>
              `,
            }),
          });

          const emailData = await emailRes.json();
          results.email = emailData;

          if (emailRes.ok && !emailData.error) {
            emailDispatched = true;
          } else {
            const errMsg = emailData.error?.message || emailData.message || `Resend error ${emailRes.status}`;
            errors.push(`Resend error: ${errMsg}`);
          }
        } catch (err: any) {
          errors.push(`Resend delivery failed: ${err.message}`);
        }
      }

      if (!emailDispatched && errors.length === 0) {
        errors.push('Please configure your Email App Password (or SMTP credentials) in Settings > Notifications & Alerts to send reminder emails.');
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Notification service failed' },
      { status: 500 }
    );
  }
}
