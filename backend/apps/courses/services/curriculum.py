"""Ordering rules of sections and lectures."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max

from apps.core.api.errors import ServiceError


def next_order(queryset):
    """Order value for a new item appended to ``queryset`` (max + 1)."""
    return (queryset.aggregate(top=Max('order'))['top'] or 0) + 1


def resequence(queryset):
    """Renumber the items of ``queryset`` 1..n, keeping their relative order."""
    for position, obj in enumerate(queryset.order_by('order'), 1):
        if obj.order != position:
            obj.order = position
            obj.save()


def reorder(queryset, orders):
    """Apply ``[{'uuid': ..., 'order': ...}, ...]`` to the items of ``queryset``.

    Unknown (or malformed) uuids are skipped; a payload that is not a list of
    objects with an integer ``order`` is a 400.  Orders are unique per parent, so
    every item is first parked on a temporary high value before the final values
    are set.
    """
    if not isinstance(orders, list) or not all(isinstance(item, dict) for item in orders):
        raise ServiceError('The orders must be a list of {uuid, order} objects')
    for item in orders:
        if isinstance(item.get('order'), bool) or not isinstance(item.get('order'), int):
            raise ServiceError('Every order must be a whole number')

    with transaction.atomic():
        to_update = []
        for item in orders:
            try:
                obj = queryset.get(uuid=item.get('uuid'))
            except (queryset.model.DoesNotExist, ValidationError, ValueError):
                continue
            to_update.append((obj, item['order']))

        # Step 1: temporary high values (1000+)
        for index, (obj, _new_order) in enumerate(to_update):
            obj.order = 1000 + index
            obj.save()

        # Step 2: the final values
        for obj, new_order in to_update:
            obj.order = new_order
            obj.save()
