function money(n) {
  return n.toFixed(2) + " €";
}

async function load() {
  const key = document.getElementById('adminKey').value;
  const base = document.getElementById('apiBase').value.replace(/\/$/, '');
  localStorage.setItem('adminKey', key);
  localStorage.setItem('apiBase', base);

  const res = await fetch(base + '/api/orders', { headers: { 'x-admin-key': key } });
  if (!res.ok) {
    alert('No se pudo cargar (revisa la clave y la URL).');
    return;
  }
  const orders = await res.json();
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><b>${o.id}</b><br><small>${new Date(o.created_at).toLocaleString()}</small><br>${o.status}</td>
      <td>${o.customer.name}<br>${o.customer.phone}<br>${o.customer.email || ''}</td>
      <td>${o.address.street1}${o.address.street2 ? '<br>' + o.address.street2 : ''}<br>${o.address.city}, ${o.address.zip}<br>${o.address.country}</td>
      <td><pre>${o.items.map(i => `${i.name} (${i.size}) x${i.qty}`).join('\n')}</pre>
      Subtotal: ${money(o.items_total)}</td>
      <td>${o.shipping.carrier} ${o.shipping.service}<br>${money(o.shipping.amount)}</td>
      <td><b>${money(o.items_total + o.shipping.amount)}</b></td>
      <td>${o.label
      ? `<a href="${o.label.label_url}" target="_blank">Ver PDF</a><br>${o.label.tracking_number}`
      : `<button class="label-btn" onclick="buyLabel('${o.id}')">Comprar etiqueta</button>`}
      </td>
    </tr>
  `).join('');
}

async function buyLabel(id) {
  const key = document.getElementById('adminKey').value;
  const base = document.getElementById('apiBase').value.replace(/\/$/, '');
  const res = await fetch(base + '/api/orders/' + id + '/label', { method: 'POST', headers: { 'x-admin-key': key } });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Error al comprar la etiqueta');
    return;
  }
  load();
}

window.onload = () => {
  document.getElementById('adminKey').value = localStorage.getItem('adminKey') || '';
  document.getElementById('apiBase').value = localStorage.getItem('apiBase') || '';
};
