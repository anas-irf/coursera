import { safeHtml } from './html';

describe('safeHtml', () => {
  it('keeps formatting', () => {
    const html = '<h2>Title</h2><p>Some <b>bold</b> and <em>italic</em> text</p><ul><li>one</li></ul>';
    expect(safeHtml(html)).toBe(html);
  });

  it('keeps links and images but not what runs', () => {
    const cleaned = safeHtml(
      // eslint-disable-next-line no-script-url
      '<a href="https://example.com/doc">docs</a><a href="javascript:alert(1)">bad</a>' +
        '<img src="https://example.com/a.png" onerror="alert(2)">'
    );

    expect(cleaned).toContain('href="https://example.com/doc"');
    // eslint-disable-next-line no-script-url
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('src="https://example.com/a.png"');
    expect(cleaned).not.toContain('onerror');
  });

  it('removes scripts, event handlers, frames and forms', () => {
    const cleaned = safeHtml(
      '<p onclick="steal()">hi</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>' +
        '<form action="https://evil.test"><input name="x"></form>'
    );

    expect(cleaned).toBe('<p>hi</p>');
  });

  it('answers an empty string for nothing', () => {
    expect(safeHtml(null)).toBe('');
    expect(safeHtml(undefined)).toBe('');
    expect(safeHtml('')).toBe('');
  });
});
