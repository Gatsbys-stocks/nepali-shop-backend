require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./lib/db");
const { requireAdmin } = require("./lib/auth");
const ratesRoute = require("./routes/rates");
const ordersRoute = require("./routes/orders");
const webhookRoute = require("./routes/webhook");
const productsRoute = require("./routes/products");
const couponsRoute = require("./routes/coupons");

const app = express();
app.set("trust proxy", true);

// El webhook de Stripe necesita el body SIN parsear para verificar la firma —
// tiene que ir ANTES de express.json().
app.use("/api/webhook/stripe", express.raw({ type: "application/json" }), webhookRoute);

app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN === "*" ? true : process.env.ALLOWED_ORIGIN,
  })
);

// GET /api/auth/check — el panel lo usa para comprobar la contraseña ANTES
// de enseñar nada. 200 = correcta, 401 = incorrecta.
app.get("/api/auth/check", requireAdmin, (req, res) => res.json({ ok: true }));

app.use("/api/rates", ratesRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/products", productsRoute);
app.use("/api/coupons", couponsRoute);

// El antiguo panel de productos ahora es una pestaña del panel único.
app.get("/products-admin.html", (req, res) => res.redirect(301, "/admin.html#productos"));
app.get("/admin", (req, res) => res.redirect(301, "/admin.html"));

// Panel de administración (admin.html + css/js/img) servido desde public/.
app.use(express.static(path.join(__dirname, "public")));

// /health también dice dónde se guardan los datos: "cloudinary" = persistente.
// Si pone "local", faltan las variables de Cloudinary y los cambios se perderán.
app.get("/health", (req, res) =>
  res.json({
    ok: true,
    storage: db.products.remote ? "cloudinary" : "local",
    ready: db.products.ready && db.orders.ready && db.coupons.ready,
  })
);

const PORT = process.env.PORT || 3000;
db.loadAll().finally(() => {
  app.listen(PORT, () => console.log(`Nepali shop backend listening on port ${PORT}`));
});
