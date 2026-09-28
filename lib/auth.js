// Comprobación de la contraseña del panel (variable de entorno ADMIN_KEY).
// - Comparación en tiempo constante.
// - Freno básico contra fuerza bruta: tras 8 intentos fallidos desde la misma
//   IP en 15 minutos, se bloquea esa IP 15 minutos.
const crypto = require("crypto");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map(); // ip -> { count, first }

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isBlocked(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    fails.delete(ip);
    return false;
  }
  return f.count >= MAX_FAILS;
}

function registerFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
  else f.count++;
}

function requireAdmin(req, res, next) {
  const ip = clientIp(req);
  if (isBlocked(ip)) {
    return res.status(429).json({ error: "Demasiados intentos fallidos. Espera 15 minutos." });
  }
  const key = req.header("x-admin-key") || "";
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: "Falta configurar ADMIN_KEY en el servidor." });
  }
  if (!key || !safeEqual(key, process.env.ADMIN_KEY)) {
    registerFail(ip);
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }
  fails.delete(ip);
  next();
}

module.exports = { requireAdmin };
