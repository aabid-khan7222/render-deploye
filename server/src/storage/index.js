const { LocalFilesystemStorageProvider } = require('./LocalFilesystemStorageProvider');
const { CloudinaryStorageProvider } = require('./CloudinaryStorageProvider');

let singleton = null;

/**
 * Select storage provider from env.
 */
function getStorageProvider() {
  if (!singleton) {
    const driver = String(process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
    if (driver === 'cloudinary') {
      singleton = new CloudinaryStorageProvider();
    } else {
      singleton = new LocalFilesystemStorageProvider();
    }
  }
  return singleton;
}

module.exports = {
  getStorageProvider,
  LocalFilesystemStorageProvider,
  CloudinaryStorageProvider,
};
