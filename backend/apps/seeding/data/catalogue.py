"""Reference data of the catalogue.

The category slugs are the ones the Explore filter of the frontend offers; a
category with another slug would never be reachable from the filter.
"""

# (slug, name, description, icon)
CATEGORIES = (
    ('programming', 'Programming', 'Languages, tooling and the craft of writing software', 'code'),
    ('web-development', 'Web Development', 'Front end, back end and everything the browser shows', 'globe'),
    ('data-science', 'Data Science', 'Statistics, visualisation and machine learning', 'bar-chart'),
    ('design', 'Design', 'Interfaces, research and design systems', 'pen-tool'),
    ('marketing', 'Marketing', 'Reaching people and measuring what works', 'megaphone'),
    ('business', 'Business', 'Management, operations and everyday work skills', 'briefcase'),
)

# (code, name)
LANGUAGES = (
    ('en', 'English'),
    ('es', 'Spanish'),
)
