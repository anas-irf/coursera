"""The length of an uploaded video, read from the file itself.

Only the header of the container is read, never the picture: an MP4 / MOV file keeps its
length in the ``mvhd`` box of ``moov``, a WebM / Matroska file in the ``Info`` element of the
segment.  Reading it here (and not trusting a number sent by the browser) means every
uploaded lecture has the real length, whichever client uploaded it.  A file in another
container, or a damaged one, simply has no known length (``None``).
"""
import contextlib
import struct

MAX_SECONDS = 24 * 3600

# --- MP4 / MOV (ISO base media file format) ------------------------------------ #
_BOX_HEADER = 8
_LARGE_SIZE_HEADER = 16


def _mp4_boxes(fileobj, start, end):
    """Yield ``(type, payload_start, payload_end)`` of the boxes found between two offsets."""
    position = start
    while position + _BOX_HEADER <= end:
        fileobj.seek(position)
        header = fileobj.read(_BOX_HEADER)
        if len(header) < _BOX_HEADER:
            return
        size = int.from_bytes(header[:4], 'big')
        kind = header[4:8]
        header_length = _BOX_HEADER

        if size == 1:  # a 64-bit size follows the type
            large = fileobj.read(8)
            if len(large) < 8:
                return
            size = int.from_bytes(large, 'big')
            header_length = _LARGE_SIZE_HEADER
        elif size == 0:  # the box runs to the end of the file
            size = end - position

        if size < header_length:
            return
        yield kind, position + header_length, min(position + size, end)
        position += size


def _mp4_seconds(fileobj, end):
    for kind, start, stop in _mp4_boxes(fileobj, 0, end):
        if kind != b'moov':
            continue
        for child, child_start, _ in _mp4_boxes(fileobj, start, stop):
            if child == b'mvhd':
                return _mvhd_seconds(fileobj, child_start)
        return None
    return None


def _mvhd_seconds(fileobj, start):
    fileobj.seek(start)
    version = fileobj.read(1)
    if not version:
        return None
    if version[0] == 1:  # 64-bit times: created, modified, timescale, duration
        fileobj.seek(start + 4 + 8 + 8)
        data = fileobj.read(12)
        if len(data) < 12:
            return None
        timescale, duration = struct.unpack('>IQ', data)
        unknown = 0xFFFFFFFFFFFFFFFF
    else:  # 32-bit times
        fileobj.seek(start + 4 + 4 + 4)
        data = fileobj.read(8)
        if len(data) < 8:
            return None
        timescale, duration = struct.unpack('>II', data)
        unknown = 0xFFFFFFFF
    if not timescale or duration == unknown:
        return None
    return duration / timescale


# --- WebM / Matroska (EBML) ----------------------------------------------------- #
_EBML_HEADER = 0x1A45DFA3
_SEGMENT = 0x18538067
_INFO = 0x1549A966
_TIMECODE_SCALE = 0x2AD7B1
_DURATION = 0x4489
_DEFAULT_TIMECODE_SCALE = 1_000_000  # nanoseconds per tick


def _vint(fileobj, keep_marker):
    """One variable-length integer: ``(value, length_in_bytes, is_unknown)`` or ``None``."""
    first = fileobj.read(1)
    if not first:
        return None
    lead = first[0]
    length = 1
    mask = 0x80
    while length <= 8 and not lead & mask:
        mask >>= 1
        length += 1
    if length > 8:
        return None

    value = lead if keep_marker else lead & (mask - 1)
    rest = fileobj.read(length - 1)
    if len(rest) < length - 1:
        return None
    for byte in rest:
        value = (value << 8) | byte
    all_ones = (1 << (7 * length)) - 1
    return value, length, (not keep_marker) and value == all_ones


def _ebml_elements(fileobj, start, end):
    """Yield ``(id, payload_start, payload_end or None when its size is unknown)``."""
    position = start
    while position < end:
        fileobj.seek(position)
        element = _vint(fileobj, keep_marker=True)
        size = _vint(fileobj, keep_marker=False)
        if element is None or size is None:
            return
        identifier, id_length, _ = element
        value, size_length, unknown = size
        payload = position + id_length + size_length
        yield identifier, payload, (None if unknown else payload + value)
        if unknown:
            return
        position = payload + value


def _webm_seconds(fileobj, end):
    for identifier, start, stop in _ebml_elements(fileobj, 0, end):
        if identifier != _SEGMENT:
            continue
        segment_end = stop if stop is not None else end
        for child, child_start, child_stop in _ebml_elements(fileobj, start, segment_end):
            if child == _INFO and child_stop is not None:
                return _info_seconds(fileobj, child_start, child_stop)
        return None
    return None


def _info_seconds(fileobj, start, end):
    timescale = _DEFAULT_TIMECODE_SCALE
    ticks = None
    for identifier, payload, stop in _ebml_elements(fileobj, start, end):
        if stop is None:
            return None
        fileobj.seek(payload)
        data = fileobj.read(stop - payload)
        if identifier == _TIMECODE_SCALE and data:
            timescale = int.from_bytes(data, 'big')
        elif identifier == _DURATION and len(data) in (4, 8):
            ticks = struct.unpack('>f' if len(data) == 4 else '>d', data)[0]
    if not ticks or ticks != ticks or not timescale:  # missing, zero or NaN
        return None
    return ticks * timescale / 1_000_000_000


# --- public ---------------------------------------------------------------------- #
def video_seconds(fileobj):
    """The length in whole seconds of the MP4, MOV or WebM file ``fileobj``, else ``None``.

    ``fileobj`` must be seekable (an uploaded file is); its position is put back where it was.
    """
    try:
        where = fileobj.tell()
    except (AttributeError, OSError, ValueError):
        return None

    try:
        fileobj.seek(0, 2)
        end = fileobj.tell()
        fileobj.seek(0)
        head = fileobj.read(12)

        if head[4:8] in (b'ftyp', b'moov', b'free', b'mdat', b'wide', b'skip'):
            seconds = _mp4_seconds(fileobj, end)
        elif head[:4] == _EBML_HEADER.to_bytes(4, 'big'):
            seconds = _webm_seconds(fileobj, end)
        else:
            seconds = None
    except (OSError, ValueError, struct.error, OverflowError):
        seconds = None
    finally:
        with contextlib.suppress(OSError, ValueError):
            fileobj.seek(where)

    if seconds is None or not 0 < seconds <= MAX_SECONDS:
        return None
    return round(seconds)
