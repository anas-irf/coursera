"""Data science courses of Sofia Martinez."""
from ..spec import Assignment, Course, Fill, MC, MS, Quiz, Reading, Section, TF, Video
from ..videos import VIDEOS as YT

SOFIA = 'sofia.martinez@example.com'

STATISTICS = Course(
    slug='statistics-for-data-science',
    title='Statistics for Data Science',
    instructor=SOFIA,
    category='data-science',
    level='beginner',
    kind='free',
    rating=4.8, reviews=312, popularity=1248, created=130, published=118,
    subtitle='From describing a dataset to testing an idea, with no formula left unexplained',
    description=(
        'Statistics is the part of data science that keeps you honest. This course builds the ideas one '
        'at a time: distributions, sampling, confidence intervals and hypothesis tests, always on small '
        'datasets you can check by hand before you let a computer do it.'),
    outcomes=('Describe a dataset with the right summary', 'Explain sampling error and the central limit theorem',
              'Build and read a confidence interval', 'Run and report a simple A/B test'),
    requirements=('Comfort with high-school algebra', 'A spreadsheet or Python'),
    audience='Analysts, developers and students who want to reason about data without hand-waving.',
    summary='Free bestseller: 1,200+ learners shown in the catalogue, rating 4.8',
    sections=(
        Section('Thinking in distributions', items=(
            Video('Why statistics?', YT['statistics'], 11, preview=True),
            Reading('Populations, samples and variables', (
                '<h2>Populations and samples</h2>'
                '<p>A <em>population</em> is everything you care about; a <em>sample</em> is the part you '
                'can measure. Every statistic you compute from a sample is an estimate of a number you will '
                'never see.</p>'
                '<ul><li>Variable: something that differs between observations.</li>'
                '<li>Parameter: a property of the population.</li>'
                '<li>Statistic: the same property computed on the sample.</li></ul>')),
            Quiz('Check: describing data', 20, (
                MC('Which summary is least affected by one extreme outlier?', 'Median', 'Mean', 'Range'),
                TF('A standard deviation can be negative.', False,
                   why='It is the square root of an average of squares.'),
                MS('Pick the measures of spread.', ['Variance', 'Interquartile range'], ['Median', 'Mode']),
                Fill('The ___ is the middle value of an ordered data set.', 'median'),
            ), minutes=10),
        )),
        Section('From samples to conclusions', items=(
            Video('Sampling and the central limit theorem', YT['statistics'], 19),
            Video('Confidence intervals', YT['statistics'], 17),
            Reading('A worked example: estimating a mean', (
                '<h2>Estimating an average delivery time</h2>'
                '<p>Forty deliveries have a mean of 31 minutes and a standard deviation of 6. The standard '
                'error is 6 / sqrt(40), about 0.95, so a rough 95% interval is 31 +/- 1.9 minutes.</p>')),
            Assignment('Analyse a small dataset', 30,
                       'Using the delivery times dataset, report the mean, the median, a 95% confidence '
                       'interval for the mean and one paragraph on what could make the sample unrepresentative.',
                       due=-9),
        )),
        Section('Testing ideas', items=(
            Video('Hypothesis tests without the mystery', YT['statistics'], 21),
            Quiz('Check: hypothesis testing', 20, (
                MC('A p-value of 0.03 means...', 'Data this extreme would be rare if the null were true',
                   'The null hypothesis is 3% likely', 'The effect is 97% certain'),
                TF('Failing to reject the null proves it true.', False),
                Fill('A result is called statistically ___ when the p-value is below the chosen threshold.',
                     'significant'),
            ), attempts=3),
            Assignment('Write up an A/B test', 30,
                       'Two versions of a sign-up page were shown to 1,000 visitors each: 82 and 101 signed up. '
                       'Test whether the difference is real and write it up for a product manager in half a page.',
                       due=14),
        )),
    ),
)

DATA_VIZ = Course(
    slug='data-visualization-with-python',
    title='Data Visualization with Python',
    instructor=SOFIA,
    category='data-science',
    level='intermediate',
    kind='coursera_plus',
    rating=4.3, reviews=41, created=100, published=88,
    subtitle='Charts that answer a question, built with pandas and matplotlib',
    description=(
        'Learn to choose the right chart for the question, build it in a few lines of Python and polish it '
        'until a reader gets the point in five seconds. Every lecture ends with a figure you could put in a '
        'report.'),
    outcomes=('Pick a chart type from the question', 'Build layered figures with matplotlib',
              'Reshape data with pandas for plotting', 'Remove clutter and add meaning'),
    requirements=('Basic Python', 'Some familiarity with tables of data'),
    audience='Analysts and engineers who present numbers to other people.',
    summary='Plus course with a mid-range rating and a handful of learners',
    sections=(
        Section('Charts that answer questions', items=(
            Video('The chart chooser', YT['data-viz'], 13, preview=True),
            Reading('Position beats colour', (
                '<h2>What the eye does best</h2>'
                '<p>People compare positions along a common scale far more accurately than angles, areas or '
                'colours. Start with a bar or a dot plot; reach for something fancier only when it answers a '
                'question the simple chart cannot.</p>')),
            Quiz('Check: choosing a chart', 20, (
                MC('Which chart shows a trend over time best?', 'Line chart', 'Pie chart', 'Treemap'),
                TF('A pie chart is a good choice for twelve categories.', False),
                MS('Pick encodings people read accurately.', ['Position', 'Length'], ['Hue', 'Volume']),
                Fill('The matplotlib function that draws a line chart is plt.___ .', 'plot'),
            )),
        )),
        Section('Building figures', items=(
            Video('Figures, axes and layers', YT['data-viz'], 18),
            Video('Tidying data for plotting', YT['data-viz'], 20),
            Reading('A style checklist', (
                '<h2>Before you share a chart</h2>'
                '<ul><li>Does the title state the finding?</li><li>Are the axes labelled with units?</li>'
                '<li>Is every colour doing a job?</li></ul>')),
            Assignment('Rebuild a misleading chart', 30,
                       'Take the supplied chart, explain what is misleading about it and rebuild it honestly '
                       'in matplotlib. Submit the notebook or a PDF of the code and both figures.', due=10),
        )),
        Section('Telling the story', items=(
            Video('Annotations and small multiples', YT['data-viz'], 15),
            Quiz('Check: telling a story', 20, (
                MC('What do small multiples help you compare?', 'The same view across groups',
                   'Unrelated metrics', 'Only colours'),
                TF('Annotating the key point on a chart is a form of clutter.', False),
                MC('What should a chart title do?', 'State the finding', 'Name the tool', 'Repeat the axis'),
            ), attempts=2),
            Assignment('A one-page data story', 30,
                       'Choose a public dataset and build a one-page story: a question, two figures and a '
                       'conclusion. Keep the text under 250 words.', due=25),
        )),
    ),
)

BAYESIAN = Course(
    slug='bayesian-methods-in-practice',
    title='Bayesian Methods in Practice',
    instructor=SOFIA,
    category='data-science',
    level='advanced',
    kind='coursera_plus',
    state='draft',
    created=30,
    subtitle='Priors, posteriors and the probabilistic programs that connect them',
    description=(
        'A hands-on tour of Bayesian modelling: set priors, fit models with sampling and check them against '
        'the data they are supposed to explain.'),
    outcomes=('Write down a prior and justify it', 'Fit a model with MCMC', 'Check a posterior predictively'),
    requirements=('Statistics for Data Science or equivalent', 'Python'),
    audience='Practitioners who already know frequentist basics.',
    summary='Draft that is ready: weights add up to 100, so "Request Publish" succeeds',
    sections=(
        Section('Beliefs and evidence', items=(
            Video('From Bayes\' rule to a model', YT['statistics'], 16, preview=True),
            Reading('Priors you can defend', (
                '<h2>Choosing a prior</h2><p>A prior states what you believed before the data. Weakly '
                'informative priors keep estimates sensible without deciding the answer for you.</p>')),
            Quiz('Check: Bayes\' rule', 40, (
                MC('The posterior is proportional to...', 'Likelihood times prior', 'Prior minus likelihood',
                   'Likelihood divided by data'),
                TF('A flat prior is always the most objective choice.', False),
            )),
        )),
        Section('Fitting and checking', items=(
            Video('Sampling the posterior', YT['statistics'], 24),
            Assignment('Fit a hierarchical model', 40,
                       'Fit the supplied partial-pooling model and compare it to the no-pooling estimate.', due=20),
            Assignment('Posterior predictive check', 20,
                       'Simulate from your fitted model and describe where it fails to resemble the data.',
                       due=30),
        )),
    ),
)

COURSES = (STATISTICS, DATA_VIZ, BAYESIAN)
