"""Small helpers shared by several slices."""

MAX_SEARCH_LENGTH = 100


def sanitize_search_query(query):
    """Trim a free-text search query and cap its length.

    Nothing else is removed.  The ORM parameterises every query, and deleting
    characters or words (``select``, ``drop``, ``&``) only mangles real searches
    such as "Updated Python" or "R&D".
    """
    if not query:
        return ''
    return str(query).strip()[:MAX_SEARCH_LENGTH].strip()
