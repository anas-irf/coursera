"""Web development courses of James Okafor."""
from ..spec import Assignment, Course, Fill, MC, MS, Quiz, Reading, Section, TF, Video
from ..videos import VIDEOS as YT

JAMES = 'james.okafor@example.com'

JAVASCRIPT = Course(
    slug='javascript-from-scratch',
    title='JavaScript from Scratch',
    instructor=JAMES,
    category='web-development',
    level='beginner',
    kind='free',
    featured=True,
    rating=4.6, reviews=520, popularity=5310, created=135, published=125,
    subtitle='Variables to async code, one small program at a time',
    description=(
        'No framework, no build step: just the language. You will write programs that run in the browser '
        'console and on a page, learn what actually happens when code runs and finish with a small '
        'interactive project of your own.'),
    outcomes=('Write functions, loops and conditionals confidently', 'Work with arrays and objects',
              'Change a page from JavaScript', 'Understand callbacks, promises and async/await'),
    requirements=('A computer and a browser', 'No programming experience needed'),
    audience='Complete beginners and designers who want to make pages interactive.',
    summary='Featured free course with the largest catalogue numbers; learners at every stage',
    sections=(
        Section('The language', items=(
            Video('Values, variables and types', YT['javascript'], 14, preview=True),
            Reading('Reading error messages', (
                '<h2>Errors are information</h2>'
                '<p>Read the message from the top: the first line says <em>what</em> went wrong, the next '
                'ones say <em>where</em>. Most beginner errors are a typo in a name.</p>'
                '<ul><li>ReferenceError: the name does not exist here.</li>'
                '<li>TypeError: the value cannot do that.</li></ul>')),
            Quiz('Check: values and types', 20, (
                MC('What does typeof null return?', '"object"', '"null"', '"undefined"'),
                TF('const makes the value itself immutable.', False,
                   why='It only prevents re-assigning the variable.'),
                MS('Pick the falsy values.', ['0', '""'], ['"0"', '[]']),
                Fill('The strict equality operator is written ___ .', '===', '=== '),
            ), minutes=8),
        )),
        Section('Functions and data', items=(
            Video('Functions and scope', YT['javascript'], 19),
            Video('Arrays and objects', YT['javascript'], 21),
            Reading('Choosing a loop', (
                '<h2>for, for...of or map?</h2>'
                '<p>Use <code>for...of</code> to do something with each item, <code>map</code> to build a '
                'new array from an old one, and a plain <code>for</code> when you need the index.</p>')),
            Assignment('Build a to-do list in the console', 30,
                       'Write a small program that stores tasks in an array, adds and completes them and prints '
                       'the list. Submit the .js file or a PDF of the code.', due=-14),
        )),
        Section('The page', items=(
            Video('The DOM and events', YT['javascript'], 18),
            Quiz('Check: the DOM', 20, (
                MC('Which method finds the first element matching a CSS selector?', 'querySelector',
                   'getElement', 'findCss'),
                TF('Event listeners run before the page has loaded when added in the head.', False),
                MC('What does addEventListener take as its first argument?', 'An event name',
                   'A function', 'A CSS rule'),
            ), attempts=3),
            Assignment('Interactive counter', 30,
                       'Build a page with a counter and buttons to increase, decrease and reset it. Explain in '
                       'three sentences how the page stays in sync with the number.', due=21),
        )),
    ),
)

REACT = Course(
    slug='react-for-beginners',
    title='React for Beginners',
    instructor=JAMES,
    category='web-development',
    level='intermediate',
    kind='coursera_plus',
    rating=4.4, reviews=58, created=95, published=85,
    subtitle='Components, state and effects, built up from a single page',
    description=(
        'Learn the mental model behind React and build a small application in small, testable pieces. '
        'You will meet components, props, state, effects and data fetching in the order you need them.'),
    outcomes=('Split a page into components', 'Model state and derive the rest', 'Fetch and render remote data',
              'Know when an effect is the wrong tool'),
    requirements=('JavaScript from Scratch or equivalent', 'HTML and CSS basics'),
    audience='Developers who know JavaScript and want to build real interfaces.',
    summary='Plus course with learners at several stages and a graded assignment',
    sections=(
        Section('Thinking in components', items=(
            Video('Why components?', YT['react'], 12, preview=True),
            Reading('Props down, events up', (
                '<h2>One-way data flow</h2>'
                '<p>Data travels down through props; events travel up through callbacks. Keeping that '
                'direction strict is what makes a large interface predictable.</p>')),
            Quiz('Check: components and props', 20, (
                MC('Props are...', 'Read-only inputs to a component', 'Local mutable state',
                   'Global variables'),
                TF('A component must return a single root element or a fragment.', True),
                MS('Pick valid sources of a list item key.', ['A database id', 'A stable slug'],
                   ['The random number generator', 'Nothing: keys are optional']),
                Fill('The hook that adds local state to a function component is called use___ .', 'State',
                     'state'),
            )),
        )),
        Section('State and effects', items=(
            Video('State, derived values and forms', YT['react'], 20),
            Video('Effects and data fetching', YT['react'], 22),
            Reading('You might not need an effect', (
                '<h2>Effects are for synchronising</h2>'
                '<p>If you can compute a value during render, do that. Reach for an effect only to '
                'synchronise with something outside React: the network, the DOM, a timer.</p>')),
            Assignment('A searchable course list', 30,
                       'Build a component that loads a JSON list of courses and filters it as the user types. '
                       'Submit the code and a short note about where the state lives and why.', due=-6),
        )),
        Section('Shipping it', items=(
            Video('Structure, testing and deployment', YT['react'], 16),
            Quiz('Check: state and effects', 20, (
                MC('When does an effect with an empty dependency array run?', 'After the first render',
                   'On every render', 'Never'),
                TF('Calling setState with the same value always re-renders the tree.', False),
                MC('Where should derived data be computed?', 'During render', 'In an effect', 'In a global'),
            ), attempts=2),
            Assignment('Refactor into components', 30,
                       'Take the supplied 300-line component and split it into at least four components with '
                       'clear props. Explain the boundaries you chose.', due=18),
        )),
    ),
)

DJANGO = Course(
    slug='full-stack-django-with-postgresql',
    title='Full-Stack Django with PostgreSQL',
    instructor=JAMES,
    category='web-development',
    level='advanced',
    kind='coursera_plus',
    state='pending_review',
    created=35, published=3,
    edited_after_submission=10,
    subtitle='Models, migrations, an API and a React front end on a real database',
    description=(
        'Build a complete application with Django, PostgreSQL and a small React client. The course follows '
        'one product from schema design through migrations, an API, authentication and deployment.'),
    outcomes=('Design a relational schema and migrate it safely', 'Build a REST API with authentication',
              'Write tests that hit a real database', 'Deploy with environment-based configuration'),
    requirements=('Python and JavaScript fundamentals', 'Basic SQL'),
    audience='Developers ready to build and operate a complete web application.',
    summary='Pending review whose grade weights add up to 90: the Approvals screen shows "Missing 10%"',
    sections=(
        Section('Modelling the domain', items=(
            Video('From requirements to a schema', YT['django'], 17, preview=True),
            Reading('Migrations are code', (
                '<h2>Treat migrations as source code</h2>'
                '<p>A migration is reviewed, tested and never edited after it ships. Rename things in two '
                'steps and keep every change reversible.</p>')),
            Quiz('Check: models and migrations', 20, (
                MC('What does makemigrations do?', 'Writes migration files from model changes',
                   'Changes the database', 'Runs the tests'),
                TF('A migration may be edited after it has been applied in production.', False),
                MS('Pick constraints enforced by the database.', ['Unique', 'Foreign key'],
                   ['A Python property', 'A form validator']),
                Fill('The command that applies migrations is manage.py ___ .', 'migrate'),
            )),
        )),
        Section('An API and its tests', items=(
            Video('Serializers and viewsets', YT['django'], 21),
            Video('Authentication and permissions', YT['django'], 19),
            Reading('Testing against PostgreSQL', (
                '<h2>Test on the database you run</h2>'
                '<p>SQLite forgives what PostgreSQL does not: string lengths, ordering of nulls, '
                'transactions. Run the suite on the engine you deploy to.</p>')),
            Assignment('Build the course catalogue API', 30,
                       'Expose courses and sections with filtering and pagination, protect writes with '
                       'permissions and submit the test results.', due=30),
        )),
        Section('Going live', items=(
            Video('Configuration and deployment', YT['django'], 18),
            Quiz('Check: deployment', 20, (
                MC('Where should secrets live?', 'In the environment', 'In the repository', 'In a template'),
                TF('DEBUG should be on in production.', False),
                MC('What serves static files efficiently in production?', 'A web server or CDN',
                   'The Django development server', 'The database'),
            ), attempts=2),
            Assignment('Deployment write-up', 30,
                       'Describe your deployment: environment variables, migrations on release and how you '
                       'would roll back.', due=40),
        )),
    ),
)

HTML_CSS = Course(
    slug='html-and-css-crash-course',
    title='HTML and CSS Crash Course',
    instructor=JAMES,
    category='web-development',
    level='beginner',
    kind='free',
    state='taken_offline',
    rating=4.0, reviews=12, created=110, published=100,
    subtitle='A page, then a layout, then a responsive layout',
    description=(
        'The two languages every web page is written in. Build a real page from an empty file, then make '
        'it work on a phone.'),
    outcomes=('Write semantic HTML', 'Lay out a page with flexbox', 'Make a page responsive'),
    requirements=('A text editor and a browser',),
    audience='Anyone who has never written a web page.',
    summary='Was published and had learners, then taken offline: a draft with enrolled students',
    sections=(
        Section('The page', items=(
            Video('Your first page', YT['html'], 15, preview=True),
            Reading('Semantic elements', (
                '<h2>Say what it is</h2><p>Use <code>header</code>, <code>nav</code>, <code>main</code> and '
                '<code>footer</code> instead of a pile of <code>div</code>s: screen readers and search '
                'engines both depend on it.</p>')),
            Quiz('Check: HTML basics', 40, (
                MC('Which element holds the main heading of a page?', 'h1', 'head', 'title'),
                TF('The alt attribute describes an image for people who cannot see it.', True),
            )),
        )),
        Section('The look', items=(
            Video('Selectors and the box model', YT['css'], 22),
            Video('Flexbox and responsive layout', YT['css'], 24),
            Assignment('Style a landing page', 30,
                       'Style the supplied landing page so that it reads well on a phone and a laptop.',
                       due=-20),
            Assignment('Add a responsive navigation', 30,
                       'Add a navigation bar that collapses into a menu below 600px.', due=-10),
        )),
    ),
)

COURSES = (JAVASCRIPT, REACT, DJANGO, HTML_CSS)
