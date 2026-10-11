"""Catalogue reference data: the categories of the Explore filter and the languages."""
from apps.core.models import Category, Language

from ..data.catalogue import CATEGORIES, LANGUAGES

TITLE = 'Categories and languages'


def run(ctx):
    created = 0
    for slug, name, description, icon in CATEGORIES:
        category = (Category.objects.filter(slug=slug).first()
                    or Category.objects.filter(name=name).first())
        if category is None:
            category = Category.objects.create(slug=slug, name=name, description=description, icon=icon)
            created += 1
        ctx.categories[slug] = category

    for code, name in LANGUAGES:
        language, was_created = Language.objects.get_or_create(code=code, defaults={'name': name})
        created += was_created
        ctx.languages[code] = language

    ctx.count('catalogue entries', created)
    ctx.say(f'   {len(CATEGORIES)} categories, {len(LANGUAGES)} languages ({created} created)')
