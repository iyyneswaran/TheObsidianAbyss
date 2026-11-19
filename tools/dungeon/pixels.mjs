import { deflateSync } from "node:zlib";

export function noise(x, y, seed = 0) {
  const mix =
    Math.imul(x + seed * 19, 374761393) ^ Math.imul(y + seed * 7, 668265263);
  return ((Math.imul(mix ^ (mix >>> 13), 1274126177) >>> 0) % 65536) / 65536;
}

export function surface(width, height) {
  return { width, height, bytes: Buffer.alloc(width * height * 4) };
}

export function painter(image, left = 0, top = 0, size = 32) {
  function pixel(x, y, color, alpha = 255) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = ((top + y) * image.width + left + x) * 4;
    image.bytes[index] = color >> 16;
    image.bytes[index + 1] = color >> 8;
    image.bytes[index + 2] = color;
    image.bytes[index + 3] = alpha;
  }

  function rect(x, y, w, h, color, alpha) {
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) pixel(col, row, color, alpha);
    }
  }

  function line(x, y, toX, toY, color, width = 1) {
    const steps = Math.max(Math.abs(toX - x), Math.abs(toY - y), 1);
    for (let i = 0; i <= steps; i++) {
      rect(
        Math.round(x + ((toX - x) * i) / steps),
        Math.round(y + ((toY - y) * i) / steps),
        width,
        width,
        color,
      );
    }
  }

  function poly(points, color) {
    for (
      let y = Math.max(0, Math.min(...points.map((p) => p[1])));
      y <= Math.max(...points.map((p) => p[1]));
      y++
    ) {
      const crossings = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (y1 > y !== y2 > y)
          crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      crossings.sort((a, b) => a - b);
      for (let i = 0; i < crossings.length; i += 2) {
        const start = Math.ceil(crossings[i]);
        rect(start, y, Math.ceil(crossings[i + 1]) - start, 1, color);
      }
    }
  }

  return { pixel, rect, line, poly };
}

function chunk(type, contents) {
  const payload = Buffer.concat([Buffer.from(type), contents]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }

  const length = Buffer.alloc(4);
  length.writeUInt32BE(contents.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}

export function png({ width, height, bytes }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++)
    bytes.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
