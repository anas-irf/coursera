# payments/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Sum, Avg
from django.utils import timezone
from django.conf import settings
from decimal import Decimal
from datetime import datetime, timedelta
import secrets
import stripe

from .models import InstructorEarning, SubscriptionPlan
from enrollments.models import Enrollment
from accounts.models import User, StudentPlusSubscription, StudentPlusPayment

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_earnings(request):
    """Get instructor earnings based on Coursera model"""
    
    try:
        if request.user.user_type != 'instructor':
            return Response({'error': 'Not an instructor'}, status=403)
        
        instructor = request.user
        
        # Get earnings summary (from revenue sharing)
        total_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            is_paid=True
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
        
        pending_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            is_paid=False
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
        
        # This month's earnings
        current_month = timezone.now().date().replace(day=1)
        monthly_earnings = InstructorEarning.objects.filter(
            instructor=instructor,
            month=current_month
        ).aggregate(Sum('final_amount'))['final_amount__sum'] or Decimal('0')
        
        # Performance metrics
        current_month_data = InstructorEarning.objects.filter(
            instructor=instructor,
            month=current_month
        ).aggregate(
            total_enrollments=Sum('enrollments_count'),
            total_completions=Sum('completions_count'),
            avg_engagement=Avg('engagement_score')
        )
        
        # Recent transactions (simulated from enrollment data for frontend compatibility)
        try:
            recent_enrollments = Enrollment.objects.filter(
                course__instructor=instructor
            ).select_related('student', 'course').order_by('-enrolled_date')[:10]
        except Exception as e:
            recent_enrollments = []
        
        recent_transactions = []
        for enrollment in recent_enrollments:
            # Simulate transaction based on course type and enrollment
            amount = 49.99  # Default amount for Coursera Plus revenue share
            if hasattr(enrollment.course, 'level') and enrollment.course.level == 'advanced':
                amount = 59.99
            elif hasattr(enrollment.course, 'level') and enrollment.course.level == 'beginner':
                amount = 39.99
            
            recent_transactions.append({
                'date': enrollment.enrolled_date.date().isoformat(),
                'course': enrollment.course.title,
                'student_email': enrollment.student.email,
                'amount': amount,
                'status': 'Paid'  # Coursera Plus subscriptions are pre-paid
            })
        
        # Monthly chart data (last 6 months) 
        current_date = timezone.now().date()
        monthly_chart = []
        
        for i in range(6):
            # Calculate months back (approximate with 30 days)
            month_start = current_date - timedelta(days=30*(5-i))
            month_start = month_start.replace(day=1)
            
            month_earnings = InstructorEarning.objects.filter(
                instructor=instructor,
                month=month_start
            ).aggregate(Sum('final_amount'))['final_amount__sum'] or 0
            
            monthly_chart.append({
                'month': month_start.strftime('%b'),
                'earnings': float(month_earnings)
            })
        
        # Recent earnings by course
        recent_earnings = InstructorEarning.objects.filter(
            instructor=instructor
        ).select_related('course').order_by('-month')[:12]
        
        earnings_data = []
        for earning in recent_earnings:
            earnings_data.append({
                'id': str(earning.uuid),
                'month': earning.month.strftime('%B %Y'),
                'course': earning.course.title,
                'enrollments': earning.enrollments_count,
                'completions': earning.completions_count,
                'engagement_score': float(earning.engagement_score),
                'amount': float(earning.final_amount),
                'multiplier': float(earning.performance_multiplier),
                'status': 'Paid' if earning.is_paid else 'Pending'
            })
        
        return Response({
            'summary': {
                'total_earnings': float(total_earnings),
                'pending_earnings': float(pending_earnings),
                'monthly_earnings': float(monthly_earnings),
                'platform_fee_rate': 30  # Frontend expects this field
            },
            'recent_transactions': recent_transactions,  # Frontend expects this field
            'monthly_chart': monthly_chart,  # Frontend expects this field
            'performance': {
                'monthly_enrollments': current_month_data['total_enrollments'] or 0,
                'monthly_completions': current_month_data['total_completions'] or 0,
                'engagement_score': float(current_month_data['avg_engagement'] or 0),
            },
            'recent_earnings': earnings_data,
            'earnings_model': {
                'description': 'Earnings are calculated based on student enrollments, course completions, and engagement metrics',
                'factors': [
                    'Number of enrollments in Coursera Plus courses',
                    'Course completion rate',
                    'Total watch time',
                    'Student engagement score'
                ]
            }
        })
    
    except Exception as e:
        # Return safe fallback data if there are any errors
        return Response({
            'summary': {
                'total_earnings': 0,
                'pending_earnings': 0,
                'monthly_earnings': 0,
                'platform_fee_rate': 30
            },
            'recent_transactions': [],
            'monthly_chart': [
                {'month': 'Jan', 'earnings': 0},
                {'month': 'Feb', 'earnings': 0},
                {'month': 'Mar', 'earnings': 0},
                {'month': 'Apr', 'earnings': 0},
                {'month': 'May', 'earnings': 0},
                {'month': 'Jun', 'earnings': 0}
            ],
            'performance': {
                'monthly_enrollments': 0,
                'monthly_completions': 0,
                'engagement_score': 0,
            },
            'recent_earnings': [],
            'earnings_model': {
                'description': 'Earnings are calculated based on student enrollments, course completions, and engagement metrics',
                'factors': [
                    'Number of enrollments in Coursera Plus courses',
                    'Course completion rate', 
                    'Total watch time',
                    'Student engagement score'
                ]
            },
            'error': str(e) if request.user.is_staff else 'Unable to load earnings data'
        })

# Helper function to get subscription plans data
def get_subscription_plans_data():
    """Get subscription plans data (helper function)"""
    # Get active subscription plans
    plans = SubscriptionPlan.objects.filter(is_active=True)
    print(f"Found {plans.count()} active subscription plans in database")

    plans_data = []
    for plan in plans:
        plans_data.append({
            'id': str(plan.uuid),
            'name': plan.name,
            'description': plan.description,
            'price': float(plan.price),
            'billing_cycle': plan.billing_cycle,
            'billing_cycle_display': plan.get_billing_cycle_display(),
            'features': {
                'unlimited_courses': plan.unlimited_courses,
                'certificate_included': plan.certificate_included,
                'download_enabled': plan.download_enabled
            }
        })

    # If no plans exist, create default ones
    if not plans_data:
        print("No plans found in database, using default plans")
        default_plans = [
            {
                'id': 'monthly',
                'name': 'Coursera Plus Monthly',
                'description': 'Access to all Plus courses with monthly billing',
                'price': 49.99,
                'billing_cycle': 'monthly',
                'billing_cycle_display': 'Monthly',
                'features': {
                    'unlimited_courses': True,
                    'certificate_included': True,
                    'download_enabled': True
                }
            },
            {
                'id': 'yearly',
                'name': 'Coursera Plus Annual',
                'description': 'Access to all Plus courses with annual billing (Save 20%)',
                'price': 399.99,
                'billing_cycle': 'yearly',
                'billing_cycle_display': 'Yearly',
                'features': {
                    'unlimited_courses': True,
                    'certificate_included': True,
                    'download_enabled': True
                }
            }
        ]
        plans_data = default_plans

    return {
        'plans': plans_data,
        'currency': 'USD'
    }

# Subscription Checkout Views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_subscription_plans(request):
    """Get available subscription plans for checkout"""

    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can view subscription plans'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Use helper function to get plans data
    plans_data = get_subscription_plans_data()
    return Response(plans_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def checkout_page_data(request):
    """Get data needed for checkout page"""

    print(f"Checkout data request from user: {request.user.email} (ID: {request.user.id})")

    if request.user.user_type != 'student':
        print(f"User {request.user.email} is not a student, user_type: {request.user.user_type}")
        return Response(
            {'error': 'Only students can access checkout'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check current subscription status
    try:
        subscription = StudentPlusSubscription.objects.get(student=request.user)
        current_subscription = {
            'has_subscription': True,
            'type': subscription.subscription_type,
            'status': subscription.status,
            'is_active': subscription.is_active(),
            'end_date': subscription.end_date.isoformat() if subscription.end_date else None
        }
        print(f"User {request.user.email} has subscription: {subscription.subscription_type}, status: {subscription.status}")
    except StudentPlusSubscription.DoesNotExist:
        current_subscription = {
            'has_subscription': False,
            'type': None,
            'status': 'none',
            'is_active': False,
            'end_date': None
        }
        print(f"User {request.user.email} has no subscription")

    # Get available plans
    plans_data = get_subscription_plans_data()

    # Get student info
    student_info = {
        'name': f"{request.user.first_name} {request.user.last_name}".strip(),
        'email': request.user.email,
        'user_type': request.user.user_type
    }

    # Calculate savings for annual plan
    monthly_price = 49.99
    yearly_price = 399.99
    yearly_savings = (monthly_price * 12) - yearly_price
    yearly_savings_percentage = round((yearly_savings / (monthly_price * 12)) * 100)

    response_data = {
        'student': student_info,
        'subscription': current_subscription,
        'plans': plans_data['plans'],
        'currency': plans_data['currency'],
        'savings': {
            'yearly_savings_amount': yearly_savings,
            'yearly_savings_percentage': yearly_savings_percentage
        },
        'payment_methods': [
            {'id': 'card', 'name': 'Credit/Debit Card', 'icon': 'credit-card'},
            {'id': 'paypal', 'name': 'PayPal', 'icon': 'paypal'}
        ]
    }

    print(f"Checkout data response for {request.user.email}: {len(response_data['plans'])} plans available")
    return Response(response_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_stripe_checkout_session(request):
    """Create a Stripe checkout session for subscription payment"""

    if request.user.user_type != 'student':
        return Response(
            {'error': 'Only students can create checkout sessions'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Check if user already has active subscription
    try:
        existing_subscription = StudentPlusSubscription.objects.get(student=request.user)
        if existing_subscription.is_active():
            return Response(
                {'error': 'You already have an active subscription'},
                status=status.HTTP_400_BAD_REQUEST
            )
    except StudentPlusSubscription.DoesNotExist:
        pass

    try:
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response(
                {'error': 'Plan ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get plan details
        plan_details = None
        default_plans = {
            'monthly': {
                'name': 'Coursera Plus Monthly',
                'price': 4999,  # $49.99 in cents
                'billing_cycle': 'monthly',
                'interval': 'month'
            },
            'yearly': {
                'name': 'Coursera Plus Annual',
                'price': 39999,  # $399.99 in cents
                'billing_cycle': 'yearly',
                'interval': 'year'
            }
        }

        if plan_id in default_plans:
            plan_details = default_plans[plan_id]
        else:
            return Response(
                {'error': 'Invalid plan selected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan_details['name'],
                        'description': f'Access to all Coursera Plus courses - {plan_details["billing_cycle"]} subscription',
                    },
                    'unit_amount': plan_details['price'],
                    'recurring': {
                        'interval': plan_details['interval'],
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url='http://localhost:3000/student/dashboard?success=true&plan=' + plan_id + '&session_id={CHECKOUT_SESSION_ID}',
            cancel_url='http://localhost:3000/student/checkout?cancelled=true',
            client_reference_id=str(request.user.uuid),
            customer_email=request.user.email,
            metadata={
                'user_id': str(request.user.uuid),
                'plan_id': plan_id,
                'user_email': request.user.email,
            }
        )

        return Response({
            'checkout_url': checkout_session.url,
            'session_id': checkout_session.id
        })

    except stripe.error.StripeError as e:
        return Response(
            {'error': f'Stripe error: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to create checkout session: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([])  # Webhook doesn't need authentication
def stripe_webhook(request):
    """Handle Stripe webhook events"""

    print("="*50)
    print("STRIPE WEBHOOK RECEIVED")
    print(f"Headers: {dict(request.META)}")
    print(f"Body length: {len(request.body)}")
    print("="*50)

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        # For development, skip signature verification if no secret is set
        if endpoint_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        else:
            # For testing without webhook secret
            import json
            event = json.loads(payload)

        print(f"✅ Received Stripe webhook event: {event['type']}")
        print(f"Event ID: {event.get('id')}")

        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            print(f"Processing checkout session: {session.get('id')}")
            handle_successful_payment(session)

        elif event['type'] == 'invoice.payment_succeeded':
            invoice = event['data']['object']
            handle_subscription_renewal(invoice)

        elif event['type'] == 'invoice.payment_failed':
            invoice = event['data']['object']
            handle_payment_failed(invoice)

        else:
            print(f"ℹ️ Unhandled event type: {event['type']}")

        return Response({'status': 'success'})

    except ValueError as e:
        print(f"❌ Invalid payload: {e}")
        return Response({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError as e:
        print(f"❌ Invalid signature: {e}")
        return Response({'error': 'Invalid signature'}, status=400)
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': str(e)}, status=500)

def handle_successful_payment(session):
    """Handle successful payment from Stripe checkout"""

    print(f"🔄 Starting handle_successful_payment")
    print(f"Session data: {session}")

    try:
        user_id = session.get('client_reference_id')
        customer_email = session.get('customer_email')
        plan_id = session.get('metadata', {}).get('plan_id', 'monthly')

        print(f"📊 Processing successful payment:")
        print(f"   - User ID: {user_id}")
        print(f"   - Email: {customer_email}")
        print(f"   - Plan ID: {plan_id}")
        print(f"   - Amount: {session.get('amount_total')}")

        # Find user
        user = None
        if user_id:
            try:
                user = User.objects.get(uuid=user_id)
                print(f"✅ Found user by UUID: {user.email}")
            except User.DoesNotExist:
                print(f"❌ User not found with UUID: {user_id}")

        if not user and customer_email:
            try:
                user = User.objects.get(email=customer_email)
                print(f"✅ Found user by email: {user.email}")
            except User.DoesNotExist:
                print(f"❌ User not found with email: {customer_email}")

        if not user:
            print("❌ Could not find user for successful payment")
            return

        # Check if subscription already exists
        try:
            existing_subscription = StudentPlusSubscription.objects.get(student=user)
            if existing_subscription.is_active():
                print(f"User {user.email} already has active subscription")
                return
            else:
                # Reactivate cancelled subscription
                existing_subscription.status = 'active'
                existing_subscription.save()
                subscription = existing_subscription
        except StudentPlusSubscription.DoesNotExist:
            # Create new subscription
            start_date = timezone.now()
            if plan_id == 'monthly':
                end_date = start_date + timedelta(days=30)
                next_billing_date = end_date
                subscription_type = 'monthly'
            else:  # yearly
                end_date = start_date + timedelta(days=365)
                next_billing_date = end_date
                subscription_type = 'yearly'

            subscription = StudentPlusSubscription.objects.create(
                student=user,
                subscription_type=subscription_type,
                status='active',
                start_date=start_date,
                end_date=end_date,
                next_billing_date=next_billing_date,
                payment_method='stripe',
                last_payment_date=start_date
            )

        # Create payment record
        StudentPlusPayment.objects.create(
            subscription=subscription,
            amount=session['amount_total'] / 100,  # Convert from cents
            status='completed',
            payment_method='stripe',
            transaction_id=session['payment_intent'] or session['id']  # Use payment_intent or session_id
        )

        # Create notification for user
        from notifications.models import Notification
        try:
            Notification.objects.create(
                user=user,
                title="🎉 Welcome to Coursera Plus!",
                message=f"Your {subscription_type} subscription has been activated. You now have access to all Plus courses!",
                notification_type='subscription_activated',
                is_read=False
            )
            print(f"Created success notification for user {user.email}")
        except Exception as e:
            print(f"Failed to create notification: {e}")

        # Create notification for admin
        try:
            admin_users = User.objects.filter(is_superuser=True)
            for admin in admin_users:
                Notification.objects.create(
                    user=admin,
                    title="💰 New Plus Subscription",
                    message=f"User {user.email} just subscribed to Coursera Plus ({subscription_type} plan)",
                    notification_type='new_subscription',
                    is_read=False
                )
            print(f"Created admin notifications for new subscription")
        except Exception as e:
            print(f"Failed to create admin notification: {e}")

        print(f"Successfully processed payment for user {user.email}")

    except Exception as e:
        print(f"Error handling successful payment: {e}")

def handle_subscription_renewal(invoice):
    """Handle subscription renewal"""

    try:
        print(f"🔄 Handling subscription renewal for invoice: {invoice['id']}")

        # Get subscription info from invoice
        subscription_id = invoice.get('subscription')
        customer_id = invoice.get('customer')
        amount_paid = invoice.get('amount_paid', 0) / 100  # Convert from cents

        print(f"📊 Renewal details:")
        print(f"   - Subscription ID: {subscription_id}")
        print(f"   - Customer ID: {customer_id}")
        print(f"   - Amount: ${amount_paid}")

        # Find the subscription in our database
        try:
            # First try to find by Stripe customer email
            customer = stripe.Customer.retrieve(customer_id)
            user = User.objects.get(email=customer.email)
            subscription = StudentPlusSubscription.objects.get(student=user)

            print(f"✅ Found subscription for user: {user.email}")

            # Update subscription dates
            start_date = timezone.now()
            if subscription.subscription_type == 'monthly':
                end_date = start_date + timedelta(days=30)
            else:  # yearly
                end_date = start_date + timedelta(days=365)

            # Update subscription
            subscription.last_payment_date = start_date
            subscription.next_billing_date = end_date
            subscription.status = 'active'
            subscription.save()

            # Create payment record
            StudentPlusPayment.objects.create(
                subscription=subscription,
                amount=amount_paid,
                status='completed',
                payment_method='stripe',
                transaction_id=invoice.get('payment_intent') or invoice.get('id')
            )

            # Create renewal notification
            from notifications.models import Notification
            try:
                Notification.objects.create(
                    user=user,
                    title="✅ Subscription Renewed",
                    message=f"Your Coursera Plus subscription has been renewed for another {subscription.subscription_type.replace('ly', '')}. Next billing: {end_date.strftime('%B %d, %Y')}",
                    notification_type='subscription_renewed',
                    is_read=False
                )
                print(f"✅ Created renewal notification for user {user.email}")
            except Exception as e:
                print(f"Failed to create renewal notification: {e}")

            print(f"✅ Subscription renewed successfully for {user.email}")

        except User.DoesNotExist:
            print(f"❌ User not found for customer ID: {customer_id}")
        except StudentPlusSubscription.DoesNotExist:
            print(f"❌ Subscription not found in database")
        except Exception as e:
            print(f"❌ Error finding subscription: {e}")

    except Exception as e:
        print(f"❌ Error handling subscription renewal: {e}")
        import traceback
        traceback.print_exc()

def handle_payment_failed(invoice):
    """Handle failed payment"""

    try:
        print(f"❌ Handling failed payment for invoice: {invoice['id']}")

        # Get subscription info from invoice
        subscription_id = invoice.get('subscription')
        customer_id = invoice.get('customer')
        amount_due = invoice.get('amount_due', 0) / 100  # Convert from cents
        attempt_count = invoice.get('attempt_count', 1)

        print(f"📊 Failed payment details:")
        print(f"   - Subscription ID: {subscription_id}")
        print(f"   - Customer ID: {customer_id}")
        print(f"   - Amount Due: ${amount_due}")
        print(f"   - Attempt: {attempt_count}")

        # Find the subscription in our database
        try:
            # Find user by Stripe customer email
            customer = stripe.Customer.retrieve(customer_id)
            user = User.objects.get(email=customer.email)
            subscription = StudentPlusSubscription.objects.get(student=user)

            print(f"✅ Found subscription for user: {user.email}")

            # Create failed payment record
            StudentPlusPayment.objects.create(
                subscription=subscription,
                amount=amount_due,
                status='failed',
                payment_method='stripe',
                transaction_id=invoice.get('id')
            )

            # Handle different failure scenarios
            if attempt_count == 1:
                # First failure - send warning notification
                notification_title = "⚠️ Payment Failed"
                notification_message = f"We couldn't process your payment of ${amount_due}. Your subscription is still active, but we'll try again soon."

                # Keep subscription active for now
                subscription.status = 'active'  # Give them grace period
                subscription.save()

            elif attempt_count >= 3:
                # Multiple failures - suspend subscription
                notification_title = "🚨 Subscription Suspended"
                notification_message = f"Your payment of ${amount_due} has failed {attempt_count} times. Your subscription has been suspended. Please update your payment method."

                # Suspend subscription
                subscription.status = 'suspended'
                subscription.save()

                # Create admin notification
                try:
                    admin_users = User.objects.filter(is_superuser=True)
                    for admin in admin_users:
                        Notification.objects.create(
                            user=admin,
                            title="🚨 Subscription Suspended",
                            message=f"User {user.email} subscription suspended due to payment failures ({attempt_count} attempts)",
                            notification_type='subscription_suspended',
                            is_read=False
                        )
                except Exception as e:
                    print(f"Failed to create admin notification: {e}")

            else:
                # Intermediate failure
                notification_title = "⚠️ Payment Retry Failed"
                notification_message = f"Payment attempt #{attempt_count} failed. We'll keep trying. Your subscription remains active."

                subscription.status = 'active'  # Keep active during retry period
                subscription.save()

            # Create user notification
            from notifications.models import Notification
            try:
                Notification.objects.create(
                    user=user,
                    title=notification_title,
                    message=notification_message,
                    notification_type='payment_failed',
                    is_read=False
                )
                print(f"✅ Created payment failure notification for user {user.email}")
            except Exception as e:
                print(f"Failed to create payment failure notification: {e}")

            print(f"✅ Failed payment handled for {user.email}")

        except User.DoesNotExist:
            print(f"❌ User not found for customer ID: {customer_id}")
        except StudentPlusSubscription.DoesNotExist:
            print(f"❌ Subscription not found in database")
        except Exception as e:
            print(f"❌ Error finding subscription: {e}")

    except Exception as e:
        print(f"❌ Error handling failed payment: {e}")
        import traceback
        traceback.print_exc()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_stripe_session(request):
    """Verify Stripe session and create subscription if webhook failed"""

    if request.user.user_type != 'student':
        return Response({'error': 'Only for students'}, status=400)

    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'error': 'session_id is required'}, status=400)

    try:
        # Check if subscription already exists
        try:
            existing = StudentPlusSubscription.objects.get(student=request.user)
            return Response({
                'message': 'Subscription already exists',
                'has_subscription': True,
                'subscription': {
                    'type': existing.subscription_type,
                    'status': existing.status,
                    'is_active': existing.is_active()
                }
            })
        except StudentPlusSubscription.DoesNotExist:
            pass

        # Retrieve session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)

        if session.payment_status == 'paid':
            print(f"🔄 Session {session_id} was paid, creating subscription...")
            handle_successful_payment(session)

            return Response({
                'message': 'Subscription created successfully',
                'has_subscription': True
            })
        else:
            return Response({
                'message': 'Session not paid yet',
                'has_subscription': False,
                'payment_status': session.payment_status
            })

    except stripe.error.StripeError as e:
        return Response({'error': f'Stripe error: {str(e)}'}, status=400)
    except Exception as e:
        print(f"Error verifying session: {e}")
        return Response({'error': str(e)}, status=500)
