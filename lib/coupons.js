// Cupones de descuento por eventos (Dashain, Tihar, Navidad, Black Friday...).
// Guardados en lib/db.js (Cloudinary) igual que productos y pedidos.
const { nanoid } = require("nanoid");
const { coupons } = require("./db");

function normCode(code) {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

// Fecha de hoy en hora de España, formato YYYY-MM-DD.
function todayMadrid() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function readAll() {
  return coupons.get();
}

function findByCode(code) {
  const c = normCode(code);
  return readAll().find((x) => x.code === c) || null;
}

function validateBody(body, { partial } = {}) {
  if (!partial || body.code !== undefined) {
    const code = normCode(body.code);
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return "El código debe tener 3–24 letras o números (sin espacios).";
  }
  if (!partial || body.type !== undefined) {
    if (!["percent", "fixed"].includes(body.type)) return "Tipo de descuento no válido.";
  }
  if (!partial || body.value !== undefined) {
    const v = Number(body.value);
    if (!(v > 0)) return "El descuento debe ser mayor que 0.";
    if (body.type === "percent" && v > 90) return "El porcentaje máximo es 90 %.";
  }
  if (body.startsAt && body.endsAt && body.startsAt > body.endsAt) {
    return "La fecha de fin es anterior a la de inicio.";
  }
  return null;
}

function clean(body) {
  const out = {};
  if (body.code !== undefined) out.code = normCode(body.code);
  if (body.event !== undefined) out.event = String(body.event || "").trim().slice(0, 60);
  if (body.type !== undefined) out.type = body.type;
  if (body.value !== undefined) out.value = Math.round(Number(body.value) * 100) / 100;
  if (body.minOrder !== undefined) out.minOrder = Math.max(0, Number(body.minOrder) || 0);
  if (body.maxUses !== undefined) out.maxUses = Math.max(0, parseInt(body.maxUses, 10) || 0);
  if (body.startsAt !== undefined) out.startsAt = body.startsAt || null;
  if (body.endsAt !== undefined) out.endsAt = body.endsAt || null;
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.public !== undefined) out.public = Boolean(body.public);
  return out;
}

function addCoupon(body) {
  return coupons.update((list) => {
    const data = clean(body);
    if (list.some((c) => c.code === data.code)) {
      const e = new Error("Ya existe un cupón con ese código.");
      e.status = 409;
      throw e;
    }
    const coupon = {
      id: "c-" + nanoid(8),
      event: "",
      minOrder: 0,
      maxUses: 0,
      uses: 0,
      startsAt: null,
      endsAt: null,
      active: true,
      public: false,
      createdAt: new Date().toISOString(),
      ...data,
    };
    list.unshift(coupon);
    return coupon;
  });
}

function updateCoupon(id, body) {
  return coupons.update((list) => {
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const data = clean(body);
    if (data.code && list.some((c) => c.code === data.code && c.id !== id)) {
      const e = new Error("Ya existe un cupón con ese código.");
      e.status = 409;
      throw e;
    }
    list[idx] = { ...list[idx], ...data };
    return list[idx];
  });
}

function deleteCoupon(id) {
  return coupons.update((list) => {
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  });
}

function incrementUses(code) {
  return coupons.update((list) => {
    const c = list.find((x) => x.code === normCode(code));
    if (c) c.uses = (c.uses || 0) + 1;
    return c || null;
  });
}

// Estado "humano" de un cupón para el panel.
function statusOf(c, today = todayMadrid()) {
  if (!c.active) return "pausado";
  if (c.startsAt && today < c.startsAt) return "programado";
  if (c.endsAt && today > c.endsAt) return "caducado";
  if (c.maxUses && (c.uses || 0) >= c.maxUses) return "agotado";
  return "activo";
}

// Comprueba un código contra el subtotal de productos. Nunca confía en el
// navegador: el descuento siempre se calcula aquí.
function evaluate(code, subtotal) {
  const c = findByCode(code);
  if (!c) return { ok: false, error: "invalid" };
  const st = statusOf(c);
  if (st !== "activo") return { ok: false, error: st === "programado" ? "not_started" : st === "caducado" ? "expired" : st === "agotado" ? "used_up" : "invalid" };
  if (c.minOrder && subtotal < c.minOrder) return { ok: false, error: "min_order", minOrder: c.minOrder };
  let discount = c.type === "percent" ? (subtotal * c.value) / 100 : c.value;
  discount = Math.min(Math.round(discount * 100) / 100, subtotal);
  return {
    ok: true,
    discount,
    coupon: { code: c.code, event: c.event, type: c.type, value: c.value },
  };
}

module.exports = { readAll, addCoupon, updateCoupon, deleteCoupon, incrementUses, evaluate, statusOf, validateBody, todayMadrid };
