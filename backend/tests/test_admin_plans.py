"""The administrator's plan settings: the name, wording and price of the Coursera Plus plans."""
from decimal import Decimal

import pytest

import factories as f

pytestmark = pytest.mark.django_db

PLANS = '/api/v1/billing/admin/plans/'
CHECKOUT = '/api/v1/billing/checkout/'


def plan_url(cycle):
    return f'{PLANS}{cycle}/'


def test_a_fresh_platform_sells_the_built_in_plans(auth_client, admin):
    rows = auth_client(admin).get(PLANS).json()

    assert rows == [
        {'cycle': 'monthly', 'name': 'Coursera Plus Monthly',
         'description': 'Access to all Plus courses with monthly billing', 'price': 49.99,
         'configured': False, 'members': 0},
        {'cycle': 'yearly', 'name': 'Coursera Plus Annual',
         'description': 'Access to all Plus courses with annual billing (Save 20%)', 'price': 399.99,
         'configured': False, 'members': 0},
    ]


def test_the_members_of_each_plan_are_counted(auth_client, admin):
    f.give_plus(f.make_student(), plan='monthly')
    f.give_plus(f.make_student(), plan='yearly', days=365)
    f.give_plus(f.make_student(), plan='monthly', status='expired', days=-3)   # no longer a member

    rows = auth_client(admin).get(PLANS).json()

    assert [row['members'] for row in rows] == [1, 1]


def test_changing_a_price_changes_what_new_checkouts_offer(auth_client, admin, student):
    r = auth_client(admin).put(plan_url('monthly'), {
        'name': 'Plus Monthly', 'description': 'Every Plus course, billed monthly', 'price': '39.99'},
        format='json')

    assert r.status_code == 200
    assert r.json() == {'cycle': 'monthly', 'name': 'Plus Monthly', 'description': 'Every Plus course, billed monthly',
                        'price': 39.99, 'configured': True, 'members': 0}
    offered = auth_client(student).get(CHECKOUT).json()['plans']
    # the other plan was written down too, so it is still on sale
    assert [(plan['billing_cycle'], plan['price']) for plan in offered] == [('monthly', 39.99), ('yearly', 399.99)]
    assert [row['configured'] for row in auth_client(admin).get(PLANS).json()] == [True, True]


def test_a_configured_plan_is_changed_in_place(auth_client, admin):
    plan = f.SubscriptionPlan.objects.create(name='Old', description='x', price=Decimal('10.00'),
                                             billing_cycle='yearly')
    f.SubscriptionPlan.objects.create(name='Monthly', description='x', price=Decimal('9.00'), billing_cycle='monthly')

    auth_client(admin).put(plan_url('yearly'), {'name': 'New', 'description': '', 'price': 99}, format='json')

    plan = f.reload(plan)
    assert (plan.name, plan.description, plan.price) == ('New', '', Decimal('99.00'))
    assert f.SubscriptionPlan.objects.count() == 2


@pytest.mark.parametrize('body,field', [
    ({'name': '', 'description': '', 'price': 10}, 'name'),
    ({'name': 'x' * 101, 'description': '', 'price': 10}, 'name'),
    ({'name': 'Plan', 'description': 'x' * 501, 'price': 10}, 'description'),
    ({'name': 'Plan', 'description': '', 'price': 0}, 'price'),
    ({'name': 'Plan', 'description': '', 'price': '10000'}, 'price'),
    ({'name': 'Plan', 'description': '', 'price': '9.999'}, 'price'),
    ({'name': 'Plan', 'description': ''}, 'price'),
])
def test_a_bad_plan_is_a_field_error_and_changes_nothing(auth_client, admin, body, field):
    r = auth_client(admin).put(plan_url('monthly'), body, format='json')

    assert r.status_code == 400 and field in r.json()
    assert not f.SubscriptionPlan.objects.exists()


def test_a_cycle_that_is_not_sold_is_a_404(auth_client, admin):
    r = auth_client(admin).put(plan_url('weekly'), {'name': 'Plan', 'description': '', 'price': 1}, format='json')

    assert r.status_code == 404
    assert auth_client(admin).put(plan_url('monthly'), ['x'], format='json').status_code == 400


def test_only_admins_see_and_change_the_plans(api, auth_client, student, instructor):
    for client in (auth_client(student), auth_client(instructor)):
        assert client.get(PLANS).status_code == 403
        assert client.put(plan_url('monthly'), {'name': 'Free', 'description': '', 'price': 1},
                          format='json').status_code == 403
    assert api.get(PLANS).status_code == 401


def test_the_service_refuses_a_cycle_that_is_not_sold_whoever_calls_it():
    from apps.billing.services import pricing
    from apps.core.api.errors import NotFound

    with pytest.raises(NotFound):
        pricing.update_plan('weekly', name='Plan', description='', price=Decimal('1.00'))
    assert not f.SubscriptionPlan.objects.exists()
