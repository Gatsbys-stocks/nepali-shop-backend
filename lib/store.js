// Pedidos. Igual que los productos, viven en lib/db.js (Cloudinary) para que
// no se pierdan cuando Render reinicia el servidor.
const { orders } = require("./db");

function readAll() {
  return orders.get();
}

function getOrder(id) {
  return readAll().find((o) => o.id === id) || null;
}

function addOrder(order) {
  return orders.update((list) => {
    list.unshift(order); // más nuevos primero
    return order;
  });
}

function updateOrder(id, patch) {
  return orders.update((list) => {
    const idx = list.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    return list[idx];
  });
}

module.exports = { readAll, addOrder, getOrder, updateOrder };
