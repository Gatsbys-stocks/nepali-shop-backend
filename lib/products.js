// Minimal JSON-file product storage — same pattern as lib/store.js for orders.
// Good enough for a catalog of a few hundred items. If it grows a lot or needs
// concurrent writers, swap this for a real database — the rest of the code
// only touches the functions below, so the swap is contained here.
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const DB_PATH = path.join(__dirname, "..", "data", "products.json");

function readAll() {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = fs.readFileSync(DB_PATH, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeAll(products) {
  fs.writeFileSync(DB_PATH, JSON.stringify(products, null, 2), "utf-8");
}

function getProduct(id) {
  return readAll().find((p) => p.id === id) || null;
}

function addProduct(data) {
  const products = readAll();
  const product = {
    id: "p-" + nanoid(8),
    name: data.name,
    en: data.en,
    cat: data.cat,
    size: data.size,
    price: Number(data.price),
    pack: data.pack || null,
    image: data.image || null,
  };
  products.push(product);
  writeAll(products);
  return product;
}

function updateProduct(id, patch) {
  const products = readAll();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const next = { ...products[idx], ...patch };
  if (patch.price !== undefined) next.price = Number(patch.price);
  products[idx] = next;
  writeAll(products);
  return products[idx];
}

function deleteProduct(id) {
  const products = readAll();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  products.splice(idx, 1);
  writeAll(products);
  return true;
}

module.exports = { readAll, getProduct, addProduct, updateProduct, deleteProduct };
