"""The cast of ``seed_dev``.

Every e-mail is on example.com (reserved for documentation, never delivered).
``seed_dev --reset`` removes exactly the people listed here and everything that
hangs off them.  ``story`` is what to try with the account; it is printed with
the cast.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Person:
    email: str
    role: str                    # student | instructor | admin
    first_name: str
    last_name: str
    story: str
    country: str = ''
    city: str = ''
    bio: str = ''
    expertise: str = ''          # instructors
    years: int = 0               # instructors: years of experience
    joined: int = 60             # days ago
    login: int | None = 0        # last login, days ago (None = never)
    verified: bool = True        # e-mail address confirmed
    active: bool = True
    superuser: bool = False
    hours: float = 0.0           # students: total learning hours (drives the global rank)
    interests: tuple = ()        # students
    goals: str = ''              # students
    verified_instructor: bool = False

    @property
    def name(self):
        return f'{self.first_name} {self.last_name}'


ADMINS = (
    Person('demo.admin@example.com', 'admin', 'Demo', 'Admin', superuser=True, joined=170, login=0,
           country='United Kingdom', city='London',
           bio='Runs the platform: reviews course submissions and looks after the accounts.',
           story='Superuser: approves and rejects courses, sees every list, the revenue and the reports'),
    Person('priya.nair@example.com', 'admin', 'Priya', 'Nair', joined=120, login=2,
           country='India', city='Bengaluru',
           bio='Content moderator. Reviews new courses against the publishing guidelines.',
           story='Plain admin (not a superuser): shows as "Admin" instead of "Superuser" in the user list'),
)

INSTRUCTORS = (
    Person('demo.instructor@example.com', 'instructor', 'Demo', 'Instructor', joined=165, login=0,
           country='United States', city='Austin', years=9, verified_instructor=True,
           bio='Software engineer turned teacher. I like programs that fit on one screen.',
           expertise='Python, software design, machine learning',
           story='Owns the two demo courses (one free, one Plus) and the Cloud course waiting for approval; '
                 'one hand-in waits for a grade'),
    Person('sofia.martinez@example.com', 'instructor', 'Sofia', 'Martinez', joined=150, login=1,
           country='Spain', city='Madrid', years=12, verified_instructor=True,
           bio='Statistician and data scientist. Ten years of turning messy tables into decisions.',
           expertise='Statistics, data visualisation, Bayesian methods',
           story='Data science instructor: a free bestseller, a Plus course, a draft that is ready to '
                 'submit, one hand-in waiting for a grade'),
    Person('james.okafor@example.com', 'instructor', 'James', 'Okafor', joined=140, login=0,
           country='Nigeria', city='Lagos', years=8, verified_instructor=True,
           bio='Full-stack developer and bootcamp mentor. Ships weekly, teaches what worked.',
           expertise='JavaScript, React, Django, PostgreSQL',
           story='Busiest instructor: the featured free course with most learners, one Plus course, one '
                 'course pending review, one taken offline with learners still enrolled'),
    Person('lena.fischer@example.com', 'instructor', 'Lena', 'Fischer', joined=120, login=4,
           country='Germany', city='Berlin', years=6, verified_instructor=True,
           bio='Product designer. Believes every interface is a conversation.',
           expertise='UX research, interaction design, design systems',
           story='Design instructor with free courses only (earnings stay at zero), a late hand-in waiting '
                 'for a grade and a draft that cannot be submitted yet (weights are not 100)'),
    Person('ravi.shah@example.com', 'instructor', 'Ravi', 'Shah', joined=100, login=3,
           country='India', city='Pune', years=11,
           bio='Ex-consultant. Teaches project management and marketing analytics from real engagements.',
           expertise='Project management, marketing analytics, operations',
           story='Business instructor: a rejected course with feedback, an empty draft, an old course '
                 'marked unpublished, two Plus courses with earnings and one hand-in waiting'),
    Person('noah.bennett@example.com', 'instructor', 'Noah', 'Bennett', joined=9, login=1,
           country='Canada', city='Toronto', years=2,
           bio='Photographer getting ready to publish a first course.',
           expertise='Photography, visual storytelling',
           story='Brand-new instructor with no courses: every instructor screen shows its empty state'),
)

STUDENTS = (
    Person('demo.student@example.com', 'student', 'Demo', 'Student', joined=150, login=0, hours=64.5,
           country='United States', city='Chicago',
           interests=('Python', 'Data science', 'Web development'),
           goals='Move from spreadsheets to Python and build a portfolio of small data projects.',
           story='Headline learner: Plus member, five enrolments from 0 to 100 percent, a certificate, '
                 'unread notifications and four conversations'),
    Person('amara.okoye@example.com', 'student', 'Amara', 'Okoye', joined=140, login=0, hours=118.0,
           country='Nigeria', city='Abuja',
           interests=('Web development', 'JavaScript'),
           goals='Land a junior front-end role by the end of the year.',
           story='Power learner: yearly Plus, a learning streak of eight days, two certificates, top of the ranking'),
    Person('liam.chen@example.com', 'student', 'Liam', 'Chen', joined=95, login=1, hours=41.0,
           country='Singapore', city='Singapore',
           interests=('Data science', 'Visualisation'),
           goals='Learn enough Python to automate the monthly reporting at work.',
           story='Monthly Plus member working through two Plus courses'),
    Person('sara.haddad@example.com', 'student', 'Sara', 'Haddad', joined=110, login=6, hours=22.5,
           country='Jordan', city='Amman',
           interests=('Design', 'Business'),
           story='Cancelled Plus (still paid until the end date, auto-renew off) while enrolled in a Plus course'),
    Person('mateo.alvarez@example.com', 'student', 'Mateo', 'Alvarez', joined=130, login=12, hours=36.0,
           country='Mexico', city='Guadalajara',
           interests=('Business', 'Marketing'),
           story='Plus lapsed after a failed payment: header offers "Upgrade", Plus enrolments are still listed'),
    Person('yuki.tanaka@example.com', 'student', 'Yuki', 'Tanaka', joined=70, login=0, hours=27.0,
           country='Japan', city='Osaka',
           interests=('Programming', 'Design'),
           story='Three free courses in progress; one assignment waiting for the instructor to grade'),
    Person('fatima.zahra@example.com', 'student', 'Fatima', 'Zahra', joined=85, login=0, hours=52.0,
           country='Morocco', city='Casablanca',
           interests=('Business', 'Data science'),
           story='Ninety percent through a course; the last assignment is waiting for grading'),
    Person('oliver.smith@example.com', 'student', 'Oliver', 'Smith', joined=60, login=3, hours=11.5,
           country='United Kingdom', city='Leeds',
           interests=('Programming',),
           story='Struggling: failed the quiz three times (no attempts left) and scored low on the assignment'),
    Person('chloe.dubois@example.com', 'student', 'Chloe', 'Dubois', joined=75, login=1, hours=30.0,
           country='France', city='Lyon',
           interests=('Design', 'Marketing'),
           story='Handed an assignment in after the deadline; it has not been graded yet'),
    Person('arjun.mehta@example.com', 'student', 'Arjun', 'Mehta', joined=105, login=5, hours=58.0,
           country='India', city='Mumbai',
           interests=('Data science', 'Statistics'),
           story='Completed a course with a certificate and a high final grade'),
    Person('emma.johansson@example.com', 'student', 'Emma', 'Johansson', joined=3, login=0, hours=0.5,
           country='Sweden', city='Gothenburg',
           interests=('Web development',),
           story='Signed up this week and enrolled today: everything at 0 percent'),
    Person('daniel.kim@example.com', 'student', 'Daniel', 'Kim', joined=20, login=1, hours=1.0,
           country='South Korea', city='Seoul',
           interests=('Programming',),
           story='Enrolled yesterday, nothing finished yet; has bookmarked two more courses'),
    Person('zainab.bello@example.com', 'student', 'Zainab', 'Bello', joined=55, login=0, hours=14.0,
           country='Nigeria', city='Kano',
           interests=('Programming', 'Data science'),
           story='A third of the way through; passed the first quiz on the first attempt'),
    Person('lucas.rossi@example.com', 'student', 'Lucas', 'Rossi', joined=65, login=2, hours=19.5,
           country='Italy', city='Milan',
           interests=('Web development',),
           story='Half way through; scored 100 percent on a quiz'),
    Person('hannah.weiss@example.com', 'student', 'Hannah', 'Weiss', joined=80, login=1, hours=33.0,
           country='Austria', city='Vienna',
           interests=('Design',),
           story='Seventy percent through; the assignment was graded below the passing score, with feedback'),
    Person('omar.farouk@example.com', 'student', 'Omar', 'Farouk', joined=90, login=19, hours=8.0,
           country='Egypt', city='Cairo',
           interests=('Business',),
           story='Started well, then went quiet: last active almost three weeks ago'),
    Person('isabella.costa@example.com', 'student', 'Isabella', 'Costa', joined=115, login=2, hours=47.0,
           country='Brazil', city='Sao Paulo',
           interests=('Web development', 'Design'),
           story='Completed a course (certificate) and is enrolled in one that was later taken offline'),
    Person('ethan.walker@example.com', 'student', 'Ethan', 'Walker', joined=35, login=4, hours=0.0,
           country='Australia', city='Melbourne',
           interests=('Business', 'Marketing', 'Design'),
           story='Browsing only: three bookmarks, no enrolments and no subscription row (sees the Plus banner)'),
    Person('mei.lin@example.com', 'student', 'Mei', 'Lin', joined=6, login=1,
           country='China', city='Shenzhen',
           story='Newcomer who has not done anything yet: every learner screen shows its empty state'),
    Person('tariq.aziz@example.com', 'student', 'Tariq', 'Aziz', joined=12, login=None, verified=False,
           country='Pakistan', city='Lahore',
           story='Registered but never confirmed the e-mail address and never logged in'),
    Person('grace.mwangi@example.com', 'student', 'Grace', 'Mwangi', joined=140, login=70, active=False,
           country='Kenya', city='Nairobi',
           story='Deactivated account: shows as inactive in the admin list and cannot log in'),
    Person('ivan.petrov@example.com', 'student', 'Ivan', 'Petrov', joined=72, login=0, hours=24.0,
           country='Bulgaria', city='Sofia',
           interests=('Web development',),
           story='Two courses of the same instructor at different progress (roster shows "2 courses")'),
    Person('nina.kowalski@example.com', 'student', 'Nina', 'Kowalski', joined=48, login=2, hours=9.0,
           country='Poland', city='Krakow',
           interests=('Business', 'Design'),
           story='One course at 40 percent and two bookmarks'),
    Person('jonas.berg@example.com', 'student', 'Jonas', 'Berg', joined=58, login=0, hours=17.0,
           country='Norway', city='Oslo',
           interests=('Data science',),
           story='Long back-and-forth with an instructor: the 30-message conversation'),
)

PEOPLE = ADMINS + INSTRUCTORS + STUDENTS
EMAILS = tuple(person.email for person in PEOPLE)
BY_EMAIL = {person.email: person for person in PEOPLE}
