"""Reading request input defensively: a bad value is a 400 with a message, never a 500."""
from .errors import ServiceError


def int_param(request, name, default=None, *, minimum=None, maximum=None):
    """An integer query parameter; ``default`` when it is absent or empty."""
    raw = request.query_params.get(name)
    if raw is None or raw == '':
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise ServiceError(f'{name} must be a whole number') from None
    if minimum is not None and value < minimum:
        raise ServiceError(f'{name} must be at least {minimum}')
    if maximum is not None and value > maximum:
        raise ServiceError(f'{name} must be at most {maximum}')
    return value


def object_body(request):
    """The request body as a mapping; a JSON array or a scalar is a 400, not an AttributeError."""
    data = request.data
    if not hasattr(data, 'get'):
        raise ServiceError('The request body must be a JSON object')
    return data
