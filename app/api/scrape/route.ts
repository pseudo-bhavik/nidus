import { NextResponse } from 'next/server';
import { getLinkPreview } from 'link-preview-js';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      // Prepend https:// if protocol is missing
      let normalizedUrl = url.trim();
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      parsedUrl = new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const domain = parsedUrl.hostname.replace('www.', '');

    // YouTube Bypass: Vercel data center IPs are blocked by YouTube's web interface.
    // We use the official oEmbed API which does not require API keys or block data centers.
    const isYouTube = domain.includes('youtube.com') || domain.includes('youtu.be');
    if (isYouTube) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}&format=json`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'YouTube Video',
            description: data.author_name ? `Video by ${data.author_name} on YouTube` : 'YouTube Video',
            domain: 'youtube.com',
            thumbnailUrl: data.thumbnail_url || 'https://www.youtube.com/s/desktop/513a5249/img/favicon_32x32.png',
            readTimeMinutes: 2,
          });
        }
      } catch (youtubeError) {
        console.error('YouTube oEmbed lookup failed, falling back to scraper:', youtubeError);
      }
    }

    // Spotify oEmbed Bypass
    if (domain.includes('spotify.com')) {
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'Spotify Content',
            description: data.provider_name || 'Spotify',
            domain: 'spotify.com',
            thumbnailUrl: data.thumbnail_url || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
            readTimeMinutes: 3,
          });
        }
      } catch (e) {
        console.error('Spotify oEmbed lookup failed:', e);
      }
    }

    // Vimeo oEmbed Bypass
    if (domain.includes('vimeo.com')) {
      try {
        const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(parsedUrl.toString())}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'Vimeo Video',
            description: data.description || `Video by ${data.author_name || 'Creator'} on Vimeo`,
            domain: 'vimeo.com',
            thumbnailUrl: data.thumbnail_url || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
            readTimeMinutes: 2,
          });
        }
      } catch (e) {
        console.error('Vimeo oEmbed lookup failed:', e);
      }
    }

    // TikTok oEmbed Bypass
    if (domain.includes('tiktok.com')) {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'TikTok Content',
            description: data.author_name ? `Video by ${data.author_name} on TikTok` : 'TikTok Content',
            domain: 'tiktok.com',
            thumbnailUrl: data.thumbnail_url || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
            readTimeMinutes: 1,
          });
        }
      } catch (e) {
        console.error('TikTok oEmbed lookup failed:', e);
      }
    }

    try {
      // Use getLinkPreview to extract metadata
      const previewData: any = await getLinkPreview(parsedUrl.toString(), {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 8000,
      });

      const title = previewData.title || domain;
      const description = previewData.description || '';
      
      // Heuristic: estimate reading time based on description length
      const wordCount = description.trim().split(/\s+/).filter(Boolean).length;
      const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

      // Resolve thumbnail URL from images or favicons
      let thumbnailUrl = '';
      if (previewData.images && previewData.images.length > 0) {
        thumbnailUrl = previewData.images[0];
      } else if (previewData.favicons && previewData.favicons.length > 0) {
        thumbnailUrl = previewData.favicons[0];
      } else {
        // Fallback to Google Favicon Lookup CDN for a clean branded icon
        thumbnailUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
      }

      return NextResponse.json({
        url: parsedUrl.toString(),
        title,
        description,
        domain,
        thumbnailUrl,
        readTimeMinutes,
      });
    } catch (scrapeError) {
      console.error('Metadata scraping failed, using fallback:', scrapeError);
      // Fallback response: resolve site name from domain, supply a clean favicon
      const cleanTitle = domain.split('.')[0];
      const capitalizedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      
      return NextResponse.json({
        url: parsedUrl.toString(),
        title: capitalizedTitle || domain,
        description: '',
        domain,
        thumbnailUrl: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
        readTimeMinutes: 1,
      });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
