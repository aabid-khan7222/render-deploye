const { v2: cloudinary } = require('cloudinary');
const { getCloudinaryConfig } = require('./schoolStorageConfig');
const { isStorageNotFoundError, storageNotFoundError } = require('./storageErrors');

let configured = false;

function ensureCloudinaryConfigured() {
  if (configured) return;
  const cfg = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
  });
  configured = true;
}

/**
 * @param {{ publicId: string, buffer: Buffer, resourceType: 'image'|'raw'|'video'|'auto', overwrite?: boolean }} opts
 */
async function cloudinaryUploadBuffer({ publicId, buffer, resourceType, overwrite = false }) {
  ensureCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        type: 'authenticated',
        public_id: publicId,
        overwrite,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.public_id) {
          reject(new Error('Cloudinary upload returned no public_id'));
          return;
        }
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * @param {{ publicId: string, resourceType: string, formatHint?: string, contextKey?: string }} opts
 */
async function cloudinaryReadBuffer({ publicId, resourceType, formatHint, contextKey = publicId }) {
  ensureCloudinaryConfigured();
  try {
    await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
    });
  } catch (err) {
    if (isStorageNotFoundError(err)) {
      throw storageNotFoundError(contextKey, 'cloudinary');
    }
    throw err;
  }

  const downloadUrl = cloudinary.utils.private_download_url(publicId, formatHint || 'bin', {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });

  const response = await fetch(downloadUrl);
  if (response.status === 404) {
    throw storageNotFoundError(contextKey, 'cloudinary');
  }
  if (!response.ok) {
    throw new Error(`Cloudinary download failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function cloudinaryDelete({ publicId, resourceType }) {
  ensureCloudinaryConfigured();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
  });
  if (result?.result === 'not found') return;
  if (result?.result !== 'ok' && result?.result !== 'not found') {
    throw new Error(`Cloudinary delete failed: ${result?.result || 'unknown'}`);
  }
}

async function cloudinaryExists({ publicId, resourceType }) {
  ensureCloudinaryConfigured();
  try {
    await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
      type: 'authenticated',
    });
    return true;
  } catch (err) {
    if (isStorageNotFoundError(err)) return false;
    throw err;
  }
}

module.exports = {
  ensureCloudinaryConfigured,
  cloudinaryUploadBuffer,
  cloudinaryReadBuffer,
  cloudinaryDelete,
  cloudinaryExists,
};
