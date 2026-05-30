const { LocalFilesystemStorageProvider } = require('./LocalFilesystemStorageProvider');
const { CloudinaryStorageProvider } = require('./CloudinaryStorageProvider');
const { HybridStorageProvider } = require('./HybridStorageProvider');
const { getStorageDriver, validateStorageAtStartup } = require('./schoolStorageConfig');

let singleton = null;

function createStorageProvider() {
  const driver = getStorageDriver();
  if (driver === 'cloudinary') {
    const primary = new CloudinaryStorageProvider();
    const fallback = new LocalFilesystemStorageProvider();
    return new HybridStorageProvider(primary, fallback);
  }
  return new LocalFilesystemStorageProvider();
}

function getStorageProvider() {
  if (!singleton) {
    singleton = createStorageProvider();
  }
  return singleton;
}

module.exports = {
  getStorageProvider,
  validateStorageAtStartup,
  LocalFilesystemStorageProvider,
  CloudinaryStorageProvider,
  HybridStorageProvider,
};
