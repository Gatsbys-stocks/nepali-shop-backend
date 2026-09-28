const express = require("express");
const router = express.Router();
const { stripe } = require("../lib/stripe");
const { getOrder, updateOrder } = require("../lib/store");
const { paymentConfirmedEmail } = require("../lib/email");
const { incrementUses } = require("../lib/coupons");

// This route needs the RAW request body to verify Stripe's signature —
// it's mounted with express.raw() in server.js, before the global
// express.json() middleware touches it. Don't add express.json() here.
router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature check failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata && session.metadata.order_id;
    if (orderId) {
      const order = getOrder(orderId);
      if (order && order.payment_status !== "pagado") {
        const updated = await updateOrder(orderId, {
          payment_status: "pagado",
          status: "pagado",
          payment: {
            stripe_session_id: session.id,
            amount_total: session.amount_total / 100,
            currency: session.currency,
            paid_at: new Date().toISOString(),
          },
        });
        if (order.coupon) incrementUses(order.coupon.code).catch((e) => console.error("coupon uses", e));
        paymentConfirmedEmail(updated).catch((e) => console.error("payment email failed", e));
      }
    }
  }

  } catch (err) {
    // 500 → Stripe reintentará el aviso más tarde, así no se pierde el pago.
    console.error("webhook: no se pudo guardar el pago", err);
    return res.status(500).json({ error: "retry" });
  }

  res.json({ received: true });
});

module.exports = router;
