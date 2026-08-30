// Minimal JSON-file order storage. Good enough for a small shop's order volume.
// If order volume grows a lot, swap this for a real database — the rest of the
// code only touches the functions below, so the swap is contained here.
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "orders.json");

function readAll() {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeAll(orders) {
  fs.writeFileSync(DB_PATH, JSON.stringify(orders, null, 2), "utf-8");
}

function addOrder(order) {
  const orders = readAll();
  orders.unshift(order); // newest first
  writeAll(orders);
  return order;
}

function getOrder(id) {
  return readAll().find((o) => o.id === id) || null;
}

function updateOrder(id, patch) {
  const orders = readAll();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch };
  writeAll(orders);
  return orders[idx];
}

module.exports = { readAll, addOrder, getOrder, updateOrder };
