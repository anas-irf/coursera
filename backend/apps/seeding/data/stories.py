"""What the students do: subscriptions, enrolments, quiz attempts, hand-ins and bookmarks.

``Enrol.done`` counts the lectures finished in curriculum order; the quiz and
the assignment among them need an outcome (``quiz`` / ``work``).  A quiz entry
lists its attempts, each one the number of questions answered correctly (the
first ones are right, the rest wrong).  Days are "days before the seed ran".
"""
from .spec import Enrol, Plus, Story, Submit

PY = 'introduction-to-python'
ML = 'applied-machine-learning'
STATS = 'statistics-for-data-science'
VIZ = 'data-visualization-with-python'
JS = 'javascript-from-scratch'
REACT = 'react-for-beginners'
HTML = 'html-and-css-crash-course'
UX = 'ux-design-fundamentals'
SYSTEMS = 'design-systems-from-zero'
PM = 'project-management-essentials'
ANALYTICS = 'strategic-marketing-analytics'

# the quizzes and assignments, by the titles used in the curriculum
PY_QUIZ = 'Check your understanding'
PY_WORK = 'Write a short summary'


STORIES = (
    # ------------------------------------------------------------------ headline
    Story('demo.student@example.com',
          plus=Plus('monthly', since=100),
          bookmarks=(UX, SYSTEMS),
          enrol=(
              Enrol(PY, days=70, done=8, last=3, certificate=True,
                    quiz={PY_QUIZ: [2, 3]},
                    work={PY_WORK: Submit(
                        text='Python reads like plain English: you describe what should happen and the '
                             'interpreter does it line by line. Variables name values, functions name '
                             'steps, and a loop saves you from writing the same line twice.',
                        grade=88,
                        feedback='Clear and accurate. Next time give one concrete example of a function.')}),
              Enrol(JS, days=40, done=5, last=1, quiz={'Check: values and types': [4]}),
              Enrol(ML, days=25, done=2, last=6),
              Enrol(ANALYTICS, days=18, done=6, last=2,
                    quiz={'Check: attribution': [4]},
                    work={'Attribution comparison': Submit(
                        text='First-click credits the channel that introduced the customer, last-click the '
                             'one that closed the sale and linear splits the credit. They disagree most on '
                             'content: it starts journeys but rarely finishes them.')}),
              Enrol(REACT, days=0.1, done=0),
          )),

    # --------------------------------------------------------------------- plus
    Story('amara.okoye@example.com',
          plus=Plus('yearly', since=150),
          enrol=(
              Enrol(JS, days=110, done=10, last=60, certificate=True,
                    quiz={'Check: values and types': [4], 'Check: the DOM': [3]},
                    work={'Build a to-do list in the console': Submit(
                              text='The list lives in an array of objects; add, complete and print are three '
                                   'small functions. I kept the printing separate so it can change later.',
                              grade=94, feedback='Very tidy. Splitting printing from data was the right call.'),
                          'Interactive counter': Submit(
                              text='The page reads the number from a variable and re-renders it after every '
                                   'click, so the screen and the variable cannot drift apart.',
                              grade=90, feedback='Good explanation of the single source of truth.')}),
              Enrol(UX, days=85, done=10, last=30, certificate=True,
                    quiz={'Check: research basics': [4], 'Check: prototypes and tests': [3]},
                    work={'Interview and synthesis': Submit(
                              file='interview-notes.pdf',
                              text='Notes and five insights from two interviews are attached.',
                              grade=90, feedback='Great insights. The problem statement could be sharper.'),
                          'Prototype and test': Submit(
                              text='Three people tested the prototype. Two missed the save button, so I made '
                                   'it larger and moved it next to the form.',
                              grade=88, feedback='Good use of evidence for the change.')}),
              Enrol(REACT, days=12, done=8, daily=True,
                    quiz={'Check: components and props': [4]},
                    work={'A searchable course list': Submit(
                        text='The search text lives in the list component because both the input and the '
                             'filtered list need it; the items only receive props.',
                        grade=85, feedback='Correct placement of state. Name the handlers more clearly.')}),
          )),
    Story('liam.chen@example.com',
          plus=Plus('monthly', since=60),
          enrol=(
              Enrol(VIZ, days=45, done=6, last=2, quiz={'Check: choosing a chart': [4]}),
              Enrol(REACT, days=20, done=3, last=5, quiz={'Check: components and props': [2]}),
              Enrol(STATS, days=30, done=4, last=1, quiz={'Check: describing data': [3]}),
          )),
    Story('sara.haddad@example.com',
          plus=Plus('monthly', since=70, final='cancelled'),
          enrol=(
              Enrol(PM, days=50, done=4, last=15, quiz={'Check: scope and goals': [3]}),
              Enrol(UX, days=25, done=2, last=10),
          )),
    Story('mateo.alvarez@example.com',
          plus=Plus('monthly', since=130, final='lapsed', failed_payment=True),
          enrol=(
              Enrol(ANALYTICS, days=55, done=5, last=20, quiz={'Check: attribution': [3]}),
              Enrol(PM, days=75, done=7, last=18,
                    quiz={'Check: scope and goals': [4]},
                    work={'Plan a small project': Submit(
                        text='Charter for moving a small warehouse to a new layout: six weeks, four people, '
                             'two main risks (supplier delay, staff availability).',
                        grade=72, feedback='The charter is solid; the estimates have no ranges.')}),
          )),

    # ------------------------------------------------------------- free learners
    Story('yuki.tanaka@example.com',
          enrol=(
              Enrol(PY, days=35, done=4, last=3, quiz={PY_QUIZ: [3]},
                    work={PY_WORK: Submit(
                        text='Python is a language for telling a computer what to do in steps. I liked that '
                             'the code is short enough to read out loud.')}),
              Enrol(JS, days=20, done=3, last=1, quiz={'Check: values and types': [3]}),
              Enrol(UX, days=12, done=2, last=2),
          )),
    Story('fatima.zahra@example.com',
          enrol=(
              Enrol(STATS, days=60, done=9, last=1,
                    quiz={'Check: describing data': [4], 'Check: hypothesis testing': [3]},
                    work={'Analyse a small dataset': Submit(
                        file='delivery-times-analysis.pdf',
                        text='Mean 31.0 minutes, median 30, interval 29.1 to 32.9. The sample is only one '
                             'city, so it may not describe other areas.')}),
          )),
    Story('oliver.smith@example.com',
          enrol=(
              Enrol(PY, days=50, done=3, last=10, quiz={PY_QUIZ: [1, 0, 1]}),
              Enrol(JS, days=30, done=7, last=6,
                    quiz={'Check: values and types': [2]},
                    work={'Build a to-do list in the console': Submit(
                        text='tasks = [] and a function to add.',
                        grade=35,
                        feedback='This is a start, but it does not complete or print the list. Please '
                                 'follow the steps in the lecture and resubmit your reasoning.')}),
          )),
    Story('chloe.dubois@example.com',
          enrol=(
              Enrol(UX, days=60, done=7, last=5,
                    quiz={'Check: research basics': [3]},
                    work={'Interview and synthesis': Submit(
                        text='Sorry for the late hand-in. Interviews with a student and a nurse, five '
                             'insights and a draft problem statement are in the attached notes.',
                        file='interview-synthesis.txt')}),
          )),
    Story('arjun.mehta@example.com',
          enrol=(
              Enrol(STATS, days=100, done=10, last=40, certificate=True,
                    quiz={'Check: describing data': [4], 'Check: hypothesis testing': [3]},
                    work={'Analyse a small dataset': Submit(
                              text='Mean 31.0, median 30.0, 95% interval 29.1 to 32.9; the sample covers one '
                                   'city only.',
                              grade=92, feedback='Precise and well caveated.'),
                          'Write up an A/B test': Submit(
                              text='8.2% against 10.1% is a promising difference but the two-sided p-value is '
                                   'above 0.05, so I recommend running the test another week before '
                                   'shipping the new page.',
                              grade=95, feedback='Excellent: you reported the uncertainty honestly.')}),
          )),

    # -------------------------------------------------------------- just started
    Story('emma.johansson@example.com',
          enrol=(
              Enrol(JS, days=0.2, done=0),
              Enrol(SYSTEMS, days=0.1, done=0),
          )),
    Story('daniel.kim@example.com',
          bookmarks=(STATS, JS),
          enrol=(Enrol(PY, days=1, done=0),)),

    # ---------------------------------------------------------------- in progress
    Story('zainab.bello@example.com',
          enrol=(Enrol(PY, days=40, done=3, last=2, quiz={PY_QUIZ: [3]}),)),
    Story('lucas.rossi@example.com',
          enrol=(Enrol(JS, days=55, done=5, last=3, quiz={'Check: values and types': [4]}),)),
    Story('hannah.weiss@example.com',
          enrol=(
              Enrol(UX, days=75, done=7, last=2,
                    quiz={'Check: research basics': [4]},
                    work={'Interview and synthesis': Submit(
                        text='I interviewed my sister about booking trips. Insight: she distrusts price '
                             'comparison sites.',
                        grade=52,
                        feedback='One interview and one insight is not enough to build a problem statement. '
                                 'Interview a second person and try to find a pattern.')}),
          )),
    Story('omar.farouk@example.com',
          enrol=(Enrol(STATS, days=85, done=2, last=19),)),
    Story('ivan.petrov@example.com',
          enrol=(
              Enrol(JS, days=65, done=4, last=4, quiz={'Check: values and types': [3]}),
              Enrol(HTML, days=60, done=2, last=25),
          )),
    Story('nina.kowalski@example.com',
          bookmarks=(PM, SYSTEMS),
          enrol=(Enrol(UX, days=40, done=4, last=6, quiz={'Check: research basics': [3]}),)),
    Story('jonas.berg@example.com',
          enrol=(Enrol(STATS, days=50, done=5, last=0.5, quiz={'Check: describing data': [4]}),)),

    # --------------------------------------------------------- completed, offline
    Story('isabella.costa@example.com',
          enrol=(
              Enrol(JS, days=110, done=10, last=50, certificate=True,
                    quiz={'Check: values and types': [4], 'Check: the DOM': [3]},
                    work={'Build a to-do list in the console': Submit(
                              text='Tasks are objects with a title and a done flag; three functions add, '
                                   'complete and print them.',
                              grade=96, feedback='Exactly the structure we wanted.'),
                          'Interactive counter': Submit(
                              text='State is one number; the DOM is redrawn from it after each click.',
                              grade=93, feedback='Well explained.')}),
              Enrol(HTML, days=60, done=3, last=20, quiz={'Check: HTML basics': [2]}),
          )),

    # ----------------------------------------------------------------- browsing
    Story('ethan.walker@example.com', bookmarks=(PM, UX, ANALYTICS)),
)

BY_EMAIL = {story.email: story for story in STORIES}
