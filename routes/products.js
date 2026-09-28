const express = require("express");
const multer = require("multer");
const router = express.Router();
const { readAll, getProduct, addProduct, updateProduct, deleteProduct } = require("../lib/products");
const { uploadImageBuffer, isConfigured } = require("../lib/cloudinary");
const { requireAdmin } = require("../lib/auth");

// Las imágenes llegan como multipart/form-data y se quedan en memoria solo lo
// justo para enviarlas a Cloudinary.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function validateProductBody(body, { partial } = {}) {
  const required = ["name", "en", "cat", "size", "price"];
  for (const field of required) {
    if (!partial && (body[field] === undefined || body[field] === "")) {
      return `Falta el campo "${field}".`;
    }
  }
  if (body.price !== undefined && (isNaN(Number(body.price)) || Number(body.price) < 0)) {
    return "El precio debe ser un número positivo.";
  }
  return null;
}

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Error del servidor." });
  });

// GET /api/products — público, la tienda carga el catálogo entero.
router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(readAll());
});

// POST /api/products/upload-image (admin)
router.post("/upload-image", requireAdmin, upload.single("image"), wrap(async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: "Cloudinary no está configurado en el servidor todavía." });
  }
  if (!req.file) return res.status(400).json({ error: "No se ha recibido ninguna imagen." });
  const url = await uploadImageBuffer(req.file.buffer);
  res.json({ url });
}));

// POST /api/products (admin)
router.post("/", requireAdmin, wrap(async (req, res) => {
  const error = validateProductBody(req.body);
  if (error) return res.status(400).json({ error });
  const product = await addProduct(req.body);
  res.status(201).json(product);
}));

// PUT /api/products/:id (admin)
router.put("/:id", requireAdmin, wrap(async (req, res) => {
  const error = validateProductBody(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  if (!getProduct(req.params.id)) return res.status(404).json({ error: "Producto no encontrado." });
  res.json(await updateProduct(req.params.id, req.body));
}));

// DELETE /api/products/:id (admin)
router.delete("/:id", requireAdmin, wrap(async (req, res) => {
  const ok = await deleteProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "Producto no encontrado." });
  res.json({ ok: true });
}));

module.exports = router;
