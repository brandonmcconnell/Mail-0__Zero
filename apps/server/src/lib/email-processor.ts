import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

interface ProcessEmailOptions {
  html: string;
  shouldLoadImages: boolean;
  theme: 'light' | 'dark';
}

export function processEmailHtml({ html, shouldLoadImages, theme }: ProcessEmailOptions): {
  processedHtml: string;
  hasBlockedImages: boolean;
} {
  let hasBlockedImages = false;

  const sanitizeConfig: sanitizeHtml.IOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: false,
    allowedSchemes: shouldLoadImages
      ? ['http', 'https', 'mailto', 'tel', 'data', 'cid', 'blob']
      : ['http', 'https', 'mailto', 'tel', 'cid'],
    allowedSchemesByTag: {
      img: shouldLoadImages ? ['http', 'https', 'data', 'cid', 'blob'] : ['cid'],
    },
    transformTags: {
      img: (tagName, attribs) => {
        if (!shouldLoadImages && attribs.src && !attribs.src.startsWith('cid:')) {
          hasBlockedImages = true;
          return { tagName: 'span', attribs: { style: 'display:none;' } };
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => {
        return {
          tagName,
          attribs: {
            ...attribs,
            target: attribs.target || '_blank',
            rel: 'noopener noreferrer',
          },
        };
      },
    },
  };

  const sanitized = sanitizeHtml(html, sanitizeConfig);

  const $ = cheerio.load(sanitized);

  $('img[width="1"][height="1"]').remove();
  $('img[width="0"][height="0"]').remove();

  $('.preheader, .preheaderText, [class*="preheader"]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    if (
      style.includes('display:none') ||
      style.includes('display: none') ||
      style.includes('font-size:0') ||
      style.includes('font-size: 0') ||
      style.includes('line-height:0') ||
      style.includes('line-height: 0') ||
      style.includes('max-height:0') ||
      style.includes('max-height: 0') ||
      style.includes('mso-hide:all') ||
      style.includes('opacity:0') ||
      style.includes('opacity: 0')
    ) {
      $el.remove();
    }
  });

  const minimalStyles = `
    <style type="text/css">
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        line-height: 1.5;
        background-color: ${theme === 'dark' ? '#1A1A1A' : '#ffffff'};
        color: ${theme === 'dark' ? '#ffffff' : '#000000'};
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
      }

      a {
        cursor: pointer;
        color: ${theme === 'dark' ? '#60a5fa' : '#2563eb'};
        text-decoration: underline;
      }

      a:hover {
        color: ${theme === 'dark' ? '#93bbfc' : '#1d4ed8'};
      }

      img {
        max-width: 100%;
        height: auto;
        display: block;
      }

      table {
        border-collapse: collapse;
      }

      .gmail_quote {
        margin: 1em 0;
        padding-left: 1em;
        border-left: 1px solid ${theme === 'dark' ? '#666' : '#ccc'};
      }

      ::selection {
        background: #b3d4fc;
        text-shadow: none;
      }
    </style>
  `;

  const fullHtml = $.html();

  const finalHtml = `${minimalStyles}${fullHtml}`;

  return {
    processedHtml: finalHtml,
    hasBlockedImages,
  };
}
