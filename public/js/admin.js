// URL fija del backend — el cliente ya no tiene que copiarla ni pegarla,
// solo necesita su contraseña.
const API_BASE_URL = "https://nepali-shop-backend.onrender.com";

function key() { return document.getElementById('adminKey').value; }
function money(n) { return n.toFixed(2) + " €"; }

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = type || '';
}

async function load() {
  localStorage.setItem('adminKey', key());
  try {
    const res = await fetch(API_BASE_URL + '/api/orders', { headers: { 'x-admin-key': key() } });
    if (!res.ok) { showMsg('No se pudo cargar. Revisa la contraseña.', 'error'); return; }
    const orders = await res.json();
    showMsg('');
    renderOrders(orders);
  } catch (e) {
    showMsg('No se pudo conectar con el servidor. Inténtalo de nuevo en unos segundos.', 'error');
  }
}

function renderOrders(orders) {
  const wrap = document.getElementById('orderList');
  if (orders.length === 0) {
    wrap.innerHTML = `<div class="empty-msg">Todavía no hay pedidos.</div>`;
    return;
  }
  wrap.innerHTML = orders.map(o => {
    const itemsText = o.items.map(i => `${i.name} (${i.size}) x${i.qty}`).join('\n');
    const total = o.items_total + o.shipping.amount;
    return `
    <div class="order-card">
      <div class="row-top">
        <div>
          <div class="order-id">${o.id}</div>
          <div class="order-date">${new Date(o.created_at).toLocaleString()}</div>
        </div>
        <div class="order-status">${o.status}</div>
      </div>

      <div class="order-section">
        <div class="order-section-label">Cliente</div>
        ${o.customer.name} · ${o.customer.phone}${o.customer.email ? ' · ' + o.customer.email : ''}
      </div>

      <div class="order-section">
        <div class="order-section-label">Dirección</div>
        ${o.address.street1}${o.address.street2 ? ', ' + o.address.street2 : ''}<br>
        ${o.address.city}, ${o.address.zip} · ${o.address.country}
      </div>

      <div class="order-section">
        <div class="order-section-label">Productos</div>
        <div class="order-items">${itemsText}</div>
        Subtotal: ${money(o.items_total)}
      </div>

      <div class="order-section">
        <div class="order-section-label">Envío</div>
        ${o.shipping.carrier} ${o.shipping.service} · ${money(o.shipping.amount)}
      </div>

      <div class="order-total-row">
        <span>Total</span>
        <span class="order-total">${money(total)}</span>
      </div>

      ${o.label
        ? `<a class="label-link" href="${o.label.label_url}" target="_blank">Ver etiqueta (PDF) — ${o.label.tracking_number}</a>`
        : `<button class="label-btn" data-id="${o.id}">Comprar etiqueta</button>`}
    </div>`;
  }).join('');

  wrap.querySelectorAll('.label-btn').forEach(btn => btn.addEventListener('click', () => buyLabel(btn.dataset.id)));
}

async function buyLabel(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/${id}/label`, { method: 'POST', headers: { 'x-admin-key': key() } });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || 'No se pudo comprar la etiqueta.', 'error'); return; }
    showMsg('Etiqueta comprada.', 'ok');
    load();
  } catch (e) {
    showMsg('No se pudo conectar con el servidor.', 'error');
  }
}

window.onload = () => {
  document.getElementById('adminKey').value = localStorage.getItem('adminKey') || '';
  document.getElementById('loadBtn').addEventListener('click', load);
  if (document.getElementById('adminKey').value) load();
};
