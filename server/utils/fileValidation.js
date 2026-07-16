'use strict';
/* ══════════════════════════════════════════════════════════════
   Real content-based file-type verification (magic bytes), used
   after multer writes a file to disk. Extension and client-sent
   mimetype are both attacker-controlled and prove nothing about
   the actual file content — this checks the file's real signature.
══════════════════════════════════════════════════════════════ */
const fs = require('fs');

function readHeader(filePath, length) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

function matches(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

// PNG, JPEG, WebP, GIF only — deliberately excludes SVG, which is scriptable
// XML content (stored-XSS risk when served back to browsers) rather than
// a verifiable raster image format.
function isValidImage(filePath) {
  try {
    const buf = readHeader(filePath, 16);
    if (matches(buf, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return true; // PNG
    if (matches(buf, [0xFF, 0xD8, 0xFF])) return true;                              // JPEG
    if (matches(buf, [0x52, 0x49, 0x46, 0x46]) && matches(buf, [0x57, 0x45, 0x42, 0x50], 8)) return true; // WEBP (RIFF....WEBP)
    if (matches(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return true; // GIF87a
    if (matches(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return true; // GIF89a
    return false;
  } catch (e) {
    return false;
  }
}

function isValidPdf(filePath) {
  try {
    const buf = readHeader(filePath, 5);
    return matches(buf, [0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-
  } catch (e) {
    return false;
  }
}

// .xlsx (OOXML) is a ZIP archive; legacy .xls (OLE2/CFB) has its own signature.
function isValidSpreadsheet(filePath) {
  try {
    const buf = readHeader(filePath, 8);
    if (matches(buf, [0x50, 0x4B, 0x03, 0x04])) return true; // xlsx (PK zip)
    if (matches(buf, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return true; // xls (OLE2)
    return false;
  } catch (e) {
    return false;
  }
}

// Deletes an invalid upload and never lets a mismatch pass silently.
function deleteFile(filePath) {
  fs.unlink(filePath, () => {});
}

module.exports = { isValidImage, isValidPdf, isValidSpreadsheet, deleteFile };
