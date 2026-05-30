/**
 * Storage provider smoke tests (local driver — no Cloudinary credentials required).
 * Run: node scripts/test-storage-provider.js
 */
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_ROOT = path.join(os.tmpdir(), `storage-test-${Date.now()}`);

const { getStorageProvider, validateStorageAtStartup } = require('../src/storage');
const { HybridStorageProvider } = require('../src/storage/HybridStorageProvider');
const { LocalFilesystemStorageProvider } = require('../src/storage/LocalFilesystemStorageProvider');

async function run() {
  validateStorageAtStartup();
  const provider = getStorageProvider();

  const file = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
  };

  const { relativePath, filename } = await provider.upload(file, 1, 'students');
  if (!relativePath || !filename) throw new Error('upload missing fields');
  if (!relativePath.startsWith('school_1/students/')) throw new Error(`bad relativePath: ${relativePath}`);

  const buf = await provider.read(relativePath);
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new Error('read failed');

  const exists = await provider.exists(relativePath);
  if (!exists) throw new Error('exists should be true');

  await provider.delete(relativePath);
  const existsAfter = await provider.exists(relativePath);
  if (existsAfter) throw new Error('exists should be false after delete');

  // Hybrid 404 for missing legacy path
  const hybrid = new HybridStorageProvider(
    {
      read: async () => {
        const err = new Error('not found');
        err.code = 'STORAGE_NOT_FOUND';
        throw err;
      },
      exists: async () => false,
      delete: async () => {},
      getMimeForPath: () => 'image/jpeg',
      upload: async () => ({ relativePath: 'x', filename: 'x' }),
    },
    new LocalFilesystemStorageProvider()
  );

  let got404 = false;
  try {
    await hybrid.read('school_1/students/nonexistent_legacy.jpg');
  } catch (err) {
    if (err.code === 'ENOENT') got404 = true;
  }
  if (!got404) throw new Error('hybrid should throw ENOENT for missing legacy file');

  await fs.rm(process.env.STORAGE_ROOT, { recursive: true, force: true });

  // Legacy asset local round-trip
  const {
    LEGACY_NAMESPACES,
    writeLegacyAsset,
    readLegacyAsset,
    deleteLegacyAsset,
  } = require('../src/storage/legacyAssetStorage');

  const legacyKey = 'test_tenant/staff_1_profile_test.jpg';
  await writeLegacyAsset({
    namespace: LEGACY_NAMESPACES.STAFF_PROFILE,
    storedKey: legacyKey,
    buffer: Buffer.from('legacy-photo'),
  });
  const legacyBuf = await readLegacyAsset({
    namespace: LEGACY_NAMESPACES.STAFF_PROFILE,
    storedKey: legacyKey,
  });
  if (legacyBuf.toString() !== 'legacy-photo') throw new Error('legacy read failed');
  await deleteLegacyAsset({
    namespace: LEGACY_NAMESPACES.STAFF_PROFILE,
    storedKey: legacyKey,
  });

  console.log('✅ storage provider smoke tests passed');
}

run().catch((err) => {
  console.error('❌ storage test failed:', err.message);
  process.exit(1);
});
