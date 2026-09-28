const express = require("express");
const router = express.Router();
const { nanoid } = require("nanoid");
const { addOrder, readAll, getOrder, updateOrder } = require("../lib/store");
const { readAll: readProducts } = require("../lib/products");
const { evaluate } = require("../lib/coupons");
const { notifyShopOfNewOrder, confirmToCustomer } = require("../lib/email");
const { buyLabel } = require("../lib/shippo");
const { createCheckoutSession } = require("../lib/stripe");
const { requireAdmin } = require("../lib/auth");

const round2 = (n) => Math.round(n * 100) / 100;

const COUPON_ERRORS = {
  invalid: "El cupón no es válido.",
  expired: "El cupón ha caducado.",
  not_started: "El cupón todavía no está activo.",
  used_up: "El cupón ya se ha usado el máximo de veces.",
  min_order: "El pedido no llega al mínimo del cupón.",
};

// POST /api/orders
// body: { customer, address, items:[{id,qty}], shipping, notes, coupon }
// Los precios y el descuento se recalculan SIEMPRE aquí con el catálogo del
// servidor: lo que mande el navegador para precio se ignora.
router.post("/", async (req, res) => {
  try {
    const { customer, address, items, shipping, notes, coupon } = req.body;
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ error: "Faltan los datos del cliente." });
    }
    if (!address || !address.street1 || !address.city || !address.country) {
      return res.status(400).json({ error: "Falta la dirección de envío." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }
    if (!shipping || !shipping.rate_id || isNaN(Number(shipping.amount))) {
      return res.status(400).json({ error: "Elige un método de envío antes de confirmar." });
    }

    const catalog = readProducts();
    const lines = [];
    for (const it of items) {
      const p = catalog.find((x) => x.id === it.id);
      const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
      if (!p) return res.status(400).json({ error: `Un producto del carrito ya no existe. Recarga la página.` });
      if (p.inStock === false) return res.status(400).json({ error: `"${p.en}" está agotado. Quítalo del carrito.` });
      lines.push({ id: p.id, name: p.name, en: p.en, size: p.size, price: p.price, qty });
    }
    const items_total = round2(lines.reduce((s, it) => s + it.price * it.qty, 0));

    let couponInfo = null;
    let discount = 0;
    if (coupon) {
      const r = evaluate(coupon, items_total);
      if (!r.ok) return res.status(400).json({ error: COUPON_ERRORS[r.error] || COUPON_ERRORS.invalid });
      discount = r.discount;
      couponInfo = { ...r.coupon, discount };
    }

    const shippingAmount = round2(Number(shipping.amount));
    const order = {
      id: "PED-" + nanoid(8).toUpperCase(),
      created_at: new Date().toISOString(),
      status: "nuevo",
      payment_status: "pendiente",
      payment: null,
      customer,
      address,
      items: lines,
      items_total,
      coupon: couponInfo,
      discount,
      shipping: { ...shipping, amount: shippingAmount },
      total: round2(items_total - discount + shippingAmount),
      notes: notes || "",
      label: null,
    };

    await addOrder(order);
    notifyShopOfNewOrder(order).catch((e) => console.error("email to shop failed", e));
    confirmToCustomer(order).catch((e) => console.error("email to customer failed", e));

    res.status(201).json({ order_id: order.id, total: order.total, discount });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "No se pudo crear el pedido." });
  }
});

// POST /api/orders/:id/checkout — crea la sesión de Stripe (público).
router.post("/:id/checkout", async (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    if (order.payment_status === "pagado") return res.status(400).json({ error: "Este pedido ya está pagado." });
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "El pago con tarjeta no está configurado todavía." });
    }
    const base = process.env.STORE_URL || "https://example.com";
    const session = await createCheckoutSession(order, {
      successUrl: `${base}?payment=success&order=${order.id}`,
      cancelUrl: `${base}?payment=cancelled&order=${order.id}`,
    });
    await updateOrder(order.id, { stripe_session_id: session.id });
    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo iniciar el pago.", detail: String(err.message || err) });
  }
});

// GET /api/orders (admin)
router.get("/", requireAdmin, (req, res) => {
  res.json(readAll());
});

// PATCH /api/orders/:id (admin) — cambiar el estado (preparando, enviado...)
const STATUSES = ["nuevo", "pagado", "preparando", "etiqueta_comprada", "enviado", "entregado", "cancelado"];
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Estado no válido." });
    const updated = await updateOrder(req.params.id, { status });
    if (!updated) return res.status(404).json({ error: "Pedido no encontrado." });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/orders/:id/label (admin) — comprar la etiqueta real
router.post("/:id/label", requireAdmin, async (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    const label = await buyLabel(order.shipping.rate_id);
    const updated = await updateOrder(order.id, { label, status: "etiqueta_comprada" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo comprar la etiqueta. Puede que la tarifa haya caducado — vuelve a pedir tarifas para este pedido.", detail: String(err.message || err) });
  }
});

module.exports = router;
