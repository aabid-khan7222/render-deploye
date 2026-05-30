const path = require('path');
const crypto = require('crypto');
const {
  ALLOWED_EXTENSIONS,
} = require('./schoolStorageConfig');
const {
  getCloudinaryFolderPrefix,
} = require('./schoolStorageConfig');
const {
  normalizeRelativeKey,
  parseRelativeKey,
} = require('./LocalFilesystemStorageProvider');
const {
  relativeKeyToPublicId,
  getResourceType,
  getFormatFromRelativeKey,
} = require('./cloudinaryPathUtils');
const {
  isStorageNotFoundError,
  storageNotFoundError,
} = require('./storageErrors');
const {
  ensureCloudinaryConfigured,
  cloudinaryUploadBuffer,
  cloudinaryReadBuffer,
  cloudinaryDelete,
  cloudinaryExists,
} = require('./cloudinaryClient');

class CloudinaryStorageProvider {
  constructor() {
    ensureCloudinaryConfigured();
    this.prefix = getCloudinaryFolderPrefix();
  }

  _publicId(relativeKey) {
    parseRelativeKey(relativeKey);
    return relativeKeyToPublicId(relativeKey, this.prefix);
  }

  _resourceType(relativeKey) {
    return getResourceType(relativeKey);
  }

  /**
   * @param {object} file - { buffer, originalname, mimetype }
   * @returns {Promise<{ relativePath: string, filename: string }>}
   */
  async upload(file, schoolId, folder) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS[ext]) {
      throw new Error(`File type not allowed: ${ext || '(no extension)'}`);
    }
    const mime = (file.mimetype || '').toLowerCase();
    const allowedMimes = ALLOWED_EXTENSIONS[ext];
    if (mime && allowedMimes.length && !allowedMimes.includes(mime)) {
      throw new Error('MIME type does not match file extension');
    }

    const rand = crypto.randomBytes(12).toString('hex');
    const stamp = Date.now().toString(36);
    const filename = `${stamp}_${rand}${ext}`;
    const relativePath = normalizeRelativeKey(schoolId, folder, filename);
    const publicId = this._publicId(relativePath);
    const resourceType = this._resourceType(relativePath);

    await cloudinaryUploadBuffer({
      publicId,
      buffer: file.buffer,
      resourceType,
      overwrite: false,
    });

    return { relativePath, filename };
  }

  async read(relativeKey) {
    parseRelativeKey(relativeKey);
    const publicId = this._publicId(relativeKey);
    const resourceType = this._resourceType(relativeKey);
    const format = getFormatFromRelativeKey(relativeKey);

    try {
      return await cloudinaryReadBuffer({
        publicId,
        resourceType,
        formatHint: format,
        contextKey: relativeKey,
      });
    } catch (err) {
      if (isStorageNotFoundError(err)) {
        throw storageNotFoundError(relativeKey, 'cloudinary');
      }
      throw err;
    }
  }

  async delete(relativeKey) {
    parseRelativeKey(relativeKey);
    const publicId = this._publicId(relativeKey);
    const resourceType = this._resourceType(relativeKey);
    await cloudinaryDelete({ publicId, resourceType });
  }

  async exists(relativeKey) {
    parseRelativeKey(relativeKey);
    const publicId = this._publicId(relativeKey);
    const resourceType = this._resourceType(relativeKey);
    return cloudinaryExists({ publicId, resourceType });
  }

  getMimeForPath(relativeKey) {
    const ext = path.extname(relativeKey || '').toLowerCase();
    const list = ALLOWED_EXTENSIONS[ext];
    return list && list[0] ? list[0] : 'application/octet-stream';
  }
}

module.exports = {
  CloudinaryStorageProvider,
  ensureCloudinaryConfigured,
};
