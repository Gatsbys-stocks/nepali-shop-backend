// URL fija del backend — el cliente ya no tiene que copiarla ni pegarla,
// solo necesita su contraseña.
const API_BASE_URL = "https://nepali-shop-backend.onrender.com";

const CATEGORIES = [
  { id: "pitho", label: "Harinas / cereales" },
  { id: "noodles", label: "Noodles & snacks" },
  { id: "daal", label: "Legumbres" },
  { id: "achar", label: "Encurtidos" },
  { id: "masala", label: "Especias" },
  { id: "chiya", label: "Té y bebidas" },
  { id: "otros", label: "Otros" }
];

let products = [];

function key() { return document.getElementById('adminKey').value; }
function money(n) { return Number(n).toFixed(2) + " €"; }

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = type || '';
}

function populateCatSelect() {
  document.getElementById('fCat').innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

async function load() {
  localStorage.setItem('adminKey', key());
  try {
    const res = await fetch(API_BASE_URL + '/api/products');
    if (!res.ok) { showMsg('No se pudo cargar el catálogo. Revisa la contraseña.', 'error'); return; }
    products = await res.json();
    showMsg('');
    renderList();
  } catch (e) {
    showMsg('No se pudo conectar con el servidor. Inténtalo de nuevo en unos segundos.', 'error');
  }
}

function renderList() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const list = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.en.toLowerCase().includes(q));
  document.getElementById('count').textContent = products.length;
  const wrap = document.getElementById('productList');

  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty-msg">No hay productos que coincidan.</div>`;
    return;
  }

  wrap.innerHTML = list.map(p => {
    const inStock = p.inStock !== false;
    const catLabel = (CATEGORIES.find(c => c.id === p.cat) || {}).label || p.cat;
    return `
    <div class="product-card ${inStock ? '' : 'out-of-stock'}">
      <div class="product-photo">
        ${p.image
          ? `<img src="${p.image}" alt="${p.en}">`
          : `<div class="no-photo">Sin foto</div>`}
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-name-en">${p.en}</div>
        <div class="product-meta">${catLabel} · ${p.size}${p.pack ? ' · ' + p.pack : ''}</div>
        <div class="product-price">${money(p.price)}</div>
        <div class="stock-badge ${inStock ? 'in' : 'out'}">${inStock ? 'En stock' : 'Agotado'}</div>
      </div>
      <div class="product-actions">
        <button type="button" class="secondary toggle-stock-btn" data-id="${p.id}" data-next="${!inStock}">${inStock ? 'Marcar agotado' : 'Marcar disponible'}</button>
        <button type="button" class="secondary edit-btn" data-id="${p.id}">Editar</button>
        <button type="button" class="danger delete-btn" data-id="${p.id}">Borrar</button>
      </div>
    </div>`;
  }).join('');

  wrap.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.id)));
  wrap.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => removeProduct(btn.dataset.id)));
  wrap.querySelectorAll('.toggle-stock-btn').forEach(btn => btn.addEventListener('click', () => toggleStock(btn.dataset.id, btn.dataset.next === 'true')));
}

async function toggleStock(id, nextInStock) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key() },
      body: JSON.stringify({ inStock: nextInStock })
    });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || 'No se pudo actualizar el stock.', 'error'); return; }
    showMsg(nextInStock ? 'Producto marcado como disponible.' : 'Producto marcado como agotado.', 'ok');
    await load();
  } catch (err) {
    showMsg('No se pudo conectar con el servidor.', 'error');
  }
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('formTitle').textContent = 'Editar producto';
  document.getElementById('editId').value = p.id;
  document.getElementById('fName').value = p.name;
  document.getElementById('fEn').value = p.en;
  document.getElementById('fCat').value = p.cat;
  document.getElementById('fSize').value = p.size;
  document.getElementById('fPrice').value = p.price;
  document.getElementById('fPack').value = p.pack || '';
  document.getElementById('fImageUrl').value = p.image || '';
  document.getElementById('fStock').checked = p.inStock !== false;
  const preview = document.getElementById('preview');
  if (p.image) { preview.src = p.image; preview.style.display = 'block'; } else { preview.style.display = 'none'; }
  document.getElementById('saveBtn').textContent = 'Guardar cambios';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('formTitle').textContent = 'Añadir producto';
  document.getElementById('productForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('fImageUrl').value = '';
  document.getElementById('fStock').checked = true;
  document.getElementById('preview').style.display = 'none';
  document.getElementById('saveBtn').textContent = 'Guardar producto';
  document.getElementById('uploadStatus').textContent = '';
}

async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('uploadStatus');
  status.textContent = 'Subiendo imagen...';
  try {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(API_BASE_URL + '/api/products/upload-image', {
      method: 'POST',
      headers: { 'x-admin-key': key() },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) { status.textContent = ''; showMsg(data.error || 'No se pudo subir la imagen.', 'error'); return; }
    document.getElementById('fImageUrl').value = data.url;
    const preview = document.getElementById('preview');
    preview.src = data.url;
    preview.style.display = 'block';
    status.textContent = 'Imagen subida ✓';
  } catch (err) {
    status.textContent = '';
    showMsg('No se pudo subir la imagen.', 'error');
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const body = {
    name: document.getElementById('fName').value.trim(),
    en: document.getElementById('fEn').value.trim(),
    cat: document.getElementById('fCat').value,
    size: document.getElementById('fSize').value.trim(),
    price: document.getElementById('fPrice').value,
    pack: document.getElementById('fPack').value.trim() || null,
    image: document.getElementById('fImageUrl').value || null,
    inStock: document.getElementById('fStock').checked
  };
  const url = id ? `${API_BASE_URL}/api/products/${id}` : `${API_BASE_URL}/api/products`;
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || 'No se pudo guardar el producto.', 'error'); return false; }
    showMsg(id ? 'Producto actualizado.' : 'Producto añadido.', 'ok');
    resetForm();
    await load();
  } catch (err) {
    showMsg('No se pudo conectar con el servidor.', 'error');
  }
  return false;
}

async function removeProduct(id) {
  if (!confirm('¿Seguro que quieres borrar este producto?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE', headers: { 'x-admin-key': key() } });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || 'No se pudo borrar el producto.', 'error'); return; }
    showMsg('Producto borrado.', 'ok');
    await load();
  } catch (err) {
    showMsg('No se pudo conectar con el servidor.', 'error');
  }
}

function initProductsAdmin() {
  populateCatSelect();
  document.getElementById('adminKey').value = localStorage.getItem('adminKey') || '';
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('fImageFile').addEventListener('change', uploadImage);
  document.getElementById('search').addEventListener('input', renderList);
  document.getElementById('loadBtn').addEventListener('click', load);
  document.getElementById('cancelBtn').addEventListener('click', resetForm);
  if (document.getElementById('adminKey').value) load();
}

window.onload = initProductsAdmin;
