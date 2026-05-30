const { isStorageNotFoundError } = require('./storageErrors');

/**
 * Cloudinary primary with local filesystem read/delete/exists fallback
 * for legacy relativePath values stored before migration.
 */
class HybridStorageProvider {
  /**
   * @param {object} primary - CloudinaryStorageProvider
   * @param {object} fallback - LocalFilesystemStorageProvider
   */
  constructor(primary, fallback) {
    this.primary = primary;
    this.fallback = fallback;
  }

  upload(file, schoolId, folder) {
    return this.primary.upload(file, schoolId, folder);
  }

  async read(relativeKey) {
    try {
      return await this.primary.read(relativeKey);
    } catch (err) {
      if (!isStorageNotFoundError(err)) throw err;
      console.warn(
        `[storage] Cloudinary miss for legacy path "${relativeKey}". Trying local filesystem fallback.`
      );
      try {
        const buffer = await this.fallback.read(relativeKey);
        console.warn(
          `[storage] Served legacy local file "${relativeKey}". Re-upload recommended for Cloudinary migration.`
        );
        return buffer;
      } catch (localErr) {
        if (isStorageNotFoundError(localErr)) {
          console.warn(
            `[storage] File not found in Cloudinary or local storage for "${relativeKey}". Client will receive 404.`
          );
          const notFound = new Error(`File not found: ${relativeKey}`);
          notFound.code = 'ENOENT';
          throw notFound;
        }
        throw localErr;
      }
    }
  }

  async delete(relativeKey) {
    await this.primary.delete(relativeKey).catch((err) => {
      if (!isStorageNotFoundError(err)) throw err;
    });
    await this.fallback.delete(relativeKey).catch((err) => {
      if (!isStorageNotFoundError(err)) throw err;
    });
  }

  async exists(relativeKey) {
    if (await this.primary.exists(relativeKey)) return true;
    return this.fallback.exists(relativeKey);
  }

  getMimeForPath(relativeKey) {
    return this.primary.getMimeForPath(relativeKey);
  }
}

module.exports = {
  HybridStorageProvider,
};
