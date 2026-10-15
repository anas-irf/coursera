"""The length of an uploaded video is read from the file, not trusted from the client.

The files below are the smallest containers that carry a length: an MP4 with ``moov`` /
``mvhd`` and a WebM with ``Segment`` / ``Info`` / ``Duration``.
"""
import io
import struct

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

import factories as f
from apps.content.media import video_seconds

pytestmark = pytest.mark.django_db


# --------------------------------------------------------------------------- #
# builders
# --------------------------------------------------------------------------- #
def box(kind, payload=b''):
    return struct.pack('>I', 8 + len(payload)) + kind + payload


def mvhd(seconds, timescale=1000, version=0):
    if version == 1:
        body = struct.pack('>BxxxQQIQ', 1, 0, 0, timescale, int(seconds * timescale))
    else:
        body = struct.pack('>BxxxIIII', 0, 0, 0, timescale, int(seconds * timescale))
    return box(b'mvhd', body + b'\x00' * 80)


def mp4(seconds, *, version=0, moov_last=False, timescale=1000):
    ftyp = box(b'ftyp', b'mp42' + b'\x00' * 4 + b'mp42')
    mdat = box(b'mdat', b'\x01' * 4096)
    moov = box(b'moov', mvhd(seconds, timescale, version))
    return ftyp + (mdat + moov if moov_last else moov + mdat)


def vint_size(value, length=1):
    marker = 1 << (7 * length)
    return (marker | value).to_bytes(length, 'big')


def element(identifier, payload, size_length=1):
    return identifier + vint_size(len(payload), size_length) + payload


def webm(seconds, *, timecode_scale=None, double=False, unknown_segment_size=False):
    scale = timecode_scale or 1_000_000
    ticks = seconds * 1_000_000_000 / scale
    duration = struct.pack('>d', ticks) if double else struct.pack('>f', ticks)
    info_children = b''
    if timecode_scale:
        info_children += element(b'\x2a\xd7\xb1', timecode_scale.to_bytes(4, 'big'))
    info_children += element(b'\x44\x89', duration)
    info = element(b'\x15\x49\xa9\x66', info_children)
    cluster = element(b'\x1f\x43\xb6\x75', b'\x00' * 32)
    body = info + cluster
    ebml = element(b'\x1a\x45\xdf\xa3', element(b'\x42\x82', b'webm'))
    segment_id = b'\x18\x53\x80\x67'
    if unknown_segment_size:
        return ebml + segment_id + b'\x01\xff\xff\xff\xff\xff\xff\xff' + body
    return ebml + segment_id + vint_size(len(body), 4) + body


# --------------------------------------------------------------------------- #
# the reader
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('version', [0, 1])
def test_an_mp4_has_the_length_of_its_movie_header(version):
    assert video_seconds(io.BytesIO(mp4(125.4, version=version))) == 125


def test_an_mp4_whose_index_comes_after_the_picture_is_read_too():
    assert video_seconds(io.BytesIO(mp4(3725, moov_last=True))) == 3725


def test_a_timescale_other_than_milliseconds_is_respected():
    assert video_seconds(io.BytesIO(mp4(90, timescale=90000))) == 90


@pytest.mark.parametrize('double', [False, True])
def test_a_webm_has_the_length_of_its_info_element(double):
    assert video_seconds(io.BytesIO(webm(61.5, double=double))) == 62  # 61.5 rounds up


def test_a_webm_with_its_own_timecode_scale_and_an_unknown_segment_size():
    data = webm(30, timecode_scale=500_000, unknown_segment_size=True)

    assert video_seconds(io.BytesIO(data)) == 30


@pytest.mark.parametrize('data', [
    b'',
    b'not a video at all',
    b'\x00\x00\x00\x18ftypmp42',           # the placeholder the other tests upload
    box(b'ftyp', b'mp42') + box(b'free'),  # no movie box
    mp4(0),                                # a zero length is no length
    mp4(40 * 3600),                        # more than a day is a damaged header
    mp4(10)[:40],                          # cut off in the middle of the header
    b'\x1a\x45\xdf\xa3' + b'\xff' * 16,    # an EBML header that never ends
])
def test_anything_else_has_no_known_length(data):
    assert video_seconds(io.BytesIO(data)) is None


def test_the_position_of_the_file_is_put_back():
    stream = io.BytesIO(mp4(10))
    stream.seek(7)

    video_seconds(stream)

    assert stream.tell() == 7


def test_a_file_that_cannot_seek_has_no_known_length():
    class Unseekable(io.RawIOBase):
        def tell(self):
            raise OSError('not seekable')

    assert video_seconds(Unseekable()) is None


# --------------------------------------------------------------------------- #
# through the API
# --------------------------------------------------------------------------- #
LECTURES = '/api/v1/courses/instructor/sections/{}/lectures/'


def test_an_uploaded_video_is_measured_whatever_the_client_says(auth_client, instructor):
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    upload = SimpleUploadedFile('lesson.mp4', mp4(125), content_type='video/mp4')

    r = client.post(LECTURES.format(section.uuid), {
        'title': 'Measured', 'description': 'd', 'content_type': 'video',
        'video_file': upload, 'duration': '9999',
    }, format='multipart')

    assert r.status_code == 201
    assert r.json()['video_content']['duration'] == 125
    assert f.VideoContent.objects.get(lecture__uuid=r.json()['id']).duration == 125


def test_a_file_that_cannot_be_measured_falls_back_to_what_the_client_sent(auth_client, instructor):
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))

    r = client.post(LECTURES.format(section.uuid), {
        'title': 'Claimed', 'description': 'd', 'content_type': 'video',
        'video_file': f.video_file(), 'duration': '200',
    }, format='multipart')

    assert r.status_code == 201
    assert r.json()['video_content']['duration'] == 200


def test_a_new_file_replaces_the_old_length_even_when_it_has_none(auth_client, instructor):
    client = auth_client(instructor)
    section = f.make_section(f.make_course(instructor))
    created = client.post(LECTURES.format(section.uuid), {
        'title': 'Replaced', 'description': 'd', 'content_type': 'video',
        'video_file': SimpleUploadedFile('a.mp4', mp4(125), content_type='video/mp4'),
    }, format='multipart')
    lecture = f.Lecture.objects.get(uuid=created.json()['id'])
    assert f.VideoContent.objects.get(lecture=lecture).duration == 125

    r = client.put(f'/api/v1/courses/instructor/lectures/{lecture.uuid}/', {
        'title': 'Replaced', 'description': 'd', 'content_type': 'video',
        'video_file': f.video_file('b.mp4'),
    }, format='multipart')

    assert r.status_code == 200
    # the old length belonged to the old file: no known length is 0, not 125
    assert f.VideoContent.objects.get(lecture=lecture).duration == 0


# --------------------------------------------------------------------------- #
# the odd corners of the two containers
# --------------------------------------------------------------------------- #
def large_box(kind, payload=b''):
    """A box whose size does not fit the 32 bits of the header: ``size == 1``, 64-bit size after."""
    return struct.pack('>I', 1) + kind + struct.pack('>Q', 16 + len(payload)) + payload


def test_a_box_with_a_64_bit_size_is_read():
    data = box(b'ftyp', b'mp42') + large_box(b'moov', mvhd(77))

    assert video_seconds(io.BytesIO(data)) == 77


def test_a_last_box_that_runs_to_the_end_of_the_file_is_read():
    moov = struct.pack('>I', 0) + b'moov' + mvhd(42)

    assert video_seconds(io.BytesIO(box(b'ftyp', b'mp42') + moov)) == 42


@pytest.mark.parametrize('data', [
    box(b'ftyp', b'mp42') + struct.pack('>I', 4) + b'moov',        # a size smaller than its header
    box(b'ftyp', b'mp42') + struct.pack('>I', 1) + b'moov' + b'\x00' * 3,  # a 64-bit size cut short
    box(b'ftyp', b'mp42') + box(b'moov', b'\x00\x00\x00\x08free'),  # a movie without a header box
    box(b'ftyp', b'mp42') + box(b'moov', box(b'mvhd', b'\x01')),    # a header cut short (version 1)
    box(b'ftyp', b'mp42') + box(b'moov', box(b'mvhd', b'')),        # an empty one
    box(b'ftyp', b'mp42') + box(b'moov', mvhd(10, timescale=0)),    # a timescale of zero
])
def test_a_damaged_mp4_header_has_no_length(data):
    assert video_seconds(io.BytesIO(data)) is None


def test_an_mp4_whose_length_is_marked_unknown_has_none():
    body = struct.pack('>BxxxIIII', 0, 0, 0, 1000, 0xFFFFFFFF) + b'\x00' * 80

    assert video_seconds(io.BytesIO(mp4(1)[:0] + box(b'ftyp', b'mp42') + box(b'moov', box(b'mvhd', body)))) is None


@pytest.mark.parametrize('data', [
    b'\x1a\x45\xdf\xa3',                                              # nothing after the magic
    b'\x1a\x45\xdf\xa3\x80',                                          # an empty header, no segment
    b'\x1a\x45\xdf\xa3\x80' + b'\x18\x53\x80\x67\x80',                # a segment with nothing in it
    b'\x1a\x45\xdf\xa3\x80' + b'\x18\x53\x80\x67\x88' + b'\x00' * 8,  # an id that is not an id
])
def test_a_damaged_webm_has_no_length(data):
    assert video_seconds(io.BytesIO(data)) is None


def test_a_webm_without_a_duration_has_none():
    info = element(b'\x15\x49\xa9\x66', element(b'\x2a\xd7\xb1', (1_000_000).to_bytes(4, 'big')))
    body = element(b'\x18\x53\x80\x67', info)

    assert video_seconds(io.BytesIO(element(b'\x1a\x45\xdf\xa3', b'') + body)) is None


def test_a_file_that_fails_while_it_is_read_has_no_length():
    class Breaks(io.BytesIO):
        def read(self, size=-1):
            if self.tell() > 0:
                raise OSError('disk error')
            return super().read(size)

    assert video_seconds(Breaks(mp4(10))) is None
