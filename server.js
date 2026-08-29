require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const ratesRoute = require("./routes/rates");
const ordersRoute = require("./routes/orders");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN === "*" ? true : process.env.ALLOWED_ORIGIN,
  })
);

app.use("/api/rates", ratesRoute);
app.use("/api/orders", ordersRoute);
app.use("/admin.html", express.static(path.join(__dirname, "public", "admin.html")));

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nepali shop backend listening on port ${PORT}`));
