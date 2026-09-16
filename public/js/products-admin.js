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

function base() { return document.getElementById('apiBase').value.replace(/\/$/, ''); }
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
  localStorage.setItem('apiBase', base());
  try {
    const res = await fetch(base() + '/api/products');
    if (!res.ok) { showMsg('No se pudo cargar el catálogo.', 'error'); return; }
    products = await res.json();
    showMsg('');
    renderTable();
  } catch (e) {
    showMsg('No se pudo conectar con el backend. Revisa la URL.', 'error');
  }
}

function renderTable() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const list = products.filter(p => !q || p.name.toLowerCase().includes(q) || p.en.toLowerCase().includes(q));
  document.getElementById('count').textContent = products.length;
  const tbody = document.querySelector('#tbl tbody');
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.image ? `<img class="thumb" src="${p.image}">` : ''}</td>
      <td>${p.name}<br><small>${p.en}</small></td>
      <td>${(CATEGORIES.find(c => c.id === p.cat) || {}).label || p.cat}</td>
      <td>${p.size}${p.pack ? '<br><small>' + p.pack + '</small>' : ''}</td>
      <td>${money(p.price)}</td>
      <td>
        <button class="secondary" onclick="editProduct('${p.id}')">Editar</button>
        <button class="danger" onclick="removeProduct('${p.id}')">Borrar</button>
      </td>
    </tr>
  `).join('');
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
    const res = await fetch(base() + '/api/products/upload-image', {
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
    image: document.getElementById('fImageUrl').value || null
  };
  const url = id ? `${base()}/api/products/${id}` : `${base()}/api/products`;
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
    showMsg('No se pudo conectar con el backend.', 'error');
  }
  return false;
}

async function removeProduct(id) {
  if (!confirm('¿Seguro que quieres borrar este producto?')) return;
  try {
    const res = await fetch(`${base()}/api/products/${id}`, { method: 'DELETE', headers: { 'x-admin-key': key() } });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error || 'No se pudo borrar el producto.', 'error'); return; }
    showMsg('Producto borrado.', 'ok');
    await load();
  } catch (err) {
    showMsg('No se pudo conectar con el backend.', 'error');
  }
}

function initProductsAdmin() {
  populateCatSelect();
  document.getElementById('adminKey').value = localStorage.getItem('adminKey') || '';
  document.getElementById('apiBase').value = localStorage.getItem('apiBase') || '';
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('fImageFile').addEventListener('change', uploadImage);
  document.getElementById('search').addEventListener('input', renderTable);
  if (document.getElementById('apiBase').value) load();
}

window.onload = initProductsAdmin;
