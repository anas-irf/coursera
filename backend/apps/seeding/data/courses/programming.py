"""Courses of the programming category (the two demo courses and one waiting for approval)."""
from ..spec import Assignment, Course, Fill, MC, MS, Quiz, Reading, Section, TF, Video
from ..videos import VIDEOS as YT

DEMO_INSTRUCTOR = 'demo.instructor@example.com'

# What seed_demo's two courses get on top of their quiz and assignment: a second section of
# videos and a reading (no grade weight, so their 40 + 60 stay as they are) and the numbers a
# live catalogue would show.
EXTENSIONS = {
    'introduction-to-python': {
        'rating': 4.7, 'reviews': 64, 'popularity': 2140, 'created': 160, 'published': 150,
        'sections': (
            Section('Going further', description='Functions, files and a first small project', items=(
                Video('Functions and modules', YT['python'], 22),
                Video('Working with files', YT['python'], 18),
                Video('A first small project', YT['python'], 24),
                Reading('Where to go next', (
                    '<h2>Where to go next</h2>'
                    '<p>You can now read and write small programs. Three good next steps:</p>'
                    '<ul><li>Automate something you do by hand every week.</li>'
                    '<li>Read other people\'s code: pick a small open source project.</li>'
                    '<li>Learn one library deeply instead of five superficially.</li></ul>')),
            )),
        ),
    },
    'applied-machine-learning': {
        'rating': 4.5, 'reviews': 38, 'popularity': 0, 'created': 150, 'published': 140,
        'sections': (
            Section('Models in practice', description='Validation, overfitting and metrics', items=(
                Video('Train, validate, test', YT['machine-learning'], 21),
                Video('Overfitting and regularisation', YT['machine-learning'], 19),
                Video('Evaluating a classifier', YT['machine-learning'], 23),
                Reading('Choosing a metric', (
                    '<h2>Choosing a metric</h2>'
                    '<p>Accuracy hides imbalance. When one class is rare, look at precision, recall '
                    'and the cost of each kind of mistake before you look at a single number.</p>')),
            )),
        ),
    },
}

CLOUD = Course(
    slug='cloud-computing-fundamentals',
    title='Cloud Computing Fundamentals',
    instructor=DEMO_INSTRUCTOR,
    category='programming',
    level='beginner',
    kind='coursera_plus',
    state='pending_review',
    created=40, published=6,
    subtitle='What the cloud is, how its pieces fit together and what it costs to run something there',
    description=(
        'A practical introduction to cloud platforms for people who build or run software. You will learn '
        'the service models, the building blocks every provider offers and how to reason about cost, '
        'scaling and reliability before you open a console.'),
    outcomes=('Explain IaaS, PaaS and SaaS with examples', 'Choose compute, storage and network services',
              'Estimate the monthly cost of a small application', 'Spot the usual reliability and security traps'),
    requirements=('Basic familiarity with web applications',),
    audience='Developers, analysts and managers who work with cloud-hosted systems.',
    summary='Pending review, grade weights add up to 100: approve or reject it',
    sections=(
        Section('What the cloud is', items=(
            Video('From servers to services', YT['cloud'], 12, preview=True),
            Reading('IaaS, PaaS and SaaS on one page', (
                '<h2>Three ways to rent computing</h2>'
                '<p><strong>IaaS</strong> hands you virtual machines and networks; you manage everything above '
                'them. <strong>PaaS</strong> runs your code and hides the machines. <strong>SaaS</strong> is '
                'finished software you only configure.</p>'
                '<ul><li>More control means more to operate.</li><li>Less control means faster delivery.</li></ul>')),
            Quiz('Check: cloud service models', 20, (
                MC('Which model gives you virtual machines and leaves the operating system to you?',
                   'IaaS', 'SaaS', 'PaaS', why='Infrastructure as a service stops at the hypervisor.'),
                TF('With SaaS the customer patches the underlying servers.', False),
                MS('Pick the benefits of renting capacity instead of owning it.',
                   ['Pay for what you use', 'Capacity in minutes'], ['No security duties', 'Fixed monthly cost']),
                Fill('Software delivered finished and configured by the customer is called ___ for short.',
                     'SaaS', 'saas'),
            ), minutes=10),
        )),
        Section('Building blocks', items=(
            Video('Compute, storage and networking', YT['cloud'], 18),
            Video('Identity and access', YT['cloud'], 16),
            Reading('A shared-responsibility checklist', (
                '<h2>Who is responsible for what?</h2>'
                '<p>The provider secures the facility and the platform. You secure your data, your accounts '
                'and your configuration. Most incidents are configuration, not breaches of the platform.</p>')),
            Assignment('Sketch an architecture', 30,
                       'Draw the components of a small web shop (web tier, database, file storage, queue) and '
                       'name the service you would use for each. Two paragraphs on what would fail first.',
                       due=12),
        )),
        Section('Running it for real', items=(
            Video('Cost, scaling and reliability', YT['cloud'], 20),
            Quiz('Check: scaling and cost', 20, (
                MC('Which change usually lowers the cost of a rarely used batch job the most?',
                   'Run it on demand instead of all day', 'Buy a larger instance', 'Move it to another region'),
                MC('What does horizontal scaling add?', 'More instances', 'A bigger instance', 'More disk'),
                TF('Reserved capacity is cheaper than on-demand for steady workloads.', True),
            ), attempts=2),
            Assignment('Cost estimate for a small web app', 30,
                       'Estimate the monthly bill of a web app with 5,000 daily visitors. List every line item, '
                       'the assumption behind it and one change that would halve the total.',
                       due=21, late_ok=False),
        )),
    ),
)

COURSES = (CLOUD,)
