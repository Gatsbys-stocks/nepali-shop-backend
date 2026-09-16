# Nepali Shop Backend

API en Node.js/Express que desarrollé para dar servicio de envíos, pedidos, pagos y gestión de catálogo a una tienda online real (Nepali Products Barcelona), integrando transportistas, pasarela de pago y almacenamiento de imágenes.

## El problema que resolví

La tienda es una página estática (HTML/JS), y una página estática no puede calcular tarifas de envío reales, cobrar con tarjeta de forma segura, guardar pedidos ni dejar que el propio dueño del negocio edite su catálogo — todo eso requiere claves privadas y lógica de negocio que no pueden vivir en el navegador. Construí este backend como la pieza intermedia entre la tienda y los proveedores externos (transportistas, pasarela de pago, email, almacenamiento de imágenes) que hace posible una compra de principio a fin y una gestión del catálogo sin tocar código.

## Qué hice

- **Tarifas de envío en tiempo real** — calculo el peso del pedido a partir del carrito y pido precios reales a UPS, DHL, DHL eCommerce, FedEx y USPS a través de la API de [Shippo](https://goshippo.com).
- **Gestión de pedidos** — valido y guardo cada pedido, y disparo emails automáticos de aviso (a la tienda) y confirmación (al cliente).
- **Pagos con tarjeta** — creo la sesión de pago en Stripe y confirmo el pago automáticamente mediante un **webhook con verificación de firma**, sin intervención manual.
- **Gestión del catálogo sin tocar código** — diseñé un CRUD de productos (`/api/products`) y un panel de administración, pensado para móvil, para que el propio cliente del negocio añada, edite y borre productos —incluida la foto—, y marque un producto como agotado con un toque para que la tienda deje de admitir pedidos de él, sin depender de mí para cada cambio.
- **Subida de imágenes desacoplada del servidor** — las fotos que sube el cliente no se guardan en el disco de la instancia (en Render no es persistente entre despliegues); las envío directamente a Cloudinary desde memoria y solo persisto la URL resultante.
- **Panel de administración de pedidos** — vista protegida por clave donde se listan los pedidos y se compra, con un clic, la etiqueta de envío real (PDF de la transportista elegida por el cliente).

## Decisiones técnicas de las que estoy contento

- **Verificación de firma en el webhook de Stripe**: monté la ruta `/api/webhook/stripe` con el *raw body* antes del `express.json()` global, porque Stripe firma el cuerpo sin procesar — un detalle fácil de pasar por alto que rompe la verificación si se hace en el orden equivocado.
- **Separación de responsabilidades**: cada integración externa (Shippo, Stripe, email, Cloudinary, cálculo de peso, persistencia) vive en su propio módulo dentro de `lib/`, y las rutas (`routes/`) solo orquestan — así puedo testear o sustituir cada pieza por separado sin tocar el resto.
- **Autenticación de rutas de administrador** mediante middleware (`x-admin-key`), separando claramente lo público (crear pedido, pedir tarifas, pagar, ver catálogo) de lo privado (listar pedidos, comprar etiquetas, editar el catálogo).
- **Cálculo de peso derivado del catálogo**: convierto automáticamente formatos de producto ("500 gm", "1 kg", "250 ml", "1 ud") a gramos para construir el paquete que se cotiza, sin que el frontend tenga que gestionar esa lógica.
- **Fotos de producto fuera del disco del servidor**: subida por `multer` en memoria (nunca toca el filesystem local) y reenviada a Cloudinary, para que una foto subida hoy no desaparezca en el próximo despliegue.
- **Frontend de los paneles de admin separado en HTML/CSS/JS**: en vez de un único archivo con todo mezclado, cada panel tiene su marcado, sus estilos y su lógica en archivos propios dentro de `public/`, servidos como estáticos — más legible y más fácil de mantener.

## Stack

Node.js · Express · Shippo API · Stripe API (Checkout + Webhooks) · Cloudinary (almacenamiento de imágenes) · Multer · Nodemailer · CORS

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
    ├── /api/orders/:id/label    → Shippo (compra de etiqueta real)
    └── /api/products            → catálogo (lectura pública, edición admin) → Cloudinary (fotos)
```

## Estructura del proyecto

```
server.js            # arranca Express, monta middlewares, rutas y estáticos
routes/
  rates.js            # POST /api/rates
  orders.js           # POST/GET /api/orders, checkout, compra de etiqueta
  webhook.js           # POST /api/webhook/stripe
  products.js          # GET/POST/PUT/DELETE /api/products, subida de fotos
lib/
  shippo.js            # tarifas y compra de etiquetas
  stripe.js            # sesión de pago
  email.js             # notificaciones
  weight.js            # cálculo de peso del paquete
  store.js              # persistencia de pedidos
  products.js           # persistencia del catálogo (JSON)
  cloudinary.js          # subida de fotos de producto
public/
  admin.html              # panel de administración de pedidos
  products-admin.html      # panel de administración del catálogo
  css/
    admin.css               # estilos del panel de pedidos
    products-admin.css       # estilos del panel de catálogo
  js/
    admin.js                 # lógica del panel de pedidos
    products-admin.js         # lógica del panel de catálogo
data/
  orders.json           # pedidos
  products.json          # catálogo
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
| `GET` | `/api/products` | Listar catálogo | Público |
| `POST` | `/api/products` | Crear producto | Admin |
| `PUT` | `/api/products/:id` | Editar producto | Admin |
| `DELETE` | `/api/products/:id` | Borrar producto | Admin |
| `POST` | `/api/products/upload-image` | Subir foto de producto (a Cloudinary) | Admin |
| `GET` | `/health` | Estado del servicio | Público |

## Variables de entorno

```
ADMIN_KEY=
ALLOWED_ORIGIN=
SHIPPO_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
NOTIFY_EMAIL=
SHOP_NAME=
SHOP_EMAIL=
SHOP_PHONE=
SHOP_STREET=
SHOP_CITY=
SHOP_ZIP=
SHOP_COUNTRY=
STORE_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Las tres últimas son para la cuenta gratuita de [Cloudinary](https://cloudinary.com) que uso para las fotos de producto (ver `.env.example`).

## Paneles de administración

- `/admin.html` — pedidos: listado, dirección, productos, total y compra de etiqueta de envío.
- `/products-admin.html` — catálogo: alta, edición y borrado de productos con foto, sin tocar código ni volver a desplegar el frontend.

Ambos se autentican con la misma `ADMIN_KEY` y piden la URL del backend al abrirse.
