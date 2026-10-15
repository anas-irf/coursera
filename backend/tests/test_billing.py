"""Monetisation slice: checkout data, Stripe checkout session, webhook lifecycle,
session verification, subscription status / cancel.

Only *library* objects are patched (``stripe.checkout.Session.create`` /
``.retrieve``, ``stripe.Customer.retrieve``, ``stripe.Webhook.construct_event``);
nothing here refers to the application's payment modules, so the tests keep
working when the code is moved around.  The suite settings define
``STRIPE_WEBHOOK_SECRET`` so signature verification is exercised (mocked).
"""
import json
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import stripe
from django.conf import settings
from django.utils import timezone

import factories as f

pytestmark = pytest.mark.django_db

CHECKOUT_DATA = '/api/v1/billing/checkout/'
STRIPE_SESSION = '/api/v1/billing/checkout/session/'
WEBHOOK = '/api/payments/stripe/webhook/'
VERIFY_SESSION = '/api/v1/billing/checkout/verify/'
SUB_STATUS = '/api/v1/billing/subscription/'
SUB_CANCEL = '/api/v1/billing/subscription/cancel/'

StripeError = getattr(stripe, 'StripeError', None) or stripe.error.StripeError
SignatureVerificationError = (getattr(stripe, 'SignatureVerificationError', None)
                              or stripe.error.SignatureVerificationError)


class StripeObject(dict):
    """dict with attribute access - what the app sees from stripe.StripeObject."""
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


# --------------------------------------------------------------------------- #
# event builders
# --------------------------------------------------------------------------- #
def checkout_session(user, *, plan='monthly', amount_total=4999, payment_intent='pi_test_1',
                     session_id='cs_test_1', reference=True, payment_status='paid'):
    return StripeObject(
        id=session_id,
        client_reference_id=str(user.uuid) if reference else None,
        customer_email=user.email,
        amount_total=amount_total,
        payment_intent=payment_intent,
        payment_status=payment_status,
        metadata={'plan_id': plan, 'user_id': str(user.uuid), 'user_email': user.email},
    )


def event(event_type, obj):
    return {'id': 'evt_test_1', 'type': event_type, 'data': {'object': obj}}


def invoice(*, invoice_id='in_test_1', customer='cus_test_1', amount_paid=4999,
            amount_due=4999, attempt_count=1, payment_intent='pi_inv_1'):
    return {'id': invoice_id, 'subscription': 'sub_test_1', 'customer': customer,
            'amount_paid': amount_paid, 'amount_due': amount_due,
            'attempt_count': attempt_count, 'payment_intent': payment_intent}


def post_webhook(api, evt):
    """POST ``evt`` as a Stripe webhook; ``construct_event`` is patched."""
    with patch('stripe.Webhook.construct_event', return_value=evt) as construct:
        r = api.post(WEBHOOK, data=json.dumps(evt), content_type='application/json',
                     HTTP_STRIPE_SIGNATURE='t=1,v1=signature')
    return r, construct


def post_invoice_event(api, event_type, user, **invoice_kwargs):
    customer = SimpleNamespace(email=user.email)
    with patch('stripe.Customer.retrieve', return_value=customer) as retrieve:
        r, _ = post_webhook(api, event(event_type, invoice(**invoice_kwargs)))
    return r, retrieve


def call_arg(mock, position, *names):
    """Argument ``position`` of the mock's single call, whether it was passed
    positionally or as one of the keyword ``names``."""
    args, kwargs = mock.call_args.args, mock.call_args.kwargs
    if len(args) > position:
        return args[position]
    for name in names:
        if name in kwargs:
            return kwargs[name]
    raise AssertionError(f'argument {position}/{names} missing in {mock.call_args}')


def payments_of(user):
    sub = f.get_subscription(user)
    return f.StudentPlusPayment.objects.filter(subscription=sub) if sub else f.StudentPlusPayment.objects.none()


# --------------------------------------------------------------------------- #
# checkout data / plans
# --------------------------------------------------------------------------- #
def test_checkout_data_for_a_student_without_subscription(auth_client, student):
    """Checkout data shape; default monthly / yearly plans when the plan table is empty."""
    r = auth_client(student).get(CHECKOUT_DATA)

    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'student', 'subscription', 'plans', 'currency', 'savings',
                         'payment_methods'}
    assert body['student']['email'] == student.email
    assert body['subscription']['has_subscription'] is False
    assert body['subscription']['status'] == 'none'
    assert body['currency'] == 'USD'
    # no SubscriptionPlan rows -> the built-in default plans are returned
    assert [p['id'] for p in body['plans']] == ['monthly', 'yearly']
    assert {'name', 'price', 'billing_cycle', 'features'} <= set(body['plans'][0])
    assert {'yearly_savings_amount', 'yearly_savings_percentage'} <= set(body['savings'])


def test_checkout_data_reports_current_subscription_and_database_plans(auth_client, student):
    """Existing subscription is reported and DB plans replace the defaults."""
    f.give_plus(student, plan='yearly', days=365)
    plan = f.SubscriptionPlan.objects.create(name='DB plan', description='from the database',
                                             price=Decimal('19.99'), billing_cycle='monthly')

    body = auth_client(student).get(CHECKOUT_DATA).json()

    assert body['subscription']['has_subscription'] is True
    assert body['subscription']['is_active'] is True
    assert body['subscription']['type'] == 'yearly'
    assert [p['id'] for p in body['plans']] == [str(plan.uuid)]
    assert body['plans'][0]['price'] == pytest.approx(19.99)


def test_checkout_endpoints_are_student_only(api, auth_client, instructor):
    """Anonymous 401, instructors 403 on checkout data."""
    assert api.get(CHECKOUT_DATA).status_code == 401
    assert auth_client(instructor).get(CHECKOUT_DATA).status_code == 403


def test_checkout_data_lists_the_default_plans_when_none_is_configured(auth_client, student):
    """Without configured plans the checkout data offers the monthly and yearly defaults."""
    r = auth_client(student).get(CHECKOUT_DATA)

    assert r.status_code == 200
    assert r.json()['currency'] == 'USD'
    assert [p['billing_cycle'] for p in r.json()['plans']] == ['monthly', 'yearly']


# --------------------------------------------------------------------------- #
# Stripe checkout session
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize('plan, interval, amount', [('monthly', 'month', 4999),
                                                    ('yearly', 'year', 39999)])
def test_create_stripe_checkout_session(auth_client, student, plan, interval, amount):
    """A Stripe subscription session is created with the plan price / interval and the user metadata."""
    fake = SimpleNamespace(url='https://checkout.stripe.test/c/pay/cs_test_1', id='cs_test_1')

    with patch('stripe.checkout.Session.create', return_value=fake) as create:
        r = auth_client(student).post(STRIPE_SESSION, {'plan_id': plan}, format='json')

    assert r.status_code == 200
    assert r.json() == {'checkout_url': fake.url, 'session_id': 'cs_test_1'}
    create.assert_called_once()
    kwargs = create.call_args.kwargs
    assert kwargs['mode'] == 'subscription'
    assert kwargs['client_reference_id'] == str(student.uuid)
    assert kwargs['customer_email'] == student.email
    assert kwargs['metadata']['plan_id'] == plan
    price = kwargs['line_items'][0]['price_data']
    assert price['unit_amount'] == amount
    assert price['recurring'] == {'interval': interval}
    assert '{CHECKOUT_SESSION_ID}' in kwargs['success_url']
    assert kwargs['cancel_url']


def test_stripe_session_rejections_never_call_stripe(api, auth_client, student, instructor):
    """Non-students, missing / invalid plan and active subscribers never reach Stripe."""
    with patch('stripe.checkout.Session.create') as create:
        assert api.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json').status_code == 401
        r = auth_client(instructor).post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
        assert r.status_code == 403
        client = auth_client(student)
        assert client.post(STRIPE_SESSION, {}, format='json').status_code == 400  # plan required
        r = client.post(STRIPE_SESSION, {'plan_id': 'enterprise'}, format='json')
        assert r.status_code == 400
        assert 'error' in r.json()

        f.give_plus(student)
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
        assert r.status_code == 400  # already subscribed
        assert 'error' in r.json()

    create.assert_not_called()


def test_a_cancelled_member_can_start_a_new_checkout_once_the_paid_period_is_over(auth_client, student):
    """Only a subscription that still runs blocks a new checkout session; a cancelled one runs
    until the end of the period that was paid for."""
    f.give_plus(student, status='cancelled', days=-1)
    fake = SimpleNamespace(url='https://checkout.stripe.test/x', id='cs_again')

    with patch('stripe.checkout.Session.create', return_value=fake):
        r = auth_client(student).post(STRIPE_SESSION, {'plan_id': 'yearly'}, format='json')

    assert r.status_code == 200
    assert r.json()['session_id'] == 'cs_again'


def test_a_cancelled_member_who_is_still_paid_up_does_not_buy_twice(auth_client, student):
    f.give_plus(student, status='cancelled', days=10)

    with patch('stripe.checkout.Session.create') as create:
        r = auth_client(student).post(STRIPE_SESSION, {'plan_id': 'yearly'}, format='json')

    assert r.status_code == 400
    create.assert_not_called()


def test_stripe_errors_while_creating_a_session(auth_client, student):
    """StripeError -> 400, any other exception -> 500."""
    client = auth_client(student)

    with patch('stripe.checkout.Session.create', side_effect=StripeError('card network down')):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert r.status_code == 400
    assert r.json()['error']

    with patch('stripe.checkout.Session.create', side_effect=RuntimeError('unexpected')):
        r = client.post(STRIPE_SESSION, {'plan_id': 'monthly'}, format='json')
    assert r.status_code == 500
    assert 'error' in r.json()


# --------------------------------------------------------------------------- #
# webhook: checkout.session.completed
# --------------------------------------------------------------------------- #
def test_checkout_completed_creates_active_subscription_and_payment(api, auth_client, student):
    """checkout.session.completed creates an active subscription and a completed payment (signature verified with the secret)."""
    evt = event('checkout.session.completed', checkout_session(student))

    r, construct = post_webhook(api, evt)

    assert r.status_code == 200
    assert r.json() == {'status': 'success'}
    # the signature is verified against the configured secret
    construct.assert_called_once()
    assert json.loads(call_arg(construct, 0, 'payload')) == evt
    assert call_arg(construct, 1, 'sig_header') == 't=1,v1=signature'
    assert call_arg(construct, 2, 'secret') == settings.STRIPE_WEBHOOK_SECRET

    sub = f.get_subscription(student)
    assert sub is not None
    assert sub.status == 'active'
    assert sub.subscription_type == 'monthly'
    assert sub.payment_method == 'stripe'
    assert sub.is_active() is True
    assert timedelta(days=29) < sub.end_date - timezone.now() < timedelta(days=31)
    assert sub.next_billing_date is not None
    payment = payments_of(student).get()
    assert payment.amount == Decimal('49.99')
    assert payment.status == 'completed'
    assert payment.payment_method == 'stripe'
    assert payment.transaction_id == 'pi_test_1'

    # the subscription now shows up in the status endpoint
    status = auth_client(student).get(SUB_STATUS).json()
    assert status['has_subscription'] is True and status['status'] == 'active'
    assert status['is_active'] is True and status['can_access_plus_courses'] is True


def test_checkout_completed_for_the_yearly_plan(api, student):
    """Yearly plan: 365 day period and the yearly amount."""
    evt = event('checkout.session.completed',
                checkout_session(student, plan='yearly', amount_total=39999))

    r, _ = post_webhook(api, evt)

    assert r.status_code == 200
    sub = f.get_subscription(student)
    assert sub.subscription_type == 'yearly'
    assert timedelta(days=364) < sub.end_date - timezone.now() < timedelta(days=366)
    assert payments_of(student).get().amount == Decimal('399.99')


def test_checkout_completed_unlocks_plus_enrolment(api, auth_client, instructor, student):
    """After the webhook a Plus course can be enrolled in."""
    course = f.build_course(instructor, status='published', course_type='coursera_plus').course
    url = f'/api/v1/learning/courses/{course.uuid}/enroll/'
    assert auth_client(student).post(url).status_code == 402

    post_webhook(api, event('checkout.session.completed', checkout_session(student)))

    assert auth_client(student).post(url).status_code == 201


def test_checkout_completed_falls_back_to_the_customer_email(api, student):
    """Without client_reference_id the user is found by e-mail."""
    session = checkout_session(student, reference=False)

    r, _ = post_webhook(api, event('checkout.session.completed', session))

    assert r.status_code == 200
    assert f.get_subscription(student).status == 'active'


def test_checkout_completed_for_an_unknown_user_is_acknowledged_without_effects(api, student):
    """Unknown user: 200 and nothing is created."""
    session = checkout_session(student)
    session['client_reference_id'] = '00000000-0000-0000-0000-000000000000'
    session['customer_email'] = 'nobody@example.com'

    r, _ = post_webhook(api, event('checkout.session.completed', session))

    assert r.status_code == 200
    assert f.StudentPlusSubscription.objects.count() == 0


def test_a_second_checkout_for_an_active_subscriber_changes_nothing_but_the_payment_record(api, student):
    """The money was taken, so the payment is recorded; what is running is left alone."""
    first = event('checkout.session.completed', checkout_session(student, payment_intent='pi_a'))
    second = event('checkout.session.completed',
                   checkout_session(student, payment_intent='pi_b', session_id='cs_test_2'))

    post_webhook(api, first)
    post_webhook(api, second)

    assert f.StudentPlusSubscription.objects.filter(student=student).count() == 1
    assert sorted(p.transaction_id for p in payments_of(student)) == ['pi_a', 'pi_b']


def test_checkout_completed_reactivates_a_lapsed_subscription_for_the_new_period(api, student):
    """A lapsed subscription starts a new period of the plan that was bought, and a payment is added."""
    sub = f.give_plus(student, status='cancelled', plan='yearly', days=-3)
    evt = event('checkout.session.completed', checkout_session(student, plan='monthly'))

    r, _ = post_webhook(api, evt)

    assert r.status_code == 200
    sub.refresh_from_db()
    assert sub.status == 'active' and sub.auto_renew is True
    assert sub.subscription_type == 'monthly'
    assert timedelta(days=29) < sub.end_date - timezone.now() < timedelta(days=31)
    assert sub.next_billing_date == sub.end_date
    assert sub.is_active() is True
    assert payments_of(student).count() == 1


# --------------------------------------------------------------------------- #
# webhook: renewal / failure
# --------------------------------------------------------------------------- #
def test_invoice_payment_succeeded_renews_the_subscription(api, student):
    """invoice.payment_succeeded re-activates, moves the billing date and records a payment."""
    sub = f.give_plus(student, status='cancelled', days=1)  # lapsed, billing date tomorrow
    before_billing = sub.next_billing_date

    r, retrieve = post_invoice_event(api, 'invoice.payment_succeeded', student,
                                     invoice_id='in_renew_1', amount_paid=4999,
                                     payment_intent='pi_renew_1')

    assert r.status_code == 200
    retrieve.assert_called_once()
    assert call_arg(retrieve, 0, 'id') == 'cus_test_1'
    sub.refresh_from_db()
    assert sub.status == 'active'
    assert sub.last_payment_date > timezone.now() - timedelta(minutes=1)
    assert sub.next_billing_date > before_billing
    assert timedelta(days=29) < sub.next_billing_date - timezone.now() < timedelta(days=31)
    payment = payments_of(student).get()
    assert payment.status == 'completed'
    assert payment.amount == Decimal('49.99')
    assert payment.transaction_id == 'pi_renew_1'


def test_a_renewal_moves_the_end_date_with_the_billing_date(api, student):
    """The end date decides ``is_active()``: a member who keeps paying must not lose Plus when
    the first period ends."""
    sub = f.give_plus(student, days=2)

    r, _ = post_invoice_event(api, 'invoice.payment_succeeded', student, invoice_id='in_renew_2')

    assert r.status_code == 200
    sub.refresh_from_db()
    assert sub.end_date - timezone.now() > timedelta(days=29)
    assert sub.end_date == sub.next_billing_date
    assert sub.is_active() is True


def test_a_renewal_takes_the_period_end_stripe_reports(api, student):
    f.give_plus(student, days=2)
    paid_until = timezone.now() + timedelta(days=31, hours=3)
    evt = event('invoice.payment_succeeded', {
        **invoice(invoice_id='in_period_1', payment_intent='pi_period_1'),
        'lines': {'data': [{'period': {'end': int(paid_until.timestamp())}}]}})

    with patch('stripe.Customer.retrieve', return_value=SimpleNamespace(email=student.email)):
        post_webhook(api, evt)

    sub = f.get_subscription(student)
    assert abs(sub.end_date - paid_until) < timedelta(seconds=2)
    assert sub.next_billing_date == sub.end_date


def test_a_renewal_is_applied_once_however_often_stripe_delivers_it(api, student):
    f.give_plus(student, days=2)

    post_invoice_event(api, 'invoice.payment_succeeded', student, invoice_id='in_dup_1',
                       payment_intent='pi_dup_1')
    first_end = f.get_subscription(student).end_date
    post_invoice_event(api, 'invoice.payment_succeeded', student, invoice_id='in_dup_1',
                       payment_intent='pi_dup_1')

    assert payments_of(student).count() == 1
    assert f.get_subscription(student).end_date == first_end
    assert f.Notification.objects.filter(recipient=student).count() == 1


def test_the_first_payment_of_a_subscription_is_not_counted_twice(api, student):
    """checkout.session.completed and invoice.payment_succeeded (billing_reason ``subscription_create``)
    describe the same payment."""
    post_webhook(api, event('checkout.session.completed', checkout_session(student)))
    first_invoice = event('invoice.payment_succeeded', {
        **invoice(invoice_id='in_first', payment_intent='pi_first'),
        'billing_reason': 'subscription_create'})

    with patch('stripe.Customer.retrieve', return_value=SimpleNamespace(email=student.email)):
        r, _ = post_webhook(api, first_invoice)

    assert r.status_code == 200
    assert payments_of(student).count() == 1


def test_invoice_payment_failed_first_attempt_keeps_subscription_active(api, student):
    """First failure: failed payment row, subscription stays active."""
    sub = f.give_plus(student)

    r, _ = post_invoice_event(api, 'invoice.payment_failed', student, invoice_id='in_fail_1',
                              amount_due=4999, attempt_count=1)

    assert r.status_code == 200
    sub.refresh_from_db()
    assert sub.status == 'active'
    payment = payments_of(student).get()
    assert payment.status == 'failed'
    assert payment.amount == Decimal('49.99')
    assert payment.transaction_id == 'in_fail_1:1'


def test_invoice_payment_failed_third_attempt_suspends_subscription(api, student):
    """Third failure: the subscription becomes ``suspended``."""
    sub = f.give_plus(student)

    r, _ = post_invoice_event(api, 'invoice.payment_failed', student, invoice_id='in_fail_3',
                              attempt_count=3)

    assert r.status_code == 200
    sub.refresh_from_db()
    assert sub.status == 'suspended'
    assert sub.is_active() is False
    assert payments_of(student).get().status == 'failed'


def test_an_invoice_that_fails_three_times_suspends_the_subscription(api, student):
    """The same invoice id comes back with every retry: each attempt is its own record
    (the id used to collide, so the third failure never suspended anything)."""
    sub = f.give_plus(student)

    for attempt in (1, 2, 3):
        r, _ = post_invoice_event(api, 'invoice.payment_failed', student,
                                  invoice_id='in_same_invoice', attempt_count=attempt)
        assert r.status_code == 200
        sub.refresh_from_db()
        assert sub.status == ('suspended' if attempt == 3 else 'active')

    assert payments_of(student).filter(status='failed').count() == 3
    # the same attempt delivered again changes nothing
    post_invoice_event(api, 'invoice.payment_failed', student, invoice_id='in_same_invoice',
                       attempt_count=3)
    assert payments_of(student).filter(status='failed').count() == 3


def test_invoice_events_for_unknown_customers_are_acknowledged(api, student):
    # no subscription exists for this user
    """Invoice events without a matching subscription are acknowledged and ignored."""
    r, _ = post_invoice_event(api, 'invoice.payment_succeeded', student)
    assert r.status_code == 200
    assert f.StudentPlusPayment.objects.count() == 0

    r, _ = post_invoice_event(api, 'invoice.payment_failed', student)
    assert r.status_code == 200
    assert f.StudentPlusPayment.objects.count() == 0


def test_stripe_lifecycle_events_create_notifications(api, student):
    """Activation, renewal and a failed payment notify the student (and the
    superusers on activation).  They used to be lost because the handlers passed
    a wrong keyword to ``Notification``; fixed in refactor step S3."""
    admin = f.make_user('admin', email='root@example.com')
    admin.is_superuser = True
    admin.save()

    post_webhook(api, event('checkout.session.completed', checkout_session(student)))

    activated = f.Notification.objects.filter(recipient=student)
    assert [n.notification_type for n in activated] == ['payment_success']
    assert 'Welcome to Coursera Plus' in activated[0].title
    (for_admin,) = f.Notification.objects.filter(recipient=admin)
    assert for_admin.notification_type == 'system'
    assert student.email in for_admin.message

    post_invoice_event(api, 'invoice.payment_succeeded', student, invoice_id='in_n1')
    post_invoice_event(api, 'invoice.payment_failed', student, invoice_id='in_n2', attempt_count=2)

    types = sorted(n.notification_type for n in f.Notification.objects.filter(recipient=student))
    assert types == ['payment_failed', 'payment_success', 'payment_success']
    titles = ' | '.join(n.title for n in f.Notification.objects.filter(recipient=student))
    assert 'Subscription Renewed' in titles
    assert 'Payment Retry Failed' in titles


def test_suspension_notifies_the_student_and_the_superusers(api, student):
    admin = f.make_user('admin', email='root2@example.com')
    admin.is_superuser = True
    admin.save()
    f.give_plus(student)

    post_invoice_event(api, 'invoice.payment_failed', student, invoice_id='in_n3', attempt_count=3)

    assert f.get_subscription(student).status == 'suspended'
    assert any('Subscription Suspended' in n.title for n in f.Notification.objects.filter(recipient=student))
    assert any('suspended' in n.message for n in f.Notification.objects.filter(recipient=admin))


# --------------------------------------------------------------------------- #
# webhook: error handling
# --------------------------------------------------------------------------- #
def test_webhook_rejects_bad_signature_and_bad_payload(api, student):
    """Signature errors and invalid payloads are 400s."""
    with patch('stripe.Webhook.construct_event',
               side_effect=SignatureVerificationError('bad signature', 'sig_header')):
        r = api.post(WEBHOOK, data='{}', content_type='application/json',
                     HTTP_STRIPE_SIGNATURE='nonsense')
    assert r.status_code == 400
    assert r.json() == {'error': 'Invalid signature'}

    with patch('stripe.Webhook.construct_event', side_effect=ValueError('not json')):
        r = api.post(WEBHOOK, data='not json', content_type='application/json',
                     HTTP_STRIPE_SIGNATURE='nonsense')
    assert r.status_code == 400
    assert r.json() == {'error': 'Invalid payload'}

    assert f.StudentPlusSubscription.objects.count() == 0


def test_a_webhook_without_a_secret_is_refused_and_never_parsed(api, student, settings):
    """With ``STRIPE_WEBHOOK_SECRET`` empty an unsigned body used to be trusted as it came: anyone
    could have activated a subscription.  Now there is nothing to verify against, so it is a 503."""
    settings.STRIPE_WEBHOOK_SECRET = ''
    evt = event('checkout.session.completed', dict(checkout_session(student)))

    with patch('stripe.Webhook.construct_event') as construct:
        r = api.post(WEBHOOK, data=json.dumps(evt), content_type='application/json')

    assert r.status_code == 503
    assert r.json() == {'error': 'Webhook is not configured'}
    construct.assert_not_called()
    assert f.get_subscription(student) is None


def test_a_handler_that_fails_makes_the_webhook_fail_so_stripe_sends_it_again(api, student):
    f.give_plus(student)
    evt = event('invoice.payment_failed', invoice(invoice_id='in_boom', attempt_count=1))

    with patch('stripe.Customer.retrieve', side_effect=StripeError('stripe is down')):
        r, _ = post_webhook(api, evt)

    assert r.status_code == 500
    assert payments_of(student).count() == 0


def test_a_signed_event_without_a_type_is_ignored_and_not_a_500(api):
    r, _ = post_webhook(api, {'id': 'evt_odd', 'data': {'object': {}}})

    assert r.status_code == 200


def test_webhook_acknowledges_unhandled_event_types(api):
    """Unknown event types are acknowledged with 200."""
    r, _ = post_webhook(api, event('customer.created', {'id': 'cus_1'}))

    assert r.status_code == 200
    assert r.json() == {'status': 'success'}


def test_webhook_needs_no_authentication(api):
    # ``api`` is anonymous: no Authorization header at all
    """The webhook is public."""
    r, _ = post_webhook(api, event('customer.created', {'id': 'cus_1'}))

    assert r.status_code == 200


# --------------------------------------------------------------------------- #
# verify-session
# --------------------------------------------------------------------------- #
def test_verify_session_creates_subscription_when_the_session_is_paid(auth_client, student):
    """verify-session retrieves the session and creates the subscription when it is paid."""
    session = checkout_session(student, plan='yearly', amount_total=39999, payment_intent='pi_v1')

    with patch('stripe.checkout.Session.retrieve', return_value=session) as retrieve:
        r = auth_client(student).post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')

    assert r.status_code == 200
    assert r.json() == {'message': 'Subscription created successfully', 'has_subscription': True}
    retrieve.assert_called_once()
    assert call_arg(retrieve, 0, 'id', 'session_id') == 'cs_test_1'
    sub = f.get_subscription(student)
    assert sub.status == 'active' and sub.subscription_type == 'yearly'
    assert payments_of(student).get().transaction_id == 'pi_v1'


def test_verify_session_with_unpaid_session_changes_nothing(auth_client, student):
    """An unpaid session returns has_subscription false."""
    session = checkout_session(student, payment_status='unpaid')

    with patch('stripe.checkout.Session.retrieve', return_value=session):
        r = auth_client(student).post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert body['has_subscription'] is False
    assert body['payment_status'] == 'unpaid'
    assert f.get_subscription(student) is None


def test_verify_session_with_existing_subscription_does_not_call_stripe(auth_client, student):
    """An existing subscription short-circuits the Stripe call."""
    f.give_plus(student)

    with patch('stripe.checkout.Session.retrieve') as retrieve:
        r = auth_client(student).post(VERIFY_SESSION, {'session_id': 'cs_test_1'}, format='json')

    assert r.status_code == 200
    body = r.json()
    assert body['has_subscription'] is True
    assert body['subscription']['is_active'] is True
    retrieve.assert_not_called()


def test_verify_session_validation_and_stripe_errors(api, auth_client, student, instructor):
    """Anonymous 401, non-student 403, missing id 400, Stripe error 400."""
    assert api.post(VERIFY_SESSION, {'session_id': 'x'}, format='json').status_code == 401
    assert auth_client(instructor).post(VERIFY_SESSION, {'session_id': 'x'},
                                        format='json').status_code == 403
    assert auth_client(student).post(VERIFY_SESSION, {}, format='json').status_code == 400

    with patch('stripe.checkout.Session.retrieve', side_effect=StripeError('no such session')):
        r = auth_client(student).post(VERIFY_SESSION, {'session_id': 'cs_missing'}, format='json')
    assert r.status_code == 400
    assert r.json()['error']


# --------------------------------------------------------------------------- #
# subscription status / cancel (accounts endpoints)
# --------------------------------------------------------------------------- #
STATUS_KEYS = {'has_subscription', 'status', 'subscription_type', 'is_active',
               'can_access_plus_courses', 'start_date', 'end_date', 'auto_renew',
               'next_billing_date'}


def test_subscription_status_without_and_with_subscription(auth_client, student):
    """Status payload has a fixed key set with and without a subscription."""
    client = auth_client(student)

    body = client.get(SUB_STATUS).json()
    assert set(body) == STATUS_KEYS
    assert body['has_subscription'] is False
    assert body['status'] == 'none'
    assert body['is_active'] is False and body['can_access_plus_courses'] is False

    f.give_plus(student, plan='yearly', days=365)
    body = client.get(SUB_STATUS).json()
    assert set(body) == STATUS_KEYS
    assert body['has_subscription'] is True
    assert body['subscription_type'] == 'yearly'
    assert body['status'] == 'active' and body['is_active'] is True
    assert body['auto_renew'] is True


def test_subscription_status_is_student_only(api, auth_client, instructor):
    """Anonymous 401, non-students 403."""
    assert api.get(SUB_STATUS).status_code == 401
    r = auth_client(instructor).get(SUB_STATUS)
    assert r.status_code == 403
    assert 'detail' in r.json()


def test_cancel_subscription_stops_the_renewal_and_keeps_the_period_that_was_paid(
        auth_client, instructor, student):
    """Cancelling sets status cancelled / auto_renew false; Plus works until the end date."""
    sub = f.give_plus(student)
    plus_course = f.build_course(instructor, status='published', course_type='coursera_plus').course
    client = auth_client(student)

    r = client.post(SUB_CANCEL)

    assert r.status_code == 200
    assert r.json()['message'] == 'Subscription cancelled successfully'
    assert r.json()['status'] == 'cancelled'
    assert r.json()['access_until'] == f.get_subscription(student).end_date.isoformat()
    sub = f.reload(sub)
    assert sub.status == 'cancelled' and sub.auto_renew is False
    body = client.get(SUB_STATUS).json()
    assert body['status'] == 'cancelled' and body['auto_renew'] is False
    assert body['is_active'] is True and body['can_access_plus_courses'] is True
    assert client.post(f'/api/v1/learning/courses/{plus_course.uuid}/enroll/').status_code == 201

    # once the paid period is over the access ends
    f.StudentPlusSubscription.objects.filter(pk=sub.pk).update(end_date=timezone.now() - timedelta(days=1))
    assert client.get(SUB_STATUS).json()['is_active'] is False


def test_cancelling_a_subscription_cancels_it_at_stripe_at_the_period_end(auth_client, student):
    sub = f.give_plus(student)
    f.StudentPlusSubscription.objects.filter(pk=sub.pk).update(stripe_subscription_id='sub_live_1')

    with patch('stripe.Subscription.modify') as modify:
        r = auth_client(student).post(SUB_CANCEL)

    assert r.status_code == 200
    modify.assert_called_once_with('sub_live_1', cancel_at_period_end=True)


def test_stripe_refusing_the_cancellation_leaves_the_subscription_as_it_was(auth_client, student):
    sub = f.give_plus(student)
    f.StudentPlusSubscription.objects.filter(pk=sub.pk).update(stripe_subscription_id='sub_live_2')

    with patch('stripe.Subscription.modify', side_effect=StripeError('SECRET-DETAIL')):
        r = auth_client(student).post(SUB_CANCEL)

    assert r.status_code == 400
    assert 'SECRET-DETAIL' not in r.content.decode()
    assert f.reload(sub).status == 'active'


def test_cancelling_twice_is_harmless(auth_client, student):
    f.give_plus(student)
    client = auth_client(student)

    assert client.post(SUB_CANCEL).status_code == 200
    assert client.post(SUB_CANCEL).status_code == 200


def test_stripe_ending_a_subscription_is_mirrored(api, student):
    sub = f.give_plus(student)
    f.StudentPlusSubscription.objects.filter(pk=sub.pk).update(
        stripe_subscription_id='sub_live_3', stripe_customer_id='cus_live_3')

    post_webhook(api, event('customer.subscription.updated', {
        'id': 'sub_live_3', 'customer': 'cus_live_3', 'cancel_at_period_end': True}))
    sub = f.reload(sub)
    assert sub.status == 'cancelled' and sub.auto_renew is False and sub.is_active() is True

    post_webhook(api, event('customer.subscription.updated', {
        'id': 'sub_live_3', 'customer': 'cus_live_3', 'cancel_at_period_end': False}))
    assert f.reload(sub).status == 'active' and f.reload(sub).auto_renew is True

    post_webhook(api, event('customer.subscription.deleted', {
        'id': 'sub_live_3', 'customer': 'cus_live_3'}))
    sub = f.reload(sub)
    assert sub.status == 'expired' and sub.auto_renew is False and sub.is_active() is False


def test_cancel_without_subscription_is_a_404(auth_client, student):
    """There is nothing to cancel: 404 with a readable message (used to be a 500)."""
    r = auth_client(student).post(SUB_CANCEL)

    assert r.status_code == 404
    assert r.json() == {'error': 'No active subscription found'}
