"""Ordering rules of sections and lectures."""
from django.db import transaction
from django.db.models import Max


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

    Unknown uuids are skipped.  Orders are unique per parent, so every item is
    first parked on a temporary high value before the final values are set.
    """
    with transaction.atomic():
        to_update = []
        for item in orders:
            try:
                obj = queryset.get(uuid=item.get('uuid'))
            except queryset.model.DoesNotExist:
                continue
            to_update.append((obj, item.get('order')))

        # Step 1: temporary high values (1000+)
        for index, (obj, _new_order) in enumerate(to_update):
            obj.order = 1000 + index
            obj.save()

        # Step 2: the final values
        for obj, new_order in to_update:
            obj.order = new_order
            obj.save()
