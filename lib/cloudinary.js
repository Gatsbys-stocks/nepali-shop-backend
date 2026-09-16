// Uploads product photos to Cloudinary instead of the local disk. Render's
// filesystem is ephemeral (wiped on redeploy/restart on the free/standard
// plans), so anything the client uploads through the admin panel needs to
// live somewhere that survives that — Cloudinary's free tier is more than
// enough for a small shop's product photos and gives us a CDN URL for free.
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

// Uploads a Buffer (from multer's memory storage) and resolves to the
// Cloudinary secure_url of the stored image.
function uploadImageBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "buddhabhumi-products", resource_type: "image" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { uploadImageBuffer, isConfigured };
