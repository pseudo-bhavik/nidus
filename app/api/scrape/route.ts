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
      // Fallback response for scraper failure / blockages
      return NextResponse.json({
        url: parsedUrl.toString(),
        title: domain,
        description: '',
        domain,
        thumbnailUrl: '',
        readTimeMinutes: 1,
      });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
