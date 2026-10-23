"""Files the seed generates itself, so a fresh checkout needs no downloads.

* course thumbnails: a gradient per category with the title on it (every course
  card needs a real image file);
* submission files: a small but valid PDF or plain text document.
"""
import io
import textwrap

from PIL import Image, ImageDraw, ImageFont

THUMBNAIL_SIZE = (960, 540)

# (from, to) colours per Explore category slug
PALETTES = {
    'programming': ((67, 56, 202), (168, 85, 247)),
    'web-development': ((29, 78, 216), (6, 182, 212)),
    'data-science': ((4, 120, 87), (45, 212, 191)),
    'design': ((190, 24, 93), (251, 146, 60)),
    'marketing': ((217, 119, 6), (220, 38, 38)),
    'business': ((51, 65, 85), (59, 130, 246)),
}
DEFAULT_PALETTE = ((55, 65, 81), (107, 114, 128))


def thumbnail(title, category_slug=None, size=THUMBNAIL_SIZE):
    """PNG bytes: a diagonal-ish gradient in the colours of the category with ``title`` on it."""
    start, end = PALETTES.get(category_slug, DEFAULT_PALETTE)
    width, height = size

    image = Image.composite(
        Image.new('RGB', size, end),
        Image.new('RGB', size, start),
        Image.linear_gradient('L').resize(size),
    )

    # soft circles for some depth
    overlay = Image.new('RGBA', size, (0, 0, 0, 0))
    paint = ImageDraw.Draw(overlay)
    paint.ellipse((width * 0.62, -height * 0.35, width * 1.25, height * 0.55), fill=(255, 255, 255, 38))
    paint.ellipse((-width * 0.15, height * 0.55, width * 0.3, height * 1.2), fill=(255, 255, 255, 30))
    image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')

    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=54)

    # the title sits low; the top left stays empty for the badges the app lays over it
    lines = _wrap(draw, title, font, max_width=width - 120)[:3]
    line_height = 66
    top = height - 70 - line_height * len(lines)
    for index, line in enumerate(lines):
        draw.text((60, top + index * line_height), line, font=font, fill=(255, 255, 255))

    buffer = io.BytesIO()
    image.save(buffer, format='PNG', optimize=True)
    return buffer.getvalue()


def _wrap(draw, text, font, max_width):
    lines, current = [], ''
    for word in text.split():
        candidate = f'{current} {word}'.strip()
        if current and draw.textlength(candidate, font=font) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def pdf(title, text):
    """A one-page PDF (Helvetica) with ``title`` and the wrapped ``text``; no dependencies."""
    def escape(value):
        return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    lines = [title, '']
    for paragraph in text.splitlines():
        lines.extend(textwrap.wrap(paragraph, 84) or [''])

    content = ['BT', '/F1 12 Tf', '72 740 Td', '16 TL']
    content += [f'({escape(line)}) Tj T*' for line in lines[:42]]
    content.append('ET')
    stream = '\n'.join(content).encode('latin-1', 'replace')

    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        b'/Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]

    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f'{number} 0 obj\n'.encode() + body + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode()
    for offset in offsets:
        out += f'{offset:010d} 00000 n \n'.encode()
    out += (f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n'
            f'startxref\n{xref}\n%%EOF\n').encode()
    return bytes(out)
