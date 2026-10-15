"""Opt-in pagination for the list endpoints that answer a bare JSON array.

The array is the v1 contract, so a page is something the caller asks for with
``?page=2&page_size=20``; without those parameters an endpoint answers exactly as it
always did.  Either way the totals travel in headers, so the body never changes shape::

    X-Total-Count: 134
    Link: </api/v1/learning/courses/?page=3&page_size=20>; rel="next", <...>; rel="prev"

``X-Total-Count`` and ``Link`` are exposed to browsers through ``CORS_EXPOSE_HEADERS``.
"""
from .params import int_param

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def paginate(request, items, *, default_size=None):
    """``(rows, headers)``: the page of ``items`` the request asks for, and the headers describing it.

    ``items`` is an ordered queryset or a list.  With neither ``page`` nor ``page_size`` in
    the query the rows are everything, or the first ``default_size`` of them for an
    endpoint that always had a cap.  A page past the end is an empty list, not an error.
    """
    total = len(items) if isinstance(items, (list, tuple)) else items.count()
    headers = {'X-Total-Count': str(total)}

    asked = 'page' in request.query_params or 'page_size' in request.query_params
    if not asked and default_size is None:
        return list(items), headers

    size = int_param(request, 'page_size', default_size or DEFAULT_PAGE_SIZE,
                     minimum=1, maximum=MAX_PAGE_SIZE)
    number = int_param(request, 'page', 1, minimum=1)
    start = (number - 1) * size
    rows = list(items[start:start + size])

    links = []
    if start + size < total:
        links.append(f'<{_page_url(request, number + 1, size)}>; rel="next"')
    if number > 1:
        links.append(f'<{_page_url(request, number - 1, size)}>; rel="prev"')
    if links:
        headers['Link'] = ', '.join(links)
    return rows, headers


def _page_url(request, number, size):
    query = request.query_params.copy()
    query['page'] = str(number)
    query['page_size'] = str(size)
    return f'{request.path}?{query.urlencode()}'
