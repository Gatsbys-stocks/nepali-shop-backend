const nodemailer = require("nodemailer");

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function notifyShopOfNewOrder(order) {
  const transport = getTransport();
  if (!transport) {
    console.log("[email] SMTP not configured — skipping shop notification for", order.id);
    return;
  }
  const lines = order.items
    .map((it) => `- ${it.name} / ${it.en} (${it.size}) x${it.qty} = ${it.qty * it.price} EUR`)
    .join("\n");

  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.NOTIFY_EMAIL,
    subject: `Nuevo pedido ${order.id} — ${order.customer.name}`,
    text: `Nuevo pedido recibido.

Pedido: ${order.id}
Cliente: ${order.customer.name}
Teléfono: ${order.customer.phone}
Email: ${order.customer.email || "-"}

Dirección de envío:
${order.address.street1}
${order.address.city}, ${order.address.zip}
${order.address.country}

Productos:
${lines}

Subtotal productos: ${order.items_total.toFixed(2)} EUR
Transportista elegido: ${order.shipping.carrier} - ${order.shipping.service}
Coste de envío: ${order.shipping.amount} ${order.shipping.currency}
TOTAL: ${(order.items_total + order.shipping.amount).toFixed(2)} EUR

Notas del cliente: ${order.notes || "-"}
`,
  });
}

async function confirmToCustomer(order) {
  const transport = getTransport();
  if (!transport || !order.customer.email) return;
  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: order.customer.email,
    subject: `Hemos recibido tu pedido ${order.id} — Buddhabhumi`,
    text: `Hola ${order.customer.name},

Hemos recibido tu pedido ${order.id}. Te contactaremos para confirmar el pago.

Total (productos + envío ${order.shipping.carrier} ${order.shipping.service}): ${(
      order.items_total + order.shipping.amount
    ).toFixed(2)} EUR

Gracias por tu compra,
Buddhabhumi — Nepali Products Barcelona
`,
  });
}

module.exports = { notifyShopOfNewOrder, confirmToCustomer };
