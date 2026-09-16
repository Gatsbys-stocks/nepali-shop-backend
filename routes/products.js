const express = require("express");
const multer = require("multer");
const router = express.Router();
const { readAll, getProduct, addProduct, updateProduct, deleteProduct } = require("../lib/products");
const { uploadImageBuffer, isConfigured } = require("../lib/cloudinary");

// Images arrive as multipart/form-data and are held in memory just long
// enough to stream them to Cloudinary — nothing touches disk. 5 MB is plenty
// for a product photo and keeps the admin panel snappy on a phone connection.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
}

function validateProductBody(body, { partial } = {}) {
  const required = ["name", "en", "cat", "size", "price"];
  for (const field of required) {
    if (!partial && (body[field] === undefined || body[field] === "")) {
      return `Falta el campo "${field}".`;
    }
  }
  if (body.price !== undefined && isNaN(Number(body.price))) {
    return "El precio debe ser un número.";
  }
  return null;
}

// GET /api/products — public, the storefront loads the whole catalog on open.
router.get("/", (req, res) => {
  res.json(readAll());
});

// POST /api/products/upload-image  (admin only)
// multipart/form-data with a single "image" file field.
// Returns { url } — a Cloudinary URL ready to save on a product.
router.post("/upload-image", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(500).json({ error: "Cloudinary no está configurado en el servidor todavía." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No se ha recibido ninguna imagen." });
    }
    const url = await uploadImageBuffer(req.file.buffer);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo subir la imagen.", detail: String(err.message || err) });
  }
});

// POST /api/products  (admin only) — create a product.
router.post("/", requireAdmin, (req, res) => {
  const error = validateProductBody(req.body);
  if (error) return res.status(400).json({ error });
  const product = addProduct(req.body);
  res.status(201).json(product);
});

// PUT /api/products/:id  (admin only) — update any subset of fields.
router.put("/:id", requireAdmin, (req, res) => {
  const error = validateProductBody(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  if (!getProduct(req.params.id)) return res.status(404).json({ error: "Producto no encontrado." });
  const updated = updateProduct(req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/products/:id  (admin only)
router.delete("/:id", requireAdmin, (req, res) => {
  const ok = deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "Producto no encontrado." });
  res.json({ ok: true });
});

module.exports = router;
