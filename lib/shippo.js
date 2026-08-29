const { Shippo } = require("shippo");

const shippo = new Shippo({ apiKeyHeader: process.env.SHIPPO_API_KEY });

function shopAddress() {
  return {
    name: process.env.SHOP_NAME,
    street1: process.env.SHOP_STREET1,
    city: process.env.SHOP_CITY,
    zip: process.env.SHOP_ZIP,
    country: process.env.SHOP_COUNTRY,
    phone: process.env.SHOP_PHONE,
    email: process.env.SHOP_EMAIL,
  };
}

// Builds a shipment and asks Shippo for rates from every carrier account
// connected to your Shippo dashboard (UPS, DHL Express, DHL eCommerce, FedEx,
// USPS, etc.). Rates only come back for carriers you've actually connected —
// see the README for that one-time setup step.
async function getRates({ addressTo, parcelWeightGrams }) {
  const shipment = await shippo.shipments.create({
    addressFrom: shopAddress(),
    addressTo: {
      name: addressTo.name,
      street1: addressTo.street1,
      city: addressTo.city,
      zip: addressTo.zip,
      country: addressTo.country, // ISO-2 code, e.g. "ES", "FR", "US"
      phone: addressTo.phone,
      email: addressTo.email,
    },
    parcels: [
      {
        length: "30",
        width: "20",
        height: "15",
        distanceUnit: "cm",
        weight: String(Math.round(parcelWeightGrams)),
        massUnit: "g",
      },
    ],
    async: false,
  });

  const rates = (shipment.rates || []).map((r) => ({
    rate_id: r.objectId,
    carrier: r.provider,
    service: r.servicelevel ? r.servicelevel.name : r.servicelevelName,
    amount: parseFloat(r.amount),
    currency: r.currency,
    estimated_days: r.estimatedDays,
  }));

  rates.sort((a, b) => a.amount - b.amount);
  return { shipment_id: shipment.objectId, rates };
}

// Buys the actual label for a previously-quoted rate_id.
// Call this once you're ready to fulfil the order (rate_ids expire after a
// while, so quote again if too much time has passed since checkout).
async function buyLabel(rateId) {
  const transaction = await shippo.transactions.create({
    rate: rateId,
    labelFileType: "PDF",
    async: false,
  });
  if (transaction.status !== "SUCCESS") {
    throw new Error(
      "Label purchase failed: " +
        JSON.stringify(transaction.messages || transaction)
    );
  }
  return {
    label_url: transaction.labelUrl,
    tracking_number: transaction.trackingNumber,
    tracking_url: transaction.trackingUrlProvider,
  };
}

module.exports = { getRates, buyLabel, shopAddress };
