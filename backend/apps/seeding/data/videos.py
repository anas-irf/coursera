"""Public YouTube videos used as lecture content.

Videos are referenced by topic so that a retired video is replaced in one
place.  The ids were checked through YouTube's oEmbed endpoint on 2026-10-12;
when one disappears the player shows YouTube's own error, nothing else depends
on them.
"""

VIDEOS = {
    'python': 'rfscVS0vtbw',               # freeCodeCamp: Learn Python - Full Course for Beginners
    'javascript': 'PkZNo7MFNFg',           # freeCodeCamp: Learn JavaScript - Full Course for Beginners
    'html': 'qz0aGYrrlhU',                 # Programming with Mosh: HTML Crash Course
    'css': 'yfoY53QXEnI',                  # Traversy Media: CSS Crash Course
    'react': 'bMknfKXIFA8',                # freeCodeCamp: React Course for Beginners
    'django': 'F5mRW0jo-U4',               # freeCodeCamp: Python Django Web Framework
    'machine-learning': 'i_LwzRVP7bg',     # freeCodeCamp: Machine Learning for Everybody
    'statistics': 'xxpc-HPKN28',           # freeCodeCamp: Statistics - A Full University Course
    'data-viz': '3Xc3CA655Y4',             # freeCodeCamp: Matplotlib Crash Course
    'figma': 'c9Wg6Cb_YlU',                # freeCodeCamp: UI / UX Design Tutorial in Figma
    'project-management': 'GC7pN8Mjot8',   # Ricardo Vargas: PMBOK processes explained
    'marketing': 'bixR-KIJKYM',            # Simplilearn: What is digital marketing?
    'excel': 'Vl0H-qTclOg',                # freeCodeCamp: Microsoft Excel Tutorial for Beginners
    'cloud': 'EN4fEbcFZ_E',                # Simplilearn: Cloud Computing Full Course
}
