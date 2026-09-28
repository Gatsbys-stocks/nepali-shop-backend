// Almacenamiento persistente de colecciones JSON (productos, pedidos, cupones).
//
// POR QUÉ EXISTE: el disco de Render (plan gratis) se borra cada vez que el
// servicio se duerme, se reinicia o se redespliega. Antes guardábamos todo en
// data/*.json, así que cualquier producto editado o pedido recibido
// desaparecía al día siguiente. Ahora cada colección vive como un archivo
// JSON privado en Cloudinary (la misma cuenta que ya usamos para las fotos),
// y el servidor mantiene una copia en memoria para responder rápido.
//
// - Al arrancar se descarga cada colección de Cloudinary. Si todavía no existe
//   (primera vez), se usa data/<nombre>.json como punto de partida y se sube.
// - Cada escritura actualiza la memoria y sube el JSON completo a Cloudinary
//   (en cola, una detrás de otra). Las rutas esperan a que termine para
//   devolver error si algo falla, así el admin sabe si se ha guardado.
// - Si Cloudinary no está configurado (desarrollo en local) se usa el disco.
// - Si Cloudinary falla al arrancar, NO se usa el archivo local (podría pisar
//   datos buenos con datos viejos): la colección queda en solo lectura y se
//   reintenta cada 30 s.
const fs = require("fs");
const path = require("path");
const https = require("https");
const cloudinary = require("cloudinary").v2;
const { isConfigured } = require("./cloudinary");

const DATA_DIR = path.join(__dirname, "..", "data");
const REMOTE_FOLDER = process.env.DATA_FOLDER || "nepali-shop-data";

function httpGet(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(httpGet(new URL(res.headers.location, url).toString(), redirects - 1));
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

function readLocalSeed(name, fallback) {
  const file = path.join(DATA_DIR, name + ".json");
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`[db] ${name}: no se pudo leer ${file}`, e.message);
    return fallback;
  }
}

class Collection {
  constructor(name, fallback) {
    this.name = name;
    this.fallback = fallback;
    this.data = JSON.parse(JSON.stringify(fallback));
    this.ready = false;
    this.remote = isConfigured();
    this.publicId = `${REMOTE_FOLDER}/${name}.json`;
    this.queue = Promise.resolve();
  }

  async load() {
    if (!this.remote) {
      this.data = readLocalSeed(this.name, this.fallback);
      this.ready = true;
      console.warn(`[db] ${this.name}: MODO LOCAL (disco) — ${this.count()} registros. ` +
        `Faltan las variables CLOUDINARY_*: en Render los cambios se perderán al reiniciar.`);
      return;
    }
    try {
      const url = cloudinary.utils.private_download_url(this.publicId, undefined, {
        resource_type: "raw",
        type: "private",
      });
      const res = await httpGet(url);
      if (res.status === 200) {
        this.data = JSON.parse(res.body);
        this.ready = true;
        console.log(`[db] ${this.name}: cargado de Cloudinary — ${this.count()} registros`);
      } else if (res.status === 404) {
        this.data = readLocalSeed(this.name, this.fallback);
        await this._upload();
        this.ready = true;
        console.log(`[db] ${this.name}: primera vez, subido desde data/ — ${this.count()} registros`);
      } else {
        throw new Error(`Cloudinary respondió ${res.status}: ${res.body.slice(0, 200)}`);
      }
    } catch (e) {
      console.error(`[db] ${this.name}: no se pudo cargar, reintento en 30 s —`, e.message);
      setTimeout(() => this.load(), 30000);
    }
  }

  count() {
    return Array.isArray(this.data) ? this.data.length : Object.keys(this.data || {}).length;
  }

  _upload() {
    const buffer = Buffer.from(JSON.stringify(this.data, null, 2), "utf-8");
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          type: "private",
          public_id: this.publicId,
          overwrite: true,
          invalidate: true,
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
  }

  get() {
    return this.data;
  }

  // Aplica `mutator(data)` y guarda. Devuelve lo que devuelva el mutator.
  // Las escrituras van en cola para que dos cambios seguidos no se pisen.
  update(mutator) {
    const run = async () => {
      if (!this.ready) {
        const err = new Error("La base de datos todavía se está cargando. Prueba en unos segundos.");
        err.status = 503;
        throw err;
      }
      const backup = JSON.stringify(this.data);
      const result = mutator(this.data);
      try {
        if (this.remote) await this._upload();
        else fs.writeFileSync(path.join(DATA_DIR, this.name + ".json"), JSON.stringify(this.data, null, 2));
      } catch (e) {
        this.data = JSON.parse(backup); // no dejar en memoria algo que no se guardó
        console.error(`[db] ${this.name}: error al guardar`, e.message || e);
        const err = new Error("No se pudo guardar en el servidor. Inténtalo otra vez.");
        err.status = 500;
        throw err;
      }
      return result;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }
}

const products = new Collection("products", []);
const orders = new Collection("orders", []);
const coupons = new Collection("coupons", []);

function loadAll() {
  return Promise.all([products.load(), orders.load(), coupons.load()]);
}

module.exports = { products, orders, coupons, loadAll };
