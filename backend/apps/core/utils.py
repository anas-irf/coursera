"""Small helpers shared by several slices."""
import nh3

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


def sanitize_html(value):
    """HTML that is safe to show to other people: formatting stays, anything that runs is removed.

    Reading lectures hold HTML written by an instructor and rendered in every learner's
    browser, so it is cleaned when it is stored (and again when it is shown).  The allow-list is
    the library's default: text structure, links (http, https, mailto), images and tables;
    scripts, styles, forms, frames, event handlers and ``javascript:`` URLs are dropped.  Cleaning
    clean HTML changes nothing, so running it again is harmless.
    """
    if not value:
        return ''
    return nh3.clean(str(value))
