const express = require("express");
const router = express.Router();
const { getRates } = require("../lib/shippo");
const { parcelWeightGrams } = require("../lib/weight");

// POST /api/rates
// body: { address: {name, street1, city, zip, country, phone, email}, items: [{size, qty}] }
router.post("/", async (req, res) => {
  try {
    const { address, items } = req.body;
    if (!address || !address.street1 || !address.city || !address.zip || !address.country) {
      return res.status(400).json({ error: "Dirección incompleta." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    const weight = parcelWeightGrams(items);
    const { shipment_id, rates } = await getRates({ addressTo: address, parcelWeightGrams: weight });

    if (rates.length === 0) {
      return res.status(200).json({
        shipment_id,
        rates: [],
        warning:
          "Shippo no devolvió tarifas. Comprueba que tengas al menos una cuenta de transportista (UPS/DHL/FedEx/USPS) conectada en tu panel de Shippo para este destino.",
      });
    }

    res.json({ shipment_id, rates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron calcular las tarifas de envío.", detail: String(err.message || err) });
  }
});

module.exports = router;
