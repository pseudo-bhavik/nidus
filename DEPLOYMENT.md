# Nidus — Deployment & Cloud Sync Plan

This document outlines the step-by-step production setup and deployment process for the **Nidus** Link Manager using **Vercel** for frontend hosting, and **Supabase** for database storage and user authentication.

---

## 1. Supabase Database Configuration

### Step A: Initialize the Database Schema
Execute the following SQL query in your Supabase project's **SQL Editor** to create the bookmarks table structure:

```sql
-- Create bookmarks table schema
create table public.bookmarks (
  id uuid default gen_random_uuid() primary key,
  url text not null,
  domain text not null,
  title text not null,
  description text default '',
  thumbnail_url text default '',
  category text default 'Unsorted',
  priority text default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  read_time_minutes integer default 2,
  is_completed boolean default false,
  is_trashed boolean default false,
  notes text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid()
);

-- Enable Row Level Security (RLS)
alter table public.bookmarks enable row level security;
```

### Step B: Enable Row-Level Security (RLS) Policies
RLS guarantees that users can only select, insert, or modify their own bookmark link logs. Guest (anonymous) bookmarks fall back to standard local client storage.

Run this SQL block to configure isolated policies:

```sql
-- Select policy: Allow logged-in users to fetch their own links
create policy "Users can read own bookmarks"
on public.bookmarks for select
using (auth.uid() = user_id);

-- Insert policy: Bind links to the active user's uuid
create policy "Users can insert own bookmarks"
on public.bookmarks for insert
with check (auth.uid() = user_id);

-- Update policy: Allow users to edit details in their own lines
create policy "Users can update own bookmarks"
on public.bookmarks for update
using (auth.uid() = user_id);

-- Delete policy: Allow users to delete links permanently
create policy "Users can delete own bookmarks"
on public.bookmarks for delete
using (auth.uid() = user_id);
```

---

## 2. Supabase Authentication Setup

1. In your Supabase Dashboard, navigate to **Project Settings** > **Authentication**.
2. Under **Auth Providers**, confirm that **Email** is **Enabled**.
3. Under **User Sign-up**, configure whether you want **Confirm Email** turned **ON** or **OFF** (turn it off if you want sign-ups to log in immediately without waiting for verification emails).
4. Under **Site URL**, set your production Vercel domain URL (e.g. `https://nidus-links.vercel.app`) to handle logins and password recovery redirects.

---

## 3. Vercel Hosting Deployment

### Step A: Configure Production Environment Variables
Set the following variables inside **Vercel Project Settings** > **Environment Variables**:

| Variable Key | Type | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | Your Supabase Project API URL endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Plaintext | Your Supabase Project Publishable Key (starting with `sb_publishable_`) |

*Note: For backwards compatibility, the application also supports the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` name if you have it configured already.*

### Step B: Deploying Code
1. Connect your repository to Vercel.
2. Vercel will automatically auto-detect the **Next.js** framework configuration.
3. Keep default settings:
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
4. Click **Deploy**. Vercel will build, optimize static files, deploy API scrape endpoints, and allocate a production domain.
