# Nepali Shop Backend

API en Node.js/Express que da servicio de envíos, pedidos y pagos a una tienda online real (Nepali Products Barcelona), integrando transportistas, pasarela de pago y notificaciones por email.

## El problema que resuelve

La tienda es una página estática (HTML/JS) que muestra productos, pero una página estática no puede calcular tarifas de envío reales, cobrar con tarjeta de forma segura ni guardar pedidos — eso requiere claves privadas y lógica de negocio que no pueden vivir en el navegador. Este backend cubre esa parte: es el servicio intermedio entre la tienda y los proveedores externos (transportistas, pasarela de pago, email) que hace posible una compra de principio a fin.

## Qué hace

- **Tarifas de envío en tiempo real** — calcula el peso del pedido a partir del carrito y pide precios reales a UPS, DHL, DHL eCommerce, FedEx y USPS a través de la API de [Shippo](https://goshippo.com).
- **Gestión de pedidos** — valida y guarda cada pedido, y dispara emails automáticos de aviso (a la tienda) y confirmación (al cliente).
- **Pagos con tarjeta** — crea la sesión de pago en Stripe y confirma el pago automáticamente mediante un **webhook con verificación de firma**, sin intervención manual.
- **Panel de administración** — vista protegida por clave donde se listan los pedidos y se compra, con un clic, la etiqueta de envío real (PDF de la transportista elegida por el cliente).

## Decisiones técnicas destacables

- **Verificación de firma en el webhook de Stripe**: la ruta `/api/webhook/stripe` se monta con el *raw body* antes del `express.json()` global, porque Stripe firma el cuerpo sin procesar — un detalle fácil de pasar por alto que rompe la verificación si se hace en el orden equivocado.
- **Separación de responsabilidades**: cada integración externa (Shippo, Stripe, email, cálculo de peso, persistencia) vive en su propio módulo dentro de `lib/`, y las rutas (`routes/`) solo orquestan — favorece testear y sustituir cada pieza por separado.
- **Autenticación de rutas de administrador** mediante middleware (`x-admin-key`), separando claramente lo público (crear pedido, pedir tarifas, pagar) de lo privado (listar pedidos, comprar etiquetas).
- **Cálculo de peso derivado del catálogo**: convierte automáticamente formatos de producto ("500 gm", "1 kg", "250 ml", "1 ud") a gramos para construir el paquete que se cotiza, sin que el frontend tenga que gestionar esa lógica.

## Stack

Node.js · Express · Shippo API · Stripe API (Checkout + Webhooks) · Nodemailer · CORS

## Arquitectura

```
Tienda (frontend estático)
        │
        ▼
   Nepali Shop Backend (Express)
    ├── /api/rates      → Shippo   (tarifas multi-transportista)
    ├── /api/orders     → guarda pedido + emails
    ├── /api/orders/:id/checkout → Stripe (sesión de pago)
    ├── /api/webhook/stripe      → confirma el pago (firma verificada)
    └── /api/orders/:id/label    → Shippo (compra de etiqueta real)
```

## Estructura del proyecto

```
server.js            # arranca Express, monta middlewares y rutas
routes/
  rates.js            # POST /api/rates
  orders.js           # POST/GET /api/orders, checkout, compra de etiqueta
  webhook.js           # POST /api/webhook/stripe
lib/
  shippo.js            # tarifas y compra de etiquetas
  stripe.js            # sesión de pago
  email.js             # notificaciones
  weight.js            # cálculo de peso del paquete
  store.js              # persistencia de pedidos
public/admin.html        # panel de administración
```

## Endpoints

| Método | Ruta | Función | Acceso |
|---|---|---|---|
| `POST` | `/api/rates` | Tarifas de envío para una dirección y carrito | Público |
| `POST` | `/api/orders` | Crear pedido | Público |
| `POST` | `/api/orders/:id/checkout` | Sesión de pago con Stripe | Público |
| `GET` | `/api/orders` | Listar pedidos | Admin |
| `POST` | `/api/orders/:id/label` | Comprar etiqueta de envío real | Admin |
| `POST` | `/api/webhook/stripe` | Confirmación de pago (firma verificada) | Stripe |
| `GET` | `/health` | Estado del servicio | Público |
