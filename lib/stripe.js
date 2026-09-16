const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Builds a Stripe Checkout Session for a given order: one line item per
// product plus one line item for the chosen shipping rate. The customer
// is redirected to Stripe's own hosted payment page — card details never
// touch our server.
async function createCheckoutSession(order, { successUrl, cancelUrl }) {
  const line_items = order.items.map((it) => ({
    price_data: {
      currency: "eur",
      product_data: { name: `${it.name} (${it.size})` },
      unit_amount: Math.round(it.price * 100),
    },
    quantity: it.qty,
  }));

  line_items.push({
    price_data: {
      currency: "eur",
      product_data: {
        name: `Shipping — ${order.shipping.carrier} ${order.shipping.service}`,
      },
      unit_amount: Math.round(order.shipping.amount * 100),
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: order.customer.email || undefined,
    line_items,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { order_id: order.id },
  });

  return session;
}

module.exports = { stripe, createCheckoutSession };
