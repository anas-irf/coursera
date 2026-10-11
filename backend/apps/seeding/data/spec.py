"""Small declaration types the data files are written with."""
from dataclasses import dataclass, field


# --------------------------------------------------------------------------- #
# curriculum
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Video:
    title: str
    youtube: str                 # video id of https://www.youtube.com/watch?v=<id>
    minutes: int
    preview: bool = False        # free preview lecture


@dataclass(frozen=True)
class Reading:
    title: str
    html: str


@dataclass(frozen=True)
class Question:
    kind: str                    # multiple_choice | true_false | multiple_select | fill_blank
    text: str
    options: tuple = ()          # ((text, is_correct), ...)
    answers: tuple = ()          # accepted answers of a fill_blank
    points: int = 1
    why: str = ''                # explanation shown after answering


def MC(text, correct, *wrong, points=1, why=''):
    """Single choice: the first option is the right one (the order is shuffled by position)."""
    options = ((correct, True),) + tuple((option, False) for option in wrong)
    return Question('multiple_choice', text, options=options, points=points, why=why)


def TF(text, answer, points=1, why=''):
    return Question('true_false', text, options=(('True', answer), ('False', not answer)),
                    points=points, why=why)


def MS(text, correct, wrong, points=2, why=''):
    options = tuple((option, True) for option in correct) + tuple((option, False) for option in wrong)
    return Question('multiple_select', text, options=options, points=points, why=why)


def Fill(text, *answers, points=1, why=''):
    return Question('fill_blank', text, answers=tuple(answers), points=points, why=why)


@dataclass(frozen=True)
class Quiz:
    title: str
    weight: int
    questions: tuple
    passing: int = 60
    attempts: int = 3
    minutes: int | None = None   # time limit (shown to the student, not enforced)
    active: bool = True


@dataclass(frozen=True)
class Assignment:
    title: str
    weight: int
    instructions: str
    points: int = 100
    passing: int = 60
    due: int | None = None       # days from now; negative = already past; None = no due date
    late_ok: bool = True


@dataclass(frozen=True)
class Section:
    title: str
    items: tuple
    description: str = ''


@dataclass(frozen=True)
class Course:
    slug: str
    title: str
    instructor: str              # e-mail
    category: str | None         # slug of one of the Explore categories, None = uncategorised
    level: str                   # beginner | intermediate | advanced | all_levels
    kind: str                    # free | coursera_plus
    subtitle: str
    description: str
    sections: tuple = ()
    state: str = 'published'     # published | pending_review | rejected | draft | taken_offline | unpublished
    outcomes: tuple = ()
    requirements: tuple = ()
    audience: str = ''
    language: str = 'en'
    rating: float = 0.0
    reviews: int = 0
    popularity: int = 0          # total_enrolled shown in the catalogue (at least the real enrolments)
    featured: bool = False
    created: int = 90            # days ago
    published: int = 70          # days ago (published / submitted / rejected)
    reason: str = ''             # rejection reason
    edited_after_submission: int = 0   # lowers the last quiz weight by this much after submitting
    summary: str = field(default='', compare=False)   # one line for the cast table


# --------------------------------------------------------------------------- #
# activity
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class Submit:
    """A student's hand-in; ``grade`` is points out of the assignment's maximum (None = waiting)."""
    text: str = ''
    file: str = ''               # e.g. 'week1-summary.pdf' or 'notes.txt'
    grade: int | None = None
    feedback: str = ''


@dataclass(frozen=True)
class Enrol:
    course: str                  # slug
    days: float                  # enrolled this many days ago
    done: int = 0                # lectures finished, in curriculum order
    last: float | None = None    # last activity, days ago (default: right after the enrolment)
    quiz: dict = field(default_factory=dict)    # quiz title -> attempts, each = questions answered correctly
    work: dict = field(default_factory=dict)    # assignment title -> Submit
    daily: bool = False          # one finished lecture per day, the last one today (streak)
    certificate: bool = False


@dataclass(frozen=True)
class Plus:
    plan: str                    # monthly | yearly
    since: int                   # days ago
    final: str = 'active'        # active | cancelled | lapsed
    failed_payment: bool = False


@dataclass(frozen=True)
class Story:
    email: str
    enrol: tuple = ()
    bookmarks: tuple = ()        # course slugs
    plus: Plus | None = None
