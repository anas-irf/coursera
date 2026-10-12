"""Conversations and the notifications no application event produces."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Thread:
    a: str                       # e-mail
    b: str
    lines: tuple                 # ((speaker, text), ...) with speaker 'a' or 'b'
    started: float               # days ago of the first message
    ended: float                 # days ago of the last message
    unread: int = 0              # how many of the latest messages to ``unread_for`` are still unread
    unread_for: str = 'a'        # 'a' or 'b'


@dataclass(frozen=True)
class Note:
    email: str
    kind: str                    # a Notification type
    title: str
    message: str
    hours: float                 # how long ago
    url: str | None = None       # internal path of the frontend
    read: bool | None = None     # None: read once it is older than two weeks


def _statistics_questions():
    """Fifteen question and answer pairs: the long thread of Jonas and Sofia."""
    pairs = (
        ('Hi Sofia, is the standard error the same as the standard deviation?',
         'No: the standard deviation describes the spread of the data, the standard error the spread of '
         'the estimate. It shrinks as the sample grows.'),
        ('So with more data the mean is more certain but the data is not less spread out?',
         'Exactly. Ten times the data makes the standard error about three times smaller.'),
        ('Why is it divided by the square root of n and not n?',
         'Because variances add, not standard deviations. The variance of a mean is sigma squared over n.'),
        ('Does the central limit theorem need a normal population?',
         'No, that is the point. The distribution of the mean approaches normal for most populations if n '
         'is large enough.'),
        ('How large is large enough?',
         'It depends on the skew. Thirty is a folk number; with heavy skew you may want hundreds.'),
        ('Can I use a confidence interval when I have the whole population?',
         'There is nothing to estimate then: the mean is the mean. Intervals are for samples.'),
        ('What does 95% actually mean?',
         'If you repeated the whole procedure many times, about 95% of the intervals would contain the '
         'true value. It is a statement about the method.'),
        ('So I cannot say there is a 95% chance this interval contains it?',
         'Strictly no, although people do. The Bayesian credible interval is the one that says that.'),
        ('When should I use a t distribution?',
         'When the population standard deviation is unknown and the sample is small. For large samples '
         'the two are nearly identical.'),
        ('Is a p-value the probability that the null is true?',
         'No. It is the probability of data this extreme if the null were true.'),
        ('What if I run twenty tests and one is significant?',
         'Expect about one false positive in twenty at the 5% level. Correct for multiple comparisons or '
         'treat it as a lead, not a result.'),
        ('How do I choose the sample size for an A/B test?',
         'Decide the smallest effect you care about, the power you want and the base rate, then compute '
         'it before you start. Do not peek and stop early.'),
        ('Why not stop as soon as it is significant?',
         'Because looking repeatedly inflates the false positive rate. Fix the stopping rule in advance.'),
        ('Thanks, this finally makes sense. Is there a good book to go further?',
         'Statistical Rethinking is a lovely next step if you like the Bayesian view; All of Statistics '
         'if you want it compact and rigorous.'),
        ('I will start with the first one. Thank you for the patience!',
         'Any time. Send me your A/B write-up when it is done and I will read it before the deadline.'),
    )
    lines = []
    for question, answer in pairs:
        lines.append(('a', question))
        lines.append(('b', answer))
    return tuple(lines)


THREADS = (
    Thread('demo.student@example.com', 'demo.instructor@example.com', started=40, ended=0.3, unread=2,
           unread_for='a', lines=(
               ('a', 'Hi! In the quiz, why is a list not the same as a tuple?'),
               ('b', 'A list can change after you create it, a tuple cannot. That also makes tuples '
                     'usable as dictionary keys.'),
               ('a', 'Got it. And when would I choose one over the other?'),
               ('b', 'Tuples for a fixed group of values such as a coordinate, lists for a collection '
                     'that grows or shrinks.'),
               ('a', 'Thanks, that helped a lot with the summary assignment.'),
               ('b', 'Glad it did. Your summary was one of the clearest this month.'),
               ('b', 'By the way, the next course in the series opens next week if you want a head start.'),
               ('b', 'I will post the reading list in the announcements tomorrow.'),
           )),
    Thread('demo.student@example.com', 'ravi.shah@example.com', started=6, ended=1, unread=1,
           unread_for='b', lines=(
               ('a', 'Hello Ravi, my attribution comparison is submitted. When do you grade?'),
               ('b', 'I grade on Thursdays, so you will have feedback within a week.'),
               ('a', 'Perfect. One question: should linear attribution include view-through conversions?'),
               ('b', 'Keep it to clicks for this exercise, we cover view-through in the next module.'),
               ('a', 'Understood, thank you!'),
           )),
    Thread('demo.student@example.com', 'priya.nair@example.com', started=4, ended=3, lines=(
        ('a', 'Hi, my certificate for Introduction to Python is missing the date.'),
        ('b', 'Thanks for flagging it. The date is the completion date; I see Oct 8 on our side.'),
        ('a', 'Ah, it was just hidden in the footer. Sorry about that!'),
        ('b', 'No problem at all. Happy learning.'),
    )),
    Thread('demo.student@example.com', 'yuki.tanaka@example.com', started=12, ended=0.1, unread=2,
           unread_for='a', lines=(
               ('b', 'Hey, are you also doing the Python summary this week?'),
               ('a', 'Done already! Want to compare notes?'),
               ('b', 'Yes please. I am stuck on explaining what a function is without code.'),
               ('a', 'I compared it to a recipe: name, ingredients in, dish out.'),
               ('b', 'That is perfect, stealing it.'),
               ('b', 'Study group on Saturday? Amara and Liam are in too.'),
           )),
    Thread('amara.okoye@example.com', 'james.okafor@example.com', started=14, ended=2, lines=(
        ('a', 'Hi James, should the search state live in the list or in a parent component?'),
        ('b', 'Ask who needs it. If only the list and its input do, keep it in the list.'),
        ('a', 'Only those two. Then I will keep it there.'),
        ('b', 'Good. You can lift it later if a sibling needs it; moving state up is cheap.'),
        ('a', 'Submitted! Thanks for the nudge.'),
        ('b', 'Saw it, nicely done. Grade is in.'),
    )),
    Thread('liam.chen@example.com', 'sofia.martinez@example.com', started=9, ended=1, unread=1,
           unread_for='b', lines=(
               ('a', 'Sofia, my bar chart has 14 categories and the labels overlap.'),
               ('b', 'Flip it to horizontal bars and sort by value; long labels read better sideways.'),
               ('a', 'That worked. Is it fine to drop the gridlines then?'),
               ('b', 'Keep a light line at zero and let the bar ends carry the value.'),
               ('a', 'Great, I will send the notebook once it is tidy.'),
           )),
    Thread('oliver.smith@example.com', 'demo.instructor@example.com', started=11, ended=1, unread=1,
           unread_for='a', lines=(
               ('a', 'I used all my attempts on the Python quiz and I still do not get lists.'),
               ('b', 'Thanks for telling me. Lists are the most common stumbling block; want a worked '
                     'example?'),
               ('a', 'Yes please, I keep mixing up indexes.'),
               ('b', 'Indexes start at zero: in ["a", "b", "c"], "a" is at 0 and "c" at 2. Try the '
                     'reading again with that in mind, then tell me what still looks odd.'),
               ('b', 'I have also opened a practice sheet in the course notes.'),
           )),
    Thread('jonas.berg@example.com', 'sofia.martinez@example.com', started=30, ended=0.2, unread=2,
           unread_for='a', lines=_statistics_questions()),
    Thread('chloe.dubois@example.com', 'lena.fischer@example.com', started=6, ended=2, unread=1,
           unread_for='a', lines=(
               ('a', 'Hello Lena, I am sorry my interview assignment is late, I was ill.'),
               ('b', 'Thanks for letting me know; late work is accepted, just with a note on the grade.'),
               ('a', 'Thank you. I submitted it today.'),
               ('b', 'Got it. I will look at it this week.'),
           )),
    Thread('demo.instructor@example.com', 'demo.admin@example.com', started=5, ended=4, lines=(
        ('a', 'The Cloud course is waiting for review: could you take a look when you can?'),
        ('b', 'On my list for tomorrow. The grade weights look right, so it should be quick.'),
        ('a', 'Thanks! I added subtitles to the first video as well.'),
        ('b', 'Noted, thank you.'),
    )),
    Thread('james.okafor@example.com', 'demo.admin@example.com', started=3, ended=0.6, unread=1,
           unread_for='b', lines=(
               ('a', 'I took HTML and CSS Crash Course offline to re-record two videos. Do the '
                     'learners keep their progress?'),
               ('b', 'Yes: enrolments and progress stay. They cannot open the player until the course '
                     'is published again.'),
               ('a', 'Understood. I will resubmit it for review by Friday.'),
           )),
    Thread('fatima.zahra@example.com', 'sofia.martinez@example.com', started=3, ended=1.5, lines=(
        ('a', 'Hi Sofia, my dataset assignment is still waiting for a grade, is everything fine with it?'),
        ('b', 'Everything is fine, I am working through a batch of submissions. Yours is next.'),
        ('a', 'Thank you!'),
    )),
)


NOTES = (
    # the headline student: a full bell, ten unread
    Note('demo.student@example.com', 'announcement', 'New course: Cloud Computing Fundamentals',
         'Cloud Computing Fundamentals is awaiting review and opens to Plus members soon.', 1,
         '/student/explore'),
    Note('demo.student@example.com', 'assignment_due', 'Assignment due soon',
         '"Interactive counter" in JavaScript from Scratch is due in three weeks.', 3,
         '/courses/javascript-from-scratch/learn'),
    Note('demo.student@example.com', 'quiz_available', 'Quiz available: Check: the DOM',
         'A new quiz is available in JavaScript from Scratch.', 26, '/student/my-learning'),
    Note('demo.student@example.com', 'course_update', 'New lecture in Applied Machine Learning',
         'A reading about choosing a metric was added to Applied Machine Learning.', 30,
         '/student/my-learning'),
    Note('demo.student@example.com', 'system', 'Scheduled maintenance',
         'The platform will be unavailable on Sunday between 02:00 and 02:30 UTC.', 52),
    Note('demo.student@example.com', 'announcement', 'Study group Saturday',
         'Yuki Tanaka invited you to a study group on Saturday.', 70, '/student/messages'),
    Note('demo.student@example.com', 'course_update', 'Course notes updated',
         'The notes of Introduction to Python were updated.', 150, '/student/my-learning'),
    Note('demo.student@example.com', 'system', 'Welcome to the platform',
         'Welcome! Explore the catalogue and enrol in your first course.', 24 * 148, '/student/explore'),

    # a few for everybody else, one of each flavour
    Note('amara.okoye@example.com', 'announcement', 'Your streak is on fire',
         'Eight days in a row. Keep it going to unlock more badges.', 2, '/student/achievements'),
    Note('liam.chen@example.com', 'assignment_due', 'Assignment due soon',
         '"Rebuild a misleading chart" is due in ten days.', 5, '/student/my-learning'),
    Note('mateo.alvarez@example.com', 'system', 'Your Plus membership has ended',
         'Your payment could not be processed and your Coursera Plus membership has ended. Renew to '
         'continue your Plus courses.', 24 * 9, '/student/checkout', ),
    Note('sara.haddad@example.com', 'system', 'Plus membership cancelled',
         'Your membership stays active until the end of the paid period.', 24 * 2, '/student/checkout'),
    Note('emma.johansson@example.com', 'system', 'Welcome to the platform',
         'Welcome! Explore the catalogue and enrol in your first course.', 70, '/student/explore'),
    Note('demo.instructor@example.com', 'system', 'Payout processed',
         'Your payout for last month was processed.', 24 * 11, '/instructor/earnings'),
    Note('sofia.martinez@example.com', 'system', 'Payout processed',
         'Your payout for last month was processed.', 24 * 11, '/instructor/earnings'),
    Note('james.okafor@example.com', 'announcement', 'Review guidelines updated',
         'The publishing guidelines changed: every assignment needs visible grading criteria.', 24 * 5,
         '/instructor/courses'),
    Note('lena.fischer@example.com', 'announcement', 'Review guidelines updated',
         'The publishing guidelines changed: every assignment needs visible grading criteria.', 24 * 5,
         '/instructor/courses'),
    Note('ravi.shah@example.com', 'announcement', 'Review guidelines updated',
         'The publishing guidelines changed: every assignment needs visible grading criteria.', 24 * 5,
         '/instructor/courses'),
    Note('demo.admin@example.com', 'system', 'Weekly summary',
         'Two courses are waiting for review and one account was deactivated this week.', 8,
         '/admin/courses/approvals'),
    Note('priya.nair@example.com', 'system', 'Weekly summary',
         'Two courses are waiting for review and one account was deactivated this week.', 8,
         '/admin/courses/approvals'),
)
