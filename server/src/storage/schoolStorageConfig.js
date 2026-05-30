const path = require('path');

/** Logical folders under each school root (whitelist). */
const ALLOWED_FOLDERS = Object.freeze(['students', 'documents', 'uploads', 'temp', 'users', 'support']);

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function getMaxUploadBytes() {
  const n = parseInt(process.env.STORAGE_MAX_UPLOAD_BYTES || String(DEFAULT_MAX_BYTES), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

/** Extension → mime allowed for upload (subset). */
const ALLOWED_EXTENSIONS = Object.freeze({
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain'],
});

function getStorageRoot() {
  const configured = String(process.env.STORAGE_ROOT || '').trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'storage');
}

const SUPPORTED_STORAGE_DRIVERS = Object.freeze(['local', 'cloudinary']);

function getStorageDriver() {
  return String(process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
}

function getCloudinaryFolderPrefix() {
  return String(process.env.CLOUDINARY_FOLDER_PREFIX || '').trim();
}

function getCloudinaryConfig() {
  return {
    cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    apiKey: String(process.env.CLOUDINARY_API_KEY || '').trim(),
    apiSecret: String(process.env.CLOUDINARY_API_SECRET || '').trim(),
  };
}

/**
 * Fail fast when STORAGE_DRIVER=cloudinary is misconfigured.
 * Never silently fall back to local when cloudinary is requested.
 */
function validateStorageAtStartup() {
  const driver = getStorageDriver();

  if (!SUPPORTED_STORAGE_DRIVERS.includes(driver)) {
    console.error(
      `❌ Invalid STORAGE_DRIVER="${driver}". Supported values: ${SUPPORTED_STORAGE_DRIVERS.join(', ')}.`
    );
    process.exit(1);
  }

  if (driver !== 'cloudinary') {
    return;
  }

  const cfg = getCloudinaryConfig();
  const missing = [];
  if (!cfg.cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!cfg.apiKey) missing.push('CLOUDINARY_API_KEY');
  if (!cfg.apiSecret) missing.push('CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    console.error(
      `❌ STORAGE_DRIVER=cloudinary requires these environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  try {
    const { ensureCloudinaryConfigured } = require('./CloudinaryStorageProvider');
    ensureCloudinaryConfigured();
    console.log('✅ Cloudinary storage configured (authenticated delivery, API proxy unchanged).');
  } catch (err) {
    console.error(`❌ Cloudinary storage initialization failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  ALLOWED_FOLDERS,
  ALLOWED_EXTENSIONS,
  getMaxUploadBytes,
  getStorageRoot,
  getStorageDriver,
  getCloudinaryFolderPrefix,
  getCloudinaryConfig,
  validateStorageAtStartup,
  SUPPORTED_STORAGE_DRIVERS,
};
