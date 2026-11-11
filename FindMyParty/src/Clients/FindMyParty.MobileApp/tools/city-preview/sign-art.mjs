// How a sign is drawn: the reference for the server's sign-art endpoints (which do the same with
// SkiaSharp) and what the preview uses when it stands in for the server. Sizes follow the mock's
// drawCity (design-proposals/afterglow-concept.html).

/** Splits the path-safe word the app sends (components/city/signs.ts, signArtCode). */
export function decodeSignArt(code) {
  const [version, top, bottom, ink, width, height, ...text] = Buffer.from(code, 'base64url').toString('utf8').split('\n');
  if (version !== 'v1') throw new Error('Unknown sign-art version');
  return { top: `#${top}`, bottom: `#${bottom}`, ink: `#${ink}`, widthM: Number(width), heightM: Number(height), text: text.join('\n') };
}

/**
 * Runs in a page that has the Coolvetica font. The face of a wall panel: a gradient from the top
 * colour to the bottom colour, a thin light line just inside the edge, the text centred in ink.
 * 48 px per metre, the longer side at most 768 px. Returns a PNG data URL.
 */
export function drawFace({ top, bottom, ink, widthM, heightM, text }) {
  const perMetre = Math.min(48, 768 / Math.max(widthM, heightM));
  const W = Math.round(widthM * perMetre);
  const H = Math.round(heightM * perMetre);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const fill = g.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  g.fillStyle = fill;
  g.fillRect(0, 0, W, H);
  const line = Math.max(2, Math.round(H * 0.012));
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = line;
  g.strokeRect(line * 1.5, line * 1.5, W - line * 3, H - line * 3);
  const lines = text.split('|');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(H / (lines.length + 0.4), (W * 0.94) / (longest * 0.5));
  g.font = `${size}px Coolvetica, Helvetica, Arial, sans-serif`;
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.02 + size * 0.04));
  return canvas.toDataURL('image/png');
}

/**
 * A hologram: a see-through panel outlined in the top colour, scan lines across it, glowing text,
 * and under it a cone of light narrowing to the point on the roof it rises from. Drawn at 3× for
 * a picture `(w + 12) × (h + lift + 10)` points, anchored at its bottom middle. Width and height
 * in metres only set the proportions: 4.6 points per metre, as the mock's hologram.
 */
export function drawHologram({ top, widthM, heightM, text }) {
  const D = 3;
  const S = 1.37;
  const w = Math.max(30, Math.min(80, widthM * 4.6)) * S;
  const h = Math.max(14, Math.min(40, heightM * 4.6)) * S;
  const lift = 22 * S;
  const pad = 6;
  const W = Math.ceil(w + pad * 2);
  const H = Math.ceil(h + lift + pad + 4);
  const canvas = document.createElement('canvas');
  canvas.width = W * D;
  canvas.height = H * D;
  const g = canvas.getContext('2d');
  g.scale(D, D);
  g.globalCompositeOperation = 'lighter';
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const x = W / 2;
  const foot = H - 2;
  const yb = foot - lift;
  const cone = g.createLinearGradient(0, foot, 0, yb);
  cone.addColorStop(0, rgba(top, 0.5));
  cone.addColorStop(1, rgba(top, 0.04));
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(x - 2, foot);
  g.lineTo(x + 2, foot);
  g.lineTo(x + w / 2, yb);
  g.lineTo(x - w / 2, yb);
  g.closePath();
  g.fill();
  g.shadowColor = top;
  g.shadowBlur = 12 * D;
  g.fillStyle = rgba(top, 0.16);
  g.strokeStyle = rgba(top, 0.95);
  g.lineWidth = 1.2;
  g.beginPath();
  g.rect(x - w / 2, yb - h, w, h);
  g.fill();
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = rgba(top, 0.18);
  g.lineWidth = 0.5;
  for (let y = yb - h + 2; y < yb; y += 2.5) {
    g.beginPath();
    g.moveTo(x - w / 2 + 1, y);
    g.lineTo(x + w / 2 - 1, y);
    g.stroke();
  }
  const lines = text.split('|');
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min((h - 4) / lines.length, (w - 6) / (longest * 0.6));
  g.font = `${size}px Coolvetica, Helvetica, Arial, sans-serif`;
  g.fillStyle = top;
  g.shadowColor = top;
  g.shadowBlur = 8 * D;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, x, yb - h / 2 + (i - (lines.length - 1) / 2) * size * 1.02 + size * 0.04));
  return canvas.toDataURL('image/png');
}

/**
 * A GLB holding one upright square: 1 m wide (x from −0.5 to 0.5), 1 m tall (y from 0 to 1),
 * facing +z, double-sided, with the PNG as both its colour and its own light (so the map's light
 * does not dim it). The map scales it to the sign's size.
 */
export function quadGlb(png) {
  const positions = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const pad4 = (n) => (n + 3) & ~3;
  const parts = [Buffer.from(positions.buffer), Buffer.from(normals.buffer), Buffer.from(uvs.buffer), Buffer.from(indices.buffer), png];
  const offsets = [];
  let length = 0;
  for (const part of parts) {
    offsets.push(length);
    length = pad4(length + part.length);
  }
  const bin = Buffer.alloc(length);
  parts.forEach((part, i) => part.copy(bin, offsets[i]));
  const view = (i, target) => ({ buffer: 0, byteOffset: offsets[i], byteLength: parts[i].length, ...(target ? { target } : {}) });
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
        emissiveTexture: { index: 0 },
        emissiveFactor: [1, 1, 1],
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 4, mimeType: 'image/png' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    bufferViews: [view(0, 34962), view(1, 34962), view(2, 34962), view(3, 34963), view(4)],
    buffers: [{ byteLength: length }],
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc(pad4(text.length) - text.length, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(text.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHead, text, binHead, bin]);
}
