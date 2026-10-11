"""Small helpers shared by several slices."""
import re

# fragments removed from free-text search input
_SQL_FRAGMENTS = ['union', 'select', 'insert', 'update', 'delete', 'drop', '--', '/*', '*/', 'xp_']


def sanitize_search_query(query):
    """
    Sanitize a free-text search query: limit its length and strip a few
    characters / SQL-looking fragments.  (The ORM parameterizes every query, so
    this is only input hygiene.)
    """
    if not query:
        return ""

    # Remove dangerous characters and limit length
    query = re.sub(r'[<>"\';\\&]', '', str(query)[:100])

    # Remove SQL injection looking fragments (matched literally, case-insensitive)
    for fragment in _SQL_FRAGMENTS:
        query = re.sub(re.escape(fragment), '', query, flags=re.IGNORECASE)

    return query.strip()
