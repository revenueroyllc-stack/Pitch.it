import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal ZIP parser using Node.js built-ins
// ZIP format: local file headers followed by central directory

const zipPath = process.argv[2];
const outDir = process.argv[3];

const buf = fs.readFileSync(zipPath);

function readUInt16LE(buf, offset) { return buf[offset] | (buf[offset+1] << 8); }
function readUInt32LE(buf, offset) { return (buf[offset] | (buf[offset+1] << 8) | (buf[offset+2] << 16) | (buf[offset+3] << 24)) >>> 0; }

// Find End of Central Directory record (signature 0x06054b50)
let eocd = -1;
for (let i = buf.length - 22; i >= 0; i--) {
  if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) {
    eocd = i;
    break;
  }
}
if (eocd === -1) { console.error('Not a valid ZIP file'); process.exit(1); }

const centralDirOffset = readUInt32LE(buf, eocd + 16);
const numEntries = readUInt16LE(buf, eocd + 10);

console.log(`Found ${numEntries} entries`);

let pos = centralDirOffset;
const entries = [];

for (let i = 0; i < numEntries; i++) {
  // Central directory file header signature = 0x02014b50
  if (readUInt32LE(buf, pos) !== 0x02014b50) break;
  const compression = readUInt16LE(buf, pos + 10);
  const compressedSize = readUInt32LE(buf, pos + 20);
  const uncompressedSize = readUInt32LE(buf, pos + 24);
  const fileNameLen = readUInt16LE(buf, pos + 28);
  const extraLen = readUInt16LE(buf, pos + 30);
  const commentLen = readUInt16LE(buf, pos + 32);
  const localHeaderOffset = readUInt32LE(buf, pos + 42);
  const fileName = buf.slice(pos + 46, pos + 46 + fileNameLen).toString('utf8');
  entries.push({ fileName, compression, compressedSize, uncompressedSize, localHeaderOffset });
  pos += 46 + fileNameLen + extraLen + commentLen;
}

let extracted = 0;
let skipped = 0;

for (const entry of entries) {
  const { fileName, compression, compressedSize, uncompressedSize, localHeaderOffset } = entry;

  // Skip directories and unwanted paths
  if (fileName.endsWith('/')) continue;
  const parts = fileName.split('/');
  if (parts.includes('node_modules') || parts.includes('.git') || parts.includes('dist')) {
    skipped++;
    continue;
  }

  // Read local file header
  const lhPos = localHeaderOffset;
  if (readUInt32LE(buf, lhPos) !== 0x04034b50) continue;
  const lhFileNameLen = readUInt16LE(buf, lhPos + 26);
  const lhExtraLen = readUInt16LE(buf, lhPos + 28);
  const dataStart = lhPos + 30 + lhFileNameLen + lhExtraLen;
  const compressedData = buf.slice(dataStart, dataStart + compressedSize);

  // Determine output path - strip top-level folder if present
  let outPath = fileName;
  // If all entries start with same prefix (zip root folder), strip it
  if (parts.length > 1) {
    // Keep as-is — we'll strip the first component if it looks like a wrapper folder
    outPath = parts.slice(1).join('/');
    if (!outPath) continue; // was the root folder itself
  }

  const fullOutPath = path.join(outDir, outPath);
  const dir = path.dirname(fullOutPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    let data;
    if (compression === 0) {
      data = compressedData;
    } else if (compression === 8) {
      data = zlib.inflateRawSync(compressedData);
    } else {
      console.warn(`Unsupported compression ${compression} for ${fileName}`);
      skipped++;
      continue;
    }
    fs.writeFileSync(fullOutPath, data);
    extracted++;
    if (extracted <= 5 || extracted % 20 === 0) console.log(`  [${extracted}] ${outPath}`);
  } catch(e) {
    console.warn(`Failed to extract ${fileName}: ${e.message}`);
    skipped++;
  }
}

console.log(`\nDone: ${extracted} files extracted, ${skipped} skipped`);
