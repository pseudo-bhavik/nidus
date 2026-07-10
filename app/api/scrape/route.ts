import { NextResponse } from 'next/server';
import { getLinkPreview } from 'link-preview-js';
import dns from 'node:dns';

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

    // GitHub API Bypass (public endpoints bypass scraping blocks)
    if (domain === 'github.com') {
      try {
        const paths = parsedUrl.pathname.split('/').filter(Boolean);
        if (paths.length >= 2) {
          const owner = paths[0];
          const repo = paths[1];
          const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}`;
          const res = await fetch(githubApiUrl, {
            headers: { 'user-agent': 'NidusBookmarkScraper' },
            signal: AbortSignal.timeout(5000)
          });
          if (res.ok) {
            const data = await res.json();
            return NextResponse.json({
              url: parsedUrl.toString(),
              title: data.full_name || `${owner}/${repo}`,
              description: data.description || `GitHub repository by ${owner}`,
              domain: 'github.com',
              thumbnailUrl: data.owner?.avatar_url || 'https://github.githubassets.com/favicons/favicon.svg',
              readTimeMinutes: Math.max(1, Math.ceil((data.description || '').length / 200)),
            });
          }
        }
      } catch (githubError) {
        console.error('GitHub API lookup failed, falling back:', githubError);
      }
    }

    // Reddit oEmbed Bypass
    if (domain.includes('reddit.com')) {
      try {
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`;
        const res = await fetch(oembedUrl, {
          headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'Reddit Thread',
            description: data.author_name ? `Subreddit: ${data.author_name}` : 'Reddit Link',
            domain: 'reddit.com',
            thumbnailUrl: data.thumbnail_url || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
            readTimeMinutes: 2,
          });
        }
      } catch (e) {
        console.error('Reddit oEmbed lookup failed:', e);
      }
    }

    // Medium oEmbed Bypass
    if (domain.includes('medium.com')) {
      try {
        const oembedUrl = `https://medium.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            url: parsedUrl.toString(),
            title: data.title || 'Medium Article',
            description: data.author_name ? `Article by ${data.author_name} on Medium` : 'Medium Article',
            domain: 'medium.com',
            thumbnailUrl: data.thumbnail_url || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
            readTimeMinutes: 4,
          });
        }
      } catch (e) {
        console.error('Medium oEmbed lookup failed:', e);
      }
    }

    try {
      // Use getLinkPreview to extract metadata with secure DNS host resolution to prevent SSRF loopbacks
      const previewData: any = await getLinkPreview(parsedUrl.toString(), {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 8000,
        resolveDNSHost: async (url) => {
          return new Promise((resolve, reject) => {
            try {
              const hostname = new URL(url).hostname;
              dns.lookup(hostname, (err, address) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(address);
                }
              });
            } catch (e) {
              reject(e);
            }
          });
        }
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
    } catch (scrapeError: any) {
      console.warn(`Scrape library fallback warning for ${domain} (trying direct fetch):`, scrapeError.message || scrapeError);
      
      // Fallback Layer 1: Try a direct HTML fetch with a simulated mobile User-Agent to bypass bot guards
      try {
        const rawHtmlRes = await fetch(parsedUrl.toString(), {
          headers: {
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.5',
            'referer': 'https://www.google.com/',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (rawHtmlRes.ok) {
          const htmlText = await rawHtmlRes.text();
          
          // Regex match OG title or Standard title
          let parsedTitle = '';
          const ogTitleMatch = htmlText.match(/<meta[^>]+(?:property|name)="og:title"[^>]+content="([^"]+)"/i) ||
                             htmlText.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="og:title"/i);
          if (ogTitleMatch) {
            parsedTitle = ogTitleMatch[1];
          } else {
            const standardTitleMatch = htmlText.match(/<title[^>]*>(.*?)<\/title>/i);
            if (standardTitleMatch) {
              parsedTitle = standardTitleMatch[1];
            }
          }

          // Regex match OG description or meta description
          let parsedDescription = '';
          const ogDescMatch = htmlText.match(/<meta[^>]+(?:property|name)="og:description"[^>]+content="([^"]+)"/i) ||
                            htmlText.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="og:description"/i) ||
                            htmlText.match(/<meta[^>]+(?:property|name)="description"[^>]+content="([^"]+)"/i) ||
                            htmlText.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="description"/i);
          if (ogDescMatch) {
            parsedDescription = ogDescMatch[1];
          }

          // Regex match OG image
          let parsedImage = '';
          const ogImageMatch = htmlText.match(/<meta[^>]+(?:property|name)="og:image"[^>]+content="([^"]+)"/i) ||
                             htmlText.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="og:image"/i);
          if (ogImageMatch) {
            parsedImage = ogImageMatch[1];
          } else {
            // Standard shortcut icon/icon
            const iconMatch = htmlText.match(/<link[^>]+rel="(?:shortcut\s+)?icon"[^>]+href="([^"]+)"/i) ||
                              htmlText.match(/<link[^>]+href="([^"]+)"[^>]+rel="(?:shortcut\s+)?icon"/i);
            if (iconMatch) {
              const rawHref = iconMatch[1];
              if (rawHref.startsWith('//')) {
                parsedImage = 'https:' + rawHref;
              } else if (rawHref.startsWith('/')) {
                parsedImage = parsedUrl.origin + rawHref;
              } else if (!rawHref.startsWith('http')) {
                parsedImage = parsedUrl.origin + '/' + rawHref;
              } else {
                parsedImage = rawHref;
              }
            }
          }

          // Simple entity decoder
          const decodeEntities = (str: string) => {
            return str
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'")
              .replace(/&nbsp;/g, ' ')
              .trim();
          };

          if (parsedTitle) {
            return NextResponse.json({
              url: parsedUrl.toString(),
              title: decodeEntities(parsedTitle),
              description: decodeEntities(parsedDescription),
              domain,
              thumbnailUrl: parsedImage || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
              readTimeMinutes: Math.max(1, Math.ceil(parsedDescription.length / 300)),
            });
          }
        }
      } catch (directFetchError) {
        console.warn('Direct fallback HTML fetch failed too:', directFetchError);
      }

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
