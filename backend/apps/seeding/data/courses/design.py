"""Design courses of Lena Fischer (all free: this instructor earns nothing)."""
from ..spec import Assignment, Course, Fill, MC, MS, Quiz, Reading, Section, TF, Video
from ..videos import VIDEOS as YT

LENA = 'lena.fischer@example.com'

UX = Course(
    slug='ux-design-fundamentals',
    title='UX Design Fundamentals: Research, Wireframing, Prototyping and Usability Testing for Product Teams',
    instructor=LENA,
    category='design',
    level='beginner',
    kind='free',
    rating=3.9, reviews=27, created=105, published=92,
    subtitle='The whole design loop on one small project',
    description=(
        'Run a complete, small design project: talk to users, turn what you hear into a problem statement, '
        'sketch and prototype solutions and test them with real people.'),
    outcomes=('Plan and run a user interview', 'Turn findings into a problem statement',
              'Sketch, wireframe and prototype', 'Test a prototype with five people'),
    requirements=('Curiosity about how people use things',),
    audience='Aspiring designers, developers and product managers.',
    summary='Free course with a very long title and a middling rating',
    sections=(
        Section('Understanding people', items=(
            Video('What is UX?', YT['figma'], 12, preview=True),
            Reading('Interview questions that work', (
                '<h2>Ask about the past, not the future</h2>'
                '<p>"Would you use this?" invites politeness. "Tell me about the last time you booked a '
                'trip" invites facts. Listen for the workaround: it is where the product should be.</p>')),
            Quiz('Check: research basics', 20, (
                MC('Which question gets the most reliable answer?', 'Tell me about the last time you did this',
                   'Would you use a feature like this?', 'Do you like blue?'),
                TF('Five users find most of the usability problems of an interface.', True),
                MS('Pick qualitative research methods.', ['Interviews', 'Field observation'],
                   ['A/B tests', 'Funnel analytics']),
                Fill('A representative made-up user built from research is called a ___ .', 'persona'),
            )),
        )),
        Section('Making and testing', items=(
            Video('Sketching and wireframes', YT['figma'], 18),
            Video('Prototyping and testing', YT['figma'], 21),
            Reading('A usability test script', (
                '<h2>Five tasks, one hour</h2>'
                '<p>Greet, explain that you are testing the design not the person, give a task without '
                'hints, ask them to think aloud and thank them. Write down what they did, not what you hoped '
                'they would do.</p>')),
            Assignment('Interview and synthesis', 30,
                       'Interview two people about how they plan a trip and submit your notes with five '
                       'insights and a problem statement.', due=-12),
        )),
        Section('Delivering', items=(
            Video('Presenting design decisions', YT['figma'], 14),
            Quiz('Check: prototypes and tests', 20, (
                MC('What does a low-fidelity prototype help you do?', 'Test an idea cheaply',
                   'Impress investors', 'Replace the final design'),
                TF('Usability tests should coach the participant when they get stuck.', False),
                MC('Which is a good usability metric?', 'Task success rate', 'Page weight', 'Server load'),
            ), attempts=3),
            Assignment('Prototype and test', 30,
                       'Build a clickable prototype of your solution, test it with three people and report '
                       'what you changed afterwards.', due=16),
        )),
    ),
)

FIGMA = Course(
    slug='figma-for-product-teams',
    title='Figma for Product Teams',
    instructor=LENA,
    category='design',
    level='intermediate',
    kind='coursera_plus',
    state='draft',
    created=18,
    subtitle='Components, variants and handoff that engineers can use',
    description='Work in Figma the way a product team does: shared components, tokens and clean handoff.',
    outcomes=('Build reusable components', 'Use variants and auto layout', 'Hand off to engineering'),
    requirements=('Basic design experience',),
    audience='Designers who work next to engineers.',
    summary='Draft whose weights add up to 60: "Request Publish" explains what is missing',
    sections=(
        Section('Foundations', items=(
            Video('Frames, auto layout and constraints', YT['figma'], 16, preview=True),
            Reading('Naming things', (
                '<h2>Names are an interface</h2><p>Name layers and components for the person who will '
                'inherit the file, not for yourself.</p>')),
            Quiz('Check: auto layout', 20, (
                MC('What does auto layout manage?', 'Spacing and resizing of children', 'Colour palettes',
                   'Version history'),
                TF('Components can have variants.', True),
            )),
            Assignment('Build a button component', 40,
                       'Create a button with size and state variants and document when to use each.',
                       due=14),
        )),
    ),
)

DESIGN_SYSTEMS = Course(
    slug='design-systems-from-zero',
    title='Design Systems from Zero',
    instructor=LENA,
    category=None,
    level='all_levels',
    kind='free',
    rating=0.0, reviews=0, created=14, published=8,
    subtitle='Tokens, components and the rules that keep them consistent',
    description=(
        'Start a design system without a dedicated team: audit what you have, define tokens, build the '
        'first ten components and agree how they change.'),
    outcomes=('Audit an interface for inconsistencies', 'Define colour, type and spacing tokens',
              'Write usage guidance people actually read'),
    requirements=('Some interface design experience',),
    audience='Designers and front-end developers who maintain more than one product.',
    summary='Brand-new published course: no category ("General"), "all levels", zero rating and learners',
    sections=(
        Section('Audit and tokens', items=(
            Video('Audit what you have', YT['figma'], 14, preview=True),
            Video('Tokens: colour, type, space', YT['figma'], 28),
            Reading('Naming tokens', (
                '<h2>Name by purpose</h2><p><code>color-text-muted</code> survives a rebrand; '
                '<code>grey-600</code> does not.</p>')),
            Quiz('Check: tokens', 40, (
                MC('Which name is better for a token?', 'color-text-muted', 'grey-600', 'nice-grey'),
                TF('A design system is finished when the component library is published.', False),
                Fill('A named design decision such as a colour or spacing value is a design ___ .', 'token'),
            )),
        )),
        Section('Components and governance', items=(
            Video('Your first ten components', YT['figma'], 20),
            Assignment('Inventory and audit report', 30,
                       'Audit three screens of a product you know and list every inconsistency with a '
                       'screenshot and a proposed token.', due=20),
            Assignment('Contribution guide', 30,
                       'Write a one-page guide that explains how someone proposes a change to a component.',
                       due=35),
        )),
    ),
)

COURSES = (UX, FIGMA, DESIGN_SYSTEMS)
