// Catálogo de productos. Los datos viven en lib/db.js (Cloudinary), así que
// los cambios hechos desde el panel sobreviven a reinicios de Render.
const { nanoid } = require("nanoid");
const { products } = require("./db");

function readAll() {
  return products.get();
}

function getProduct(id) {
  return readAll().find((p) => p.id === id) || null;
}

function clean(data) {
  const out = {};
  ["name", "en", "cat", "size"].forEach((k) => {
    if (data[k] !== undefined) out[k] = String(data[k]).trim();
  });
  if (data.price !== undefined) out.price = Math.round(Number(data.price) * 100) / 100;
  if (data.pack !== undefined) out.pack = data.pack ? String(data.pack).trim() : null;
  if (data.image !== undefined) out.image = data.image || null;
  if (data.inStock !== undefined) out.inStock = Boolean(data.inStock);
  if (data.featured !== undefined) out.featured = Boolean(data.featured);
  return out;
}

function addProduct(data) {
  return products.update((list) => {
    const product = {
      id: "p-" + nanoid(8),
      pack: null,
      image: null,
      inStock: true,
      featured: false,
      ...clean(data),
    };
    list.push(product);
    return product;
  });
}

function updateProduct(id, patch) {
  return products.update((list) => {
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...clean(patch) };
    return list[idx];
  });
}

function deleteProduct(id) {
  return products.update((list) => {
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  });
}

module.exports = { readAll, getProduct, addProduct, updateProduct, deleteProduct };
