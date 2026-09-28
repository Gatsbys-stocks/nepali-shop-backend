// Panel único: pedidos + productos + cupones.
// Se sirve desde el propio backend, así que las llamadas van al mismo dominio.
const API = "";

const CATEGORIES = [
  { id: "pitho", label: "Harinas / cereales" },
  { id: "noodles", label: "Noodles & snacks" },
  { id: "daal", label: "Legumbres" },
  { id: "achar", label: "Encurtidos (achar)" },
  { id: "masala", label: "Especias" },
  { id: "chiya", label: "Té y bebidas" },
  { id: "otros", label: "Otros" },
];
const STATUS_LABELS = {
  nuevo: "Nuevo · sin pagar",
  pagado: "Pagado",
  preparando: "Preparando",
  etiqueta_comprada: "Etiqueta comprada",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const state = { key: "", orders: [], products: [], coupons: [], tab: "pedidos" };

/* ---------------- utilidades ---------------- */
const $ = (id) => document.getElementById(id);
const money = (n) => Number(n || 0).toFixed(2).replace(".", ",") + " €";
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDay(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

let toastTimer;
function toast(msg, type = "ok") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast " + type), 3200);
}

// Todas las llamadas protegidas pasan por aquí. Si el servidor dice 401
// (contraseña cambiada o incorrecta), se cierra la sesión al momento.
async function api(path, { method = "GET", body, form } = {}) {
  const headers = { "x-admin-key": state.key };
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(API + path, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) {
    logout("La sesión ha caducado o la contraseña ha cambiado. Vuelve a entrar.");
    throw new Error("No autorizado");
  }
  if (!res.ok) throw new Error((data && data.error) || "Error del servidor (" + res.status + ")");
  return data;
}

/* ---------------- login ---------------- */
async function checkKey(key) {
  const res = await fetch(API + "/api/auth/check", { headers: { "x-admin-key": key } });
  if (res.ok) return { ok: true };
  let msg = "Contraseña incorrecta.";
  try { const d = await res.json(); if (d && d.error) msg = d.error; } catch (e) {}
  return { ok: false, msg };
}

async function onLogin(e) {
  e.preventDefault();
  const key = $("loginKey").value;
  const btn = $("loginBtn");
  const err = $("loginError");
  err.textContent = "";
  btn.disabled = true;
  btn.textContent = "Comprobando…";
  try {
    const r = await checkKey(key);
    if (!r.ok) {
      err.textContent = r.msg;
      $("loginForm").classList.remove("shake"); void $("loginForm").offsetWidth; $("loginForm").classList.add("shake");
      $("loginKey").select();
      return;
    }
    state.key = key;
    try {
      sessionStorage.setItem("bbAdminKey", key);
      if ($("rememberMe").checked) localStorage.setItem("bbAdminKey", key);
      else localStorage.removeItem("bbAdminKey");
    } catch (e) {}
    enterApp();
  } catch (ex) {
    err.textContent = "No se pudo conectar con el servidor. Si acaba de despertar, espera unos segundos y vuelve a intentarlo.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

function logout(msg) {
  state.key = "";
  state.orders = state.products = state.coupons = [];
  try { sessionStorage.removeItem("bbAdminKey"); localStorage.removeItem("bbAdminKey"); } catch (e) {}
  $("orderList").innerHTML = $("productList").innerHTML = $("couponList").innerHTML = "";
  $("appView").hidden = true;
  $("loginView").hidden = false;
  $("loginKey").value = "";
  $("loginError").textContent = msg || "";
  $("loginKey").focus();
}

function enterApp() {
  $("loginView").hidden = true;
  $("appView").hidden = false;
  const fromHash = location.hash.replace("#", "");
  showTab(["pedidos", "productos", "cupones"].includes(fromHash) ? fromHash : "pedidos");
  loadOrders();
  loadProducts();
  loadCoupons();
}

/* ---------------- pestañas ---------------- */
function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + tab));
  history.replaceState(null, "", "#" + tab);
}

/* ================= PEDIDOS ================= */
async function loadOrders() {
  try {
    state.orders = await api("/api/orders");
    renderOrders();
  } catch (e) {
    if (state.key) toast(e.message, "error");
  }
}

function renderOrders() {
  const orders = state.orders;
  const paid = orders.filter((o) => o.payment_status === "pagado" && o.status !== "cancelado");
  const pending = orders.filter((o) => ["pagado", "preparando"].includes(o.status));
  const month = new Date().toISOString().slice(0, 7);
  const monthSales = paid.filter((o) => (o.created_at || "").startsWith(month)).reduce((s, o) => s + orderTotal(o), 0);
  $("orderStats").innerHTML = `
    <div class="stat"><div class="stat-label">Pedidos totales</div><div class="stat-value">${orders.length}</div></div>
    <div class="stat"><div class="stat-label">Por preparar</div><div class="stat-value">${pending.length}</div></div>
    <div class="stat"><div class="stat-label">Pagados</div><div class="stat-value">${paid.length}</div></div>
    <div class="stat"><div class="stat-label">Ventas este mes</div><div class="stat-value">${money(monthSales)}</div></div>`;
  const badge = $("badgeOrders");
  badge.hidden = pending.length === 0;
  badge.textContent = pending.length;

  const q = $("orderSearch").value.trim().toLowerCase();
  const f = $("orderFilter").value;
  const list = orders.filter((o) => {
    if (f && o.status !== f) return false;
    if (!q) return true;
    return [o.id, o.customer && o.customer.name, o.customer && o.customer.phone, o.customer && o.customer.email]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });
  const wrap = $("orderList");
  if (!list.length) {
    wrap.innerHTML = `<div class="empty">${orders.length ? "Ningún pedido coincide con el filtro." : "Todavía no hay pedidos."}</div>`;
    return;
  }
  wrap.innerHTML = list.map(orderCard).join("");
  wrap.querySelectorAll("[data-label]").forEach((b) => b.addEventListener("click", () => buyLabel(b.dataset.label, b)));
  wrap.querySelectorAll("[data-status]").forEach((s) => s.addEventListener("change", () => setStatus(s.dataset.status, s.value)));
}

function orderTotal(o) {
  if (typeof o.total === "number") return o.total;
  return (o.items_total || 0) - (o.discount || 0) + ((o.shipping && o.shipping.amount) || 0);
}

function orderCard(o) {
  const c = o.customer || {}, a = o.address || {}, sh = o.shipping || {};
  const items = (o.items || [])
    .map((i) => `<li><span>${esc(i.qty)} × ${esc(i.en || i.name)} <span style="color:var(--dim)">(${esc(i.size)})</span></span><span>${money(i.price * i.qty)}</span></li>`)
    .join("");
  const statusOpts = Object.entries(STATUS_LABELS)
    .map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`).join("");
  return `
  <article class="order-card">
    <div class="order-top">
      <div><div class="order-id">${esc(o.id)}</div><div class="order-date">${fmtDate(o.created_at)}</div></div>
      <span class="pill ${esc(o.status)}">${esc(STATUS_LABELS[o.status] || o.status)}</span>
    </div>
    <div><div class="sec-label">Cliente</div>${esc(c.name)} · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>${c.email ? " · " + esc(c.email) : ""}</div>
    <div><div class="sec-label">Dirección</div>${esc(a.street1)}${a.street2 ? ", " + esc(a.street2) : ""}<br>${esc(a.zip)} ${esc(a.city)} · ${esc(a.country)}</div>
    <div><div class="sec-label">Productos</div><ul class="order-items">${items}</ul></div>
    ${o.notes ? `<div><div class="sec-label">Notas</div>${esc(o.notes)}</div>` : ""}
    <div class="order-sums">
      <div><span>Subtotal</span><span>${money(o.items_total)}</span></div>
      ${o.discount ? `<div class="disc"><span>Cupón ${esc(o.coupon && o.coupon.code)}</span><span>−${money(o.discount)}</span></div>` : ""}
      <div><span>Envío · ${esc(sh.carrier)} ${esc(sh.service)}</span><span>${money(sh.amount)}</span></div>
      <div class="tot"><span>Total</span><span>${money(orderTotal(o))}</span></div>
    </div>
    <div class="order-actions">
      <select data-status="${esc(o.id)}" aria-label="Cambiar estado">${statusOpts}</select>
      ${o.label
        ? `<a class="label-link" href="${esc(o.label.label_url)}" target="_blank" rel="noopener">Etiqueta PDF · ${esc(o.label.tracking_number)}</a>`
        : `<button class="btn btn-ghost btn-sm" data-label="${esc(o.id)}">Comprar etiqueta</button>`}
    </div>
  </article>`;
}

async function setStatus(id, status) {
  try {
    const updated = await api(`/api/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: { status } });
    state.orders = state.orders.map((o) => (o.id === id ? updated : o));
    renderOrders();
    toast("Estado actualizado.");
  } catch (e) {
    toast(e.message, "error");
    renderOrders();
  }
}

async function buyLabel(id, btn) {
  if (!confirm("¿Comprar la etiqueta de envío? Se cobrará en tu cuenta de Shippo.")) return;
  btn.disabled = true;
  btn.textContent = "Comprando…";
  try {
    const updated = await api(`/api/orders/${encodeURIComponent(id)}/label`, { method: "POST" });
    state.orders = state.orders.map((o) => (o.id === id ? updated : o));
    renderOrders();
    toast("Etiqueta comprada.");
  } catch (e) {
    toast(e.message, "error");
    btn.disabled = false;
    btn.textContent = "Comprar etiqueta";
  }
}

/* ================= PRODUCTOS ================= */
async function loadProducts() {
  try {
    const res = await fetch(API + "/api/products", { cache: "no-store" });
    state.products = await res.json();
    renderProducts();
  } catch (e) {
    toast("No se pudo cargar el catálogo.", "error");
  }
}

function renderProducts() {
  const q = $("productSearch").value.trim().toLowerCase();
  const cat = $("productCatFilter").value;
  const st = $("productStockFilter").value;
  const list = state.products.filter((p) => {
    if (cat && p.cat !== cat) return false;
    const inStock = p.inStock !== false;
    if (st === "in" && !inStock) return false;
    if (st === "out" && inStock) return false;
    return !q || (p.name || "").toLowerCase().includes(q) || (p.en || "").toLowerCase().includes(q);
  });
  $("productCount").textContent = `(${state.products.length})`;
  const wrap = $("productList");
  if (!list.length) {
    wrap.innerHTML = `<div class="empty">No hay productos que coincidan.</div>`;
    return;
  }
  wrap.innerHTML = list.map((p) => {
    const inStock = p.inStock !== false;
    const catLabel = (CATEGORIES.find((c) => c.id === p.cat) || {}).label || p.cat;
    return `
    <article class="p-card ${inStock ? "" : "out"}">
      <div class="p-photo">
        ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<div class="no-photo">Sin foto</div>`}
        ${inStock ? "" : `<span class="pill cancelado">Agotado</span>`}
      </div>
      <div class="p-body">
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-en">${esc(p.en)}</div>
        <div class="p-meta">${esc(catLabel)} · ${esc(p.size)}${p.pack ? " · " + esc(p.pack) : ""}</div>
        <div class="p-price">${money(p.price)}</div>
        <div class="p-actions">
          <button class="btn btn-ghost" data-edit="${esc(p.id)}">Editar</button>
          <button class="btn btn-ghost" data-stock="${esc(p.id)}">${inStock ? "Agotar" : "Reponer"}</button>
        </div>
      </div>
    </article>`;
  }).join("");
  wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openProduct(b.dataset.edit)));
  wrap.querySelectorAll("[data-stock]").forEach((b) => b.addEventListener("click", () => toggleStock(b.dataset.stock, b)));
}

async function toggleStock(id, btn) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return;
  btn.disabled = true;
  try {
    const updated = await api(`/api/products/${encodeURIComponent(id)}`, { method: "PUT", body: { inStock: p.inStock === false } });
    state.products = state.products.map((x) => (x.id === id ? updated : x));
    renderProducts();
    toast(updated.inStock ? "Producto disponible otra vez." : "Producto marcado como agotado.");
  } catch (e) {
    toast(e.message, "error");
    btn.disabled = false;
  }
}

function openModal(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeModal(id) { $(id).hidden = true; document.body.style.overflow = ""; }

function setPreview(url) {
  $("fImageUrl").value = url || "";
  $("preview").hidden = !url;
  $("photoPlaceholder").hidden = !!url;
  if (url) $("preview").src = url;
}

function openProduct(id) {
  const p = id ? state.products.find((x) => x.id === id) : null;
  $("productForm").reset();
  $("uploadStatus").textContent = "";
  $("editId").value = p ? p.id : "";
  $("productFormTitle").textContent = p ? "Editar producto" : "Nuevo producto";
  $("deleteProductBtn").hidden = !p;
  $("fName").value = p ? p.name : "";
  $("fEn").value = p ? p.en : "";
  $("fCat").value = p ? p.cat : CATEGORIES[0].id;
  $("fSize").value = p ? p.size : "";
  $("fPrice").value = p ? p.price : "";
  $("fPack").value = p && p.pack ? p.pack : "";
  $("fStock").checked = p ? p.inStock !== false : true;
  setPreview(p && p.image);
  openModal("productModal");
  $("fName").focus();
}

async function uploadImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = $("uploadStatus");
  status.textContent = "Subiendo imagen…";
  $("saveProductBtn").disabled = true;
  try {
    const fd = new FormData();
    fd.append("image", file);
    const data = await api("/api/products/upload-image", { method: "POST", form: fd });
    setPreview(data.url);
    status.textContent = "Imagen subida ✓";
  } catch (err) {
    status.textContent = "";
    toast(err.message || "No se pudo subir la imagen.", "error");
  } finally {
    $("saveProductBtn").disabled = false;
  }
}

async function saveProduct(e) {
  e.preventDefault();
  const id = $("editId").value;
  const body = {
    name: $("fName").value.trim(),
    en: $("fEn").value.trim(),
    cat: $("fCat").value,
    size: $("fSize").value.trim(),
    price: $("fPrice").value,
    pack: $("fPack").value.trim() || null,
    image: $("fImageUrl").value || null,
    inStock: $("fStock").checked,
  };
  const btn = $("saveProductBtn");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    const saved = await api(id ? `/api/products/${encodeURIComponent(id)}` : "/api/products", { method: id ? "PUT" : "POST", body });
    if (id) state.products = state.products.map((x) => (x.id === id ? saved : x));
    else state.products.push(saved);
    renderProducts();
    closeModal("productModal");
    toast(id ? "Producto guardado." : "Producto añadido.");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
}

async function deleteProduct() {
  const id = $("editId").value;
  const p = state.products.find((x) => x.id === id);
  if (!p || !confirm(`¿Borrar "${p.en}" del catálogo? No se puede deshacer.`)) return;
  try {
    await api(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.products = state.products.filter((x) => x.id !== id);
    renderProducts();
    closeModal("productModal");
    toast("Producto borrado.");
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ================= CUPONES ================= */
async function loadCoupons() {
  try {
    state.coupons = await api("/api/coupons");
    renderCoupons();
  } catch (e) {
    if (state.key) toast(e.message, "error");
  }
}

function couponValue(c) {
  return c.type === "percent" ? `−${c.value}%` : `−${money(c.value)}`;
}

function renderCoupons() {
  const wrap = $("couponList");
  if (!state.coupons.length) {
    wrap.innerHTML = `<div class="empty">Aún no hay cupones. Crea el primero para tu próximo evento (Dashain, Tihar, Navidad…).</div>`;
    return;
  }
  wrap.innerHTML = state.coupons.map((c) => {
    const dates = c.startsAt || c.endsAt
      ? `${c.startsAt ? "Del " + fmtDay(c.startsAt) : "Desde ya"} ${c.endsAt ? "al " + fmtDay(c.endsAt) : "· sin fecha fin"}`
      : "Sin fechas";
    return `
    <article class="c-card">
      <div class="c-top">
        <div>
          <div class="c-event">${esc(c.event || "Cupón")}${c.public ? `<span class="c-public">· anunciado</span>` : ""}</div>
          <div class="c-code">${esc(c.code)}</div>
        </div>
        <span class="pill ${esc(c.status)}">${esc(c.status)}</span>
      </div>
      <div class="c-value">${couponValue(c)}</div>
      <div class="c-meta">
        <span>${esc(dates)}</span>
        <span>${c.minOrder ? "Pedido mínimo " + money(c.minOrder) : "Sin pedido mínimo"}</span>
        <span>Usado ${c.uses || 0}${c.maxUses ? " de " + c.maxUses : ""} ${(c.uses || 0) === 1 ? "vez" : "veces"}</span>
      </div>
      <div class="c-actions">
        <button class="btn btn-ghost" data-cedit="${esc(c.id)}">Editar</button>
        <button class="btn btn-ghost" data-ctoggle="${esc(c.id)}">${c.active ? "Pausar" : "Activar"}</button>
        <button class="btn btn-ghost" data-ccopy="${esc(c.code)}">Copiar</button>
      </div>
    </article>`;
  }).join("");
  wrap.querySelectorAll("[data-cedit]").forEach((b) => b.addEventListener("click", () => openCoupon(b.dataset.cedit)));
  wrap.querySelectorAll("[data-ctoggle]").forEach((b) => b.addEventListener("click", () => toggleCoupon(b.dataset.ctoggle, b)));
  wrap.querySelectorAll("[data-ccopy]").forEach((b) => b.addEventListener("click", () => {
    try { navigator.clipboard.writeText(b.dataset.ccopy); toast("Código copiado: " + b.dataset.ccopy); } catch (e) {}
  }));
}

function syncTypeLabel() {
  const type = document.querySelector("input[name=cType]:checked").value;
  $("cValueLabel").textContent = type === "percent" ? "Descuento (%)" : "Descuento (€)";
  $("cValue").max = type === "percent" ? 90 : "";
}

function openCoupon(id) {
  const c = id ? state.coupons.find((x) => x.id === id) : null;
  $("couponForm").reset();
  $("cId").value = c ? c.id : "";
  $("couponFormTitle").textContent = c ? "Editar cupón" : "Nuevo cupón";
  $("deleteCouponBtn").hidden = !c;
  $("cEvent").value = c ? c.event || "" : "";
  $("cCode").value = c ? c.code : "";
  document.querySelector(`input[name=cType][value=${c ? c.type : "percent"}]`).checked = true;
  $("cValue").value = c ? c.value : "";
  $("cStart").value = c && c.startsAt ? c.startsAt : "";
  $("cEnd").value = c && c.endsAt ? c.endsAt : "";
  $("cMin").value = c && c.minOrder ? c.minOrder : "";
  $("cMax").value = c && c.maxUses ? c.maxUses : "";
  $("cActive").checked = c ? c.active : true;
  $("cPublic").checked = c ? !!c.public : false;
  syncTypeLabel();
  openModal("couponModal");
  $("cEvent").focus();
}

function generateCode() {
  const base = ($("cEvent").value || "PROMO")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "PROMO";
  const v = $("cValue").value ? String(Math.round(Number($("cValue").value))) : String(Math.floor(Math.random() * 90 + 10));
  $("cCode").value = base + v;
}

async function saveCoupon(e) {
  e.preventDefault();
  const id = $("cId").value;
  const body = {
    event: $("cEvent").value.trim(),
    code: $("cCode").value.trim(),
    type: document.querySelector("input[name=cType]:checked").value,
    value: $("cValue").value,
    startsAt: $("cStart").value || null,
    endsAt: $("cEnd").value || null,
    minOrder: $("cMin").value || 0,
    maxUses: $("cMax").value || 0,
    active: $("cActive").checked,
    public: $("cPublic").checked,
  };
  try {
    await api(id ? `/api/coupons/${encodeURIComponent(id)}` : "/api/coupons", { method: id ? "PUT" : "POST", body });
    closeModal("couponModal");
    toast(id ? "Cupón guardado." : "Cupón creado.");
    loadCoupons();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function toggleCoupon(id, btn) {
  const c = state.coupons.find((x) => x.id === id);
  if (!c) return;
  btn.disabled = true;
  try {
    await api(`/api/coupons/${encodeURIComponent(id)}`, { method: "PUT", body: { active: !c.active } });
    toast(c.active ? "Cupón pausado." : "Cupón activado.");
    loadCoupons();
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
}

async function deleteCoupon() {
  const id = $("cId").value;
  const c = state.coupons.find((x) => x.id === id);
  if (!c || !confirm(`¿Borrar el cupón ${c.code}?`)) return;
  try {
    await api(`/api/coupons/${encodeURIComponent(id)}`, { method: "DELETE" });
    closeModal("couponModal");
    toast("Cupón borrado.");
    loadCoupons();
  } catch (err) {
    toast(err.message, "error");
  }
}

/* ---------------- arranque ---------------- */
function init() {
  $("fCat").innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  $("productCatFilter").innerHTML = `<option value="">Todas las categorías</option>` + CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");

  $("loginForm").addEventListener("submit", onLogin);
  $("logoutBtn").addEventListener("click", () => logout());
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

  $("reloadOrders").addEventListener("click", loadOrders);
  $("orderSearch").addEventListener("input", renderOrders);
  $("orderFilter").addEventListener("change", renderOrders);

  $("newProductBtn").addEventListener("click", () => openProduct(null));
  $("productSearch").addEventListener("input", renderProducts);
  $("productCatFilter").addEventListener("change", renderProducts);
  $("productStockFilter").addEventListener("change", renderProducts);
  $("productForm").addEventListener("submit", saveProduct);
  $("fImageFile").addEventListener("change", uploadImage);
  $("deleteProductBtn").addEventListener("click", deleteProduct);

  $("newCouponBtn").addEventListener("click", () => openCoupon(null));
  $("couponForm").addEventListener("submit", saveCoupon);
  $("genCode").addEventListener("click", generateCode);
  $("deleteCouponBtn").addEventListener("click", deleteCoupon);
  document.querySelectorAll("input[name=cType]").forEach((r) => r.addEventListener("change", syncTypeLabel));

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.closest(".modal-wrap").id)));
  document.querySelectorAll(".modal-wrap").forEach((w) => w.addEventListener("click", (e) => { if (e.target === w) closeModal(w.id); }));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal-wrap:not([hidden])").forEach((w) => closeModal(w.id));
  });

  // Sesión guardada: se vuelve a comprobar con el servidor ANTES de enseñar nada.
  let saved = "";
  try { saved = sessionStorage.getItem("bbAdminKey") || localStorage.getItem("bbAdminKey") || ""; } catch (e) {}
  if (saved) {
    checkKey(saved)
      .then((r) => {
        if (r.ok) { state.key = saved; enterApp(); }
        else logout();
      })
      .catch(() => {});
  }
}

init();
