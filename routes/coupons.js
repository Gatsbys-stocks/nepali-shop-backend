const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../lib/auth");
const C = require("../lib/coupons");
const { readAll: readProducts } = require("../lib/products");

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor." });
  });

// POST /api/coupons/validate — público. body: { code, items:[{id,qty}] }
// Calcula el subtotal con los precios del catálogo (no los del navegador).
router.post("/validate", (req, res) => {
  const { code, items } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: "invalid" });
  const catalog = readProducts();
  const subtotal = (Array.isArray(items) ? items : []).reduce((s, it) => {
    const p = catalog.find((x) => x.id === it.id);
    return p ? s + p.price * Math.max(1, parseInt(it.qty, 10) || 1) : s;
  }, 0);
  res.json({ ...C.evaluate(code, subtotal), subtotal });
});

// GET /api/coupons/public — público. Cupones activos marcados "anunciar en
// la tienda", para el banner de promociones.
router.get("/public", (req, res) => {
  const today = C.todayMadrid();
  res.set("Cache-Control", "no-store");
  res.json(
    C.readAll()
      .filter((c) => c.public && C.statusOf(c, today) === "activo")
      .map((c) => ({ code: c.code, event: c.event, type: c.type, value: c.value, minOrder: c.minOrder, endsAt: c.endsAt }))
  );
});

// ----- admin -----
router.get("/", requireAdmin, (req, res) => {
  const today = C.todayMadrid();
  res.json(C.readAll().map((c) => ({ ...c, status: C.statusOf(c, today) })));
});

router.post("/", requireAdmin, wrap(async (req, res) => {
  const err = C.validateBody(req.body);
  if (err) return res.status(400).json({ error: err });
  res.status(201).json(await C.addCoupon(req.body));
}));

router.put("/:id", requireAdmin, wrap(async (req, res) => {
  const err = C.validateBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });
  const updated = await C.updateCoupon(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Cupón no encontrado." });
  res.json(updated);
}));

router.delete("/:id", requireAdmin, wrap(async (req, res) => {
  const ok = await C.deleteCoupon(req.params.id);
  if (!ok) return res.status(404).json({ error: "Cupón no encontrado." });
  res.json({ ok: true });
}));

module.exports = router;
