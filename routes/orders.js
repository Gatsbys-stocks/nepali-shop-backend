const express = require("express");
const router = express.Router();
const { nanoid } = require("nanoid");
const { addOrder, readAll, getOrder, updateOrder } = require("../lib/store");
const { notifyShopOfNewOrder, confirmToCustomer } = require("../lib/email");
const { buyLabel } = require("../lib/shippo");

function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
}

// POST /api/orders
// body: { customer:{name,phone,email}, address:{...}, items:[...], shipping:{rate_id,carrier,service,amount,currency}, notes }
router.post("/", async (req, res) => {
  try {
    const { customer, address, items, shipping, notes } = req.body;
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ error: "Faltan los datos del cliente." });
    }
    if (!address || !address.street1 || !address.city || !address.country) {
      return res.status(400).json({ error: "Falta la dirección de envío." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }
    if (!shipping || !shipping.rate_id) {
      return res.status(400).json({ error: "Elige un método de envío antes de confirmar." });
    }

    const items_total = items.reduce((s, it) => s + it.price * it.qty, 0);

    const order = {
      id: "PED-" + nanoid(8).toUpperCase(),
      created_at: new Date().toISOString(),
      status: "nuevo",
      customer,
      address,
      items,
      items_total,
      shipping,
      notes: notes || "",
      label: null,
    };

    addOrder(order);
    notifyShopOfNewOrder(order).catch((e) => console.error("email to shop failed", e));
    confirmToCustomer(order).catch((e) => console.error("email to customer failed", e));

    res.status(201).json({ order_id: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear el pedido." });
  }
});

// GET /api/orders  (admin only) — list orders for fulfilment
router.get("/", requireAdmin, (req, res) => {
  res.json(readAll());
});

// POST /api/orders/:id/label  (admin only) — purchase the real carrier label
router.post("/:id/label", requireAdmin, async (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    const label = await buyLabel(order.shipping.rate_id);
    const updated = updateOrder(order.id, { label, status: "etiqueta_comprada" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo comprar la etiqueta. Puede que la tarifa haya caducado — vuelve a pedir tarifas para este pedido.", detail: String(err.message || err) });
  }
});

module.exports = router;
