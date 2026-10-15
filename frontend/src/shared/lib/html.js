import DOMPurify from 'dompurify';

// Reading content is static text, links, images and tables: nothing that collects
// input or restyles the page.
const CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'option', 'style'],
  FORBID_ATTR: ['style'],
};

/**
 * HTML that is safe to put in the page: formatting stays, anything that runs
 * (scripts, event handlers, javascript: links, frames, forms) is removed.
 *
 * Reading lectures are HTML written by an instructor and shown to learners.
 * The server cleans it when it is stored; this is the second line, applied at
 * the one place that renders it.
 */
export function safeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), CONFIG);
}
