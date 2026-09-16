require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const ratesRoute = require("./routes/rates");
const ordersRoute = require("./routes/orders");
const webhookRoute = require("./routes/webhook");
const productsRoute = require("./routes/products");

const app = express();

// Stripe webhook needs the RAW body to verify its signature — this must be
// registered BEFORE express.json() below, or the signature check will fail.
app.use("/api/webhook/stripe", express.raw({ type: "application/json" }), webhookRoute);

app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN === "*" ? true : process.env.ALLOWED_ORIGIN,
  })
);

app.use("/api/rates", ratesRoute);
app.use("/api/orders", ordersRoute);
app.use("/api/products", productsRoute);

// Serves the admin panels: /admin.html, /products-admin.html and their
// css/js/ assets straight out of public/.
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nepali shop backend listening on port ${PORT}`));
