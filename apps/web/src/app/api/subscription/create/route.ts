import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'

const createSubscriptionSchema = z.object({
  tier: z.enum(['fan', 'superfan']),
  price_id: z.string().startsWith('price_'),
  payment_method_id: z.string().startsWith('pm_'),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = createSubscriptionSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 422 }
    )
  }

  const { tier, price_id, payment_method_id } = parseResult.data

  try {
    // Check if customer already exists in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    let customerId: string

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id

      // Attach the payment method to the existing customer
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customerId,
      })
    } else {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Attach payment method
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customerId,
      })

      // Save the customer ID to the profile
      await supabase
        .from('profiles')
        .upsert({ id: user.id, stripe_customer_id: customerId })
    }

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    })

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        supabase_user_id: user.id,
        tier,
      },
    })

    // Save subscription ID to profile
    await supabase.from('profiles').upsert({
      id: user.id,
      stripe_subscription_id: subscription.id,
      subscription_tier: tier,
      subscription_status: subscription.status,
    })

    // Check if 3DS is required
    const latestInvoice = subscription.latest_invoice as {
      payment_intent?: {
        status: string
        client_secret: string | null
      }
    } | null

    const paymentIntent = latestInvoice?.payment_intent

    if (
      paymentIntent &&
      paymentIntent.status === 'requires_action' &&
      paymentIntent.client_secret
    ) {
      return NextResponse.json({
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        subscription_id: subscription.id,
      })
    }

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      return NextResponse.json({ success: true, subscription_id: subscription.id })
    }

    return NextResponse.json({
      success: false,
      error: `Subscription status: ${subscription.status}`,
    })
  } catch (err) {
    console.error('Stripe subscription error:', err)

    if (err instanceof Error) {
      const stripeErr = err as { type?: string; message: string }
      if (stripeErr.type === 'StripeCardError') {
        return NextResponse.json({ error: stripeErr.message }, { status: 402 })
      }
    }

    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
