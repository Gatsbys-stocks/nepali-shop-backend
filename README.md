# Backend de envíos — Nepali Products Barcelona

Este backend hace dos cosas:
1. Pide **tarifas de envío en tiempo real** a Shippo (que a su vez habla con UPS, DHL, DHL eCommerce, FedEx, USPS...).
2. Guarda los **pedidos** y te avisa por email — y te deja comprar la **etiqueta real** de envío desde una página de administración.

Tu tienda (el archivo `.html`) llama a este backend por internet; por eso hay que desplegarlo en algún sitio con URL pública. No hace falta que sea caro: el plan gratuito de Render es suficiente para empezar.

---

## 1. Crea tu cuenta de Shippo (gratis)

1. Regístrate en https://goshippo.com
2. Ve a **Settings → API** y copia tu **Test Token** (empieza por `shippo_test_...`). Úsalo mientras pruebas; cuando quieras cobrar de verdad, cambia al Live Token (`shippo_live_...`).
3. Ve a **Settings → Carrier Accounts** y conecta las transportistas que realmente uses desde España:
   - **DHL Express** — necesitas número de cuenta DHL (se pide en dhl.com/es)
   - **UPS** — necesitas cuenta UPS
   - **FedEx** — necesitas cuenta FedEx
   - **DHL eCommerce** — normalmente para paquetería a EE.UU./internacional de bajo coste; comprueba disponibilidad para envíos con origen España en el panel de Shippo
   - **USPS** — es el servicio postal de EE.UU.; solo tiene sentido si algún día envías paquetes *desde* EE.UU., no desde Barcelona. Lo dejamos integrado en el código por si acaso, pero no lo actives para tu caso actual.

   **Importante:** hasta que no conectes al menos una transportista aquí, `/api/rates` no devolverá ninguna tarifa real — este paso es obligatorio y se hace una sola vez desde la web de Shippo, no desde el código.

---

## 2. Configura las variables de entorno

Copia `.env.example` a `.env` y rellena:

```
cp .env.example .env
```

Los campos más importantes:
- `SHIPPO_API_KEY` → el token del paso 1
- `SHOP_STREET1`, `SHOP_CITY`, `SHOP_ZIP` → la dirección real desde la que envías (C/ Industria 124, Barcelona, 08025 ya viene puesta)
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` → tu cuenta de correo para que te lleguen los avisos de pedido. Con Gmail: activa la verificación en 2 pasos y crea una "contraseña de aplicación" en https://myaccount.google.com/apppasswords
- `ADMIN_KEY` → invéntate una contraseña larga; la necesitarás para ver los pedidos

---

## 3. Pruébalo en tu ordenador (opcional pero recomendado)

```
cd nepali-shop-backend
npm install
npm start
```

Debería decir `Nepali shop backend listening on port 3000`. Prueba:

```
curl http://localhost:3000/health
```

---

## 4. Despliega el backend (gratis, con Render)

1. Sube esta carpeta `nepali-shop-backend` a un repositorio de GitHub.
2. Ve a https://render.com → **New → Web Service** → conecta tu repositorio.
3. Configuración:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. En la pestaña **Environment**, añade todas las variables de tu `.env` (Render no lee el archivo `.env`, hay que pegarlas ahí una a una).
5. Despliega. Render te da una URL tipo `https://tu-tienda-backend.onrender.com`.

(Alternativas equivalentes: Railway, Fly.io, un VPS propio con PM2 — la app es un Express normal, funciona en cualquiera.)

**Nota sobre el plan gratuito de Render:** el servicio "se duerme" tras 15 min sin uso y tarda ~30s en despertar con la primera petición. Para una tienda pequeña está bien; si quieres respuesta instantánea siempre, pasa al plan de pago (7$/mes).

---

## 5. Conecta tu tienda HTML con el backend

Abre tu archivo de la tienda y busca esta línea, cerca del principio del `<script>`:

```js
const API_BASE_URL = "https://YOUR-BACKEND-URL.onrender.com";
```

Cámbiala por la URL real que te dio Render. Vuelve a subir el HTML a donde lo tengas alojado (o simplemente ábrelo — funciona igual como archivo local).

También en `.env`, pon `ALLOWED_ORIGIN` con la URL exacta donde esté publicada tu tienda (o déjalo en `*` mientras pruebas).

---

## 6. Ver pedidos y comprar etiquetas

Abre `public/admin.html` (o `https://tu-backend.onrender.com/admin.html`), pon tu `ADMIN_KEY` y la URL del backend, y pulsa "Cargar pedidos". Desde ahí, cuando quieras enviar un pedido, pulsa **"Comprar etiqueta"** — esto carga el saldo de tu cuenta Shippo y genera el PDF de la etiqueta real de la transportista elegida por el cliente.

**Sobre el pago de las etiquetas:** Shippo cobra el coste de la etiqueta a tu método de pago en Shippo (tarjeta) cuando la compras — es lo mismo que pagarías directamente a DHL/UPS/FedEx, solo que centralizado. Asegúrate de tener saldo/tarjeta configurada en tu cuenta Shippo antes de comprar etiquetas de verdad.

---

## 7. Añade el pago con tarjeta (Stripe)

1. Ve a https://dashboard.stripe.com/test/apikeys (asegúrate de estar en modo **Test** arriba a la derecha) y copia la **Secret key** (`sk_test_...`).
2. En Render, añade la variable `STRIPE_SECRET_KEY` con ese valor.
3. Añade también `STORE_URL` con la URL exacta donde tienes publicada la tienda (por ejemplo `https://tu-usuario.github.io/tu-repo/`) — es a donde Stripe devuelve al cliente después de pagar.
4. Ve a https://dashboard.stripe.com/test/webhooks → **Add endpoint**. En "Endpoint URL" pon: `https://tu-backend.onrender.com/api/webhook/stripe`. En "Events to send", busca y marca **checkout.session.completed**. Guarda.
5. Stripe te muestra un **"Signing secret"** (`whsec_...`) para ese endpoint — cópialo y añádelo en Render como `STRIPE_WEBHOOK_SECRET`.
6. Guarda y despliega de nuevo en Render.

**Cómo probarlo sin gastar dinero real:** en modo Test, Stripe acepta un número de tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC. Haz un pedido completo en la tienda y usa esa tarjeta — el pedido debería marcarse como "pagado" automáticamente y te debería llegar un email de confirmación de pago.

**Cuando quieras cobrar de verdad:** en Stripe, cambia del modo Test al modo Live (interruptor arriba a la derecha), repite los pasos 1 y 4 para conseguir una `sk_live_...` y un `whsec_...` de producción, y actualiza esas dos variables en Render.


- **Cobro con tarjeta**: ahora mismo el cliente confirma el pedido pero no paga en la web — le llega un email para acordar el pago. Si quieres cobro automático, el siguiente paso es añadir Stripe Checkout (que ya se avisaba en el HTML original) usando el total (productos + envío elegido) que ya calcula este backend.
- **Seguimiento del pedido**: la tabla de `admin.html` ya guarda el `tracking_number` en cuanto compras la etiqueta; solo faltaría un email automático al cliente con ese número (fácil de añadir en `lib/email.js`).
