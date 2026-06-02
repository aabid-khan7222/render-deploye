const path = require('path');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const {
  ALLOWED_EXTENSIONS,
  ALLOWED_FOLDERS,
} = require('./schoolStorageConfig');
const {
  normalizeRelativeKey,
  parseRelativeKey,
} = require('./LocalFilesystemStorageProvider');

function ensureCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary config missing: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET required');
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

class CloudinaryStorageProvider {
  constructor() {
    ensureCloudinaryConfig();
  }

  async upload(file, schoolId, folder) {
    const topFolder = String(folder || '').split('/')[0];
    if (!ALLOWED_FOLDERS.includes(topFolder)) {
      throw new Error('Invalid folder');
    }

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

    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: relativePath,
          resource_type: 'auto',
          overwrite: true,
          unique_filename: false,
          use_filename: false,
        },
        (err) => {
          if (err) return reject(err);
          return resolve();
        }
      );
      stream.end(file.buffer);
    });

    return { relativePath, filename };
  }

  async read(relativeKey) {
    const parsed = parseRelativeKey(relativeKey);
    if (!parsed) {
      throw new Error('Invalid storage path');
    }
    const url = await this.resolveSecureUrl(relativeKey);
    const resp = await fetch(url);
    if (!resp.ok) {
      const e = new Error(resp.status === 404 ? 'ENOENT' : 'Cloudinary read failed');
      e.code = resp.status === 404 ? 'ENOENT' : undefined;
      throw e;
    }
    const arr = await resp.arrayBuffer();
    return Buffer.from(arr);
  }

  async delete(relativeKey) {
    const parsed = parseRelativeKey(relativeKey);
    if (!parsed) {
      throw new Error('Invalid storage path');
    }
    const candidates = ['image', 'raw', 'video'];
    for (const resourceType of candidates) {
      try {
        const result = await cloudinary.uploader.destroy(relativeKey, {
          resource_type: resourceType,
          invalidate: true,
        });
        if (result?.result === 'ok' || result?.result === 'not found') {
          return;
        }
      } catch (_) {
        // Try next resource type.
      }
    }
  }

  async exists(relativeKey) {
    try {
      await this.resolveSecureUrl(relativeKey);
      return true;
    } catch {
      return false;
    }
  }

  getMimeForPath(relativeKey) {
    const ext = path.extname(relativeKey || '').toLowerCase();
    const list = ALLOWED_EXTENSIONS[ext];
    return list && list[0] ? list[0] : 'application/octet-stream';
  }

  async resolveSecureUrl(relativeKey) {
    const candidates = ['image', 'raw', 'video'];
    for (const resourceType of candidates) {
      try {
        const resource = await cloudinary.api.resource(relativeKey, {
          resource_type: resourceType,
          type: 'upload',
        });
        if (resource?.secure_url) {
          return resource.secure_url;
        }
      } catch (e) {
        if (e?.http_code === 404) {
          continue;
        }
        throw e;
      }
    }
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    throw err;
  }
}

module.exports = {
  CloudinaryStorageProvider,
};
