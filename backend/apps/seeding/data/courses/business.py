"""Business and marketing courses of Ravi Shah."""
from ..spec import Assignment, Course, Fill, MC, MS, Quiz, Reading, Section, TF, Video
from ..videos import VIDEOS as YT

RAVI = 'ravi.shah@example.com'

PROJECT_MANAGEMENT = Course(
    slug='project-management-essentials',
    title='Project Management Essentials',
    instructor=RAVI,
    category='business',
    level='beginner',
    kind='coursera_plus',
    rating=4.5, reviews=77, created=92, published=80,
    subtitle='Scope, schedule and people, without the jargon',
    description=(
        'Everything you need to run a small project from kick-off to hand-over: define scope, plan work, '
        'track risk and keep stakeholders informed. Built from real engagements, with templates you can use '
        'on Monday.'),
    outcomes=('Write a one-page project charter', 'Break work into estimable tasks',
              'Track risks and decisions', 'Run a useful status meeting'),
    requirements=('None',),
    audience='New project managers and team leads who were handed a project.',
    summary='Plus course with the best earnings of the Plus courses; rating 4.5',
    sections=(
        Section('Starting well', items=(
            Video('What a project is (and is not)', YT['project-management'], 13, preview=True),
            Reading('The one-page charter', (
                '<h2>Charter template</h2>'
                '<ul><li>Goal: one sentence.</li><li>In scope / out of scope.</li><li>Success measures.</li>'
                '<li>Key dates, budget and the people involved.</li></ul>')),
            Quiz('Check: scope and goals', 20, (
                MC('Which belongs in a project charter?', 'Success measures', 'Daily task list',
                   'Meeting minutes'),
                TF('Scope can grow as long as nobody objects.', False),
                MS('Pick the typical project constraints.', ['Time', 'Budget'], ['Mood', 'Office size']),
                Fill('A change to the agreed scope is usually called scope ___ when uncontrolled.', 'creep'),
            ), minutes=12),
        )),
        Section('Planning and tracking', items=(
            Video('Work breakdown and estimation', YT['project-management'], 19),
            Video('Risks, issues and decisions', YT['project-management'], 17),
            Reading('A risk register in ten minutes', (
                '<h2>Risk register</h2><p>For each risk write the cause, the effect, the likelihood, the '
                'impact and the first thing you would do. Review it weekly, not quarterly.</p>')),
            Assignment('Plan a small project', 30,
                       'Choose a project of 4 to 8 weeks, write its charter and a work breakdown with '
                       'estimates and one risk register.', due=-7),
        )),
        Section('Delivering', items=(
            Video('Status reporting that people read', YT['project-management'], 15),
            Quiz('Check: tracking and reporting', 20, (
                MC('A good status report is...', 'Short, honest and about decisions needed',
                   'Long and complete', 'Only good news'),
                TF('A risk that has happened becomes an issue.', True),
                MC('What does a burndown chart show?', 'Work remaining over time', 'Team happiness',
                   'Budget spent per person'),
            ), attempts=3),
            Assignment('Status report and retro', 30,
                       'Write the status report you would send after week 3 and a half-page retrospective.',
                       due=15),
        )),
    ),
)

DIGITAL_MARKETING = Course(
    slug='digital-marketing-basics',
    title='Digital Marketing Basics',
    instructor=RAVI,
    category='marketing',
    level='beginner',
    kind='free',
    state='rejected',
    created=50, published=14,
    reason=('The two assignments do not say how they will be graded and the second video is a placeholder. '
            'Please add grading criteria to both assignments and replace the introduction video before '
            'you resubmit.'),
    subtitle='Channels, audiences and what to measure',
    description=(
        'A first map of digital marketing: search, social, email and content. You will pick channels for a '
        'small business, set a goal for each and decide what to measure.'),
    outcomes=('Compare the main digital channels', 'Define an audience and a goal', 'Choose three metrics'),
    requirements=('None',),
    audience='Owners of small businesses and people starting in marketing.',
    summary='Rejected with a reason: the instructor sees it as "rejected" and can resubmit',
    sections=(
        Section('The landscape', items=(
            Video('Channels at a glance', YT['marketing'], 12, preview=True),
            Reading('Pick one goal per channel', (
                '<h2>One goal per channel</h2><p>Search captures demand, social creates it, email keeps it. '
                'Asking a channel to do all three is how budgets disappear.</p>')),
            Quiz('Check: channels', 20, (
                MC('Which channel captures existing demand best?', 'Search', 'Display ads', 'Sponsorships'),
                TF('Email is obsolete.', False),
                Fill('The share of visitors who take the wanted action is the ___ rate.', 'conversion'),
            )),
        )),
        Section('Plans and numbers', items=(
            Video('Audiences and messages', YT['marketing'], 18),
            Video('Metrics that matter', YT['marketing'], 16),
            Assignment('Channel plan', 30,
                       'Write a one-page channel plan for a local bakery.', due=20),
            Quiz('Check: metrics', 20, (
                MC('Which metric is closest to revenue?', 'Cost per acquisition', 'Likes', 'Impressions'),
                TF('Vanity metrics are fine to optimise for.', False),
            )),
            Assignment('Measurement plan', 30,
                       'Choose three metrics for the plan above and explain the decision each informs.',
                       due=30),
        )),
    ),
)

MARKETING_ANALYTICS = Course(
    slug='strategic-marketing-analytics',
    title='Strategic Marketing Analytics',
    instructor=RAVI,
    category='marketing',
    level='advanced',
    kind='coursera_plus',
    rating=4.1, reviews=19, created=70, published=58,
    subtitle='Attribution, experiments and the numbers a board asks for',
    description=(
        'Move from channel dashboards to decisions: attribution models, incrementality tests, customer '
        'lifetime value and how to present them to people who control the budget.'),
    outcomes=('Compare attribution models', 'Design an incrementality test',
              'Estimate customer lifetime value', 'Present a budget recommendation'),
    requirements=('Digital Marketing Basics or experience', 'Spreadsheet skills'),
    audience='Marketing managers and analysts.',
    summary='Advanced Plus course, a couple of learners',
    sections=(
        Section('Measuring what works', items=(
            Video('Attribution models', YT['marketing'], 17, preview=True),
            Reading('Incrementality in plain words', (
                '<h2>What would have happened anyway?</h2><p>An incrementality test compares a group that '
                'saw the campaign with one that did not. The difference is the campaign\'s real effect.</p>')),
            Quiz('Check: attribution', 20, (
                MC('Last-click attribution gives all credit to...', 'The final touchpoint', 'The first touchpoint',
                   'Every touchpoint equally'),
                TF('A holdout group is needed to measure incrementality.', True),
                MS('Pick inputs of customer lifetime value.', ['Average order value', 'Retention'],
                   ['Logo colour', 'Office location']),
                Fill('The cost of winning one customer is the customer ___ cost.', 'acquisition'),
            )),
        )),
        Section('Deciding', items=(
            Video('Lifetime value and payback', YT['marketing'], 25),
            Video('Experiments in practice', YT['marketing'], 19),
            Assignment('Attribution comparison', 30,
                       'Using the supplied journey data compare first-click, last-click and linear attribution '
                       'and explain where they disagree.', due=9),
            Quiz('Check: lifetime value', 20, (
                MC('Payback period is...', 'Time to earn back the acquisition cost', 'Time to launch',
                   'Customer lifespan'),
                MC('Which raises lifetime value most reliably?', 'Retention', 'Larger logo', 'More slides'),
            ), attempts=2),
            Assignment('Budget recommendation', 30,
                       'Recommend how to split a 50,000 budget across three channels and defend it in a '
                       'one-page memo.', due=24, late_ok=False),
        )),
    ),
)

EXCEL = Course(
    slug='excel-for-small-business',
    title='Excel for Small Business',
    instructor=RAVI,
    category='business',
    level='beginner',
    kind='free',
    state='unpublished',
    rating=3.6, reviews=8, created=200, published=190,
    subtitle='Invoices, cash flow and simple forecasts',
    description='Spreadsheets for people who run a business, not a finance department.',
    outcomes=('Keep a clean ledger', 'Build a cash-flow forecast'),
    requirements=('Excel or a compatible spreadsheet',),
    audience='Small business owners.',
    summary='Old course with status "unpublished" (never produced by the app, but the filters offer it)',
    sections=(
        Section('Basics', items=(
            Video('A ledger that adds itself up', YT['excel'], 20, preview=True),
            Quiz('Check: formulas', 40, (
                MC('Which function adds a range?', 'SUM', 'ADD', 'TOTALIZE'),
                TF('A cell reference with $ stays fixed when copied.', True),
            )),
            Assignment('Build an invoice template', 30,
                       'Build an invoice with automatic totals and VAT.', due=-40),
            Assignment('Twelve-month cash flow', 30,
                       'Forecast twelve months of cash in and out for a business you know.', due=-30),
        )),
    ),
)

NEGOTIATION = Course(
    slug='negotiation-skills',
    title='Negotiation Skills',
    instructor=RAVI,
    category='business',
    level='all_levels',
    kind='free',
    state='draft',
    created=6,
    subtitle='Prepare, ask, trade and close',
    description='A course in preparation.',
    summary='Empty draft with no sections: "Request Publish" asks for at least one section',
    sections=(),
)

COURSES = (PROJECT_MANAGEMENT, DIGITAL_MARKETING, MARKETING_ANALYTICS, EXCEL, NEGOTIATION)
