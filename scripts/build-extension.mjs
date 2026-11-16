/**
 * Arma la extensión de navegador (carpeta extension/) para descargarla desde Educai:
 *   node scripts/build-extension.mjs                 → public/educai-canvas.zip
 *   node scripts/build-extension.mjs --dir <carpeta> --test → copia sin comprimir para Playwright,
 *     con permiso previo sobre localhost (en los tests no hay quién acepte el diálogo de permisos).
 * Los íconos se generan acá (PNG sin dependencias) para no guardar binarios en el repo.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import JSZip from "jszip";

const SRC = "extension";
const args = process.argv.slice(2);
const dirArg = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : null;
const test = args.includes("--test");

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Ícono: cuadrado redondeado índigo con un anillo blanco (la "e" de Educai, simplificada). */
function icon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const cx = Math.min(Math.max(x + 0.5, r), size - r);
      const cy = Math.min(Math.max(y + 0.5, r), size - r);
      const inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / size;
      const ring = d > 0.2 && d < 0.32 && !(y + 0.5 > size / 2 && x + 0.5 > size / 2 && y + 0.5 < size * 0.62);
      const bar = Math.abs(y + 0.5 - size / 2) < size * 0.05 && Math.abs(x + 0.5 - size / 2) < size * 0.3;
      const [R, G, B] = ring || bar ? [255, 255, 255] : [79, 70, 229];
      raw[i] = R;
      raw[i + 1] = G;
      raw[i + 2] = B;
      raw[i + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const files = {};
for (const name of readdirSync(SRC)) files[name] = readFileSync(join(SRC, name));
if (test) {
  const manifest = JSON.parse(files["manifest.json"].toString("utf8"));
  manifest.host_permissions = ["http://localhost/*", "http://127.0.0.1/*"];
  files["manifest.json"] = Buffer.from(JSON.stringify(manifest, null, 2));
}
for (const size of [16, 48, 128]) files[`icon-${size}.png`] = icon(size);

if (dirArg) {
  mkdirSync(dirArg, { recursive: true });
  for (const [name, data] of Object.entries(files)) writeFileSync(join(dirArg, name), data);
  console.log(`Extensión en ${dirArg}`);
} else {
  const zip = new JSZip();
  const folder = zip.folder("educai-canvas");
  for (const [name, data] of Object.entries(files)) folder.file(name, data);
  mkdirSync("public", { recursive: true });
  writeFileSync("public/educai-canvas.zip", await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("Extensión en public/educai-canvas.zip");
}
