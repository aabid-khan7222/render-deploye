const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const {
  getStorageDriver,
  getCloudinaryFolderPrefix,
} = require('./schoolStorageConfig');
const {
  legacyStoredKeyToPublicId,
  getResourceType,
  getFormatFromRelativeKey,
} = require('./cloudinaryPathUtils');
const {
  cloudinaryUploadBuffer,
  cloudinaryReadBuffer,
  cloudinaryDelete,
} = require('./cloudinaryClient');
const {
  isStorageNotFoundError,
} = require('./storageErrors');
const { resolveStaffProfilePath } = require('../utils/staffProfileStorage');
const { resolveStaffDocumentPath } = require('../utils/staffDocumentStorage');
const { resolveTeacherDocumentPath } = require('../utils/teacherDocumentStorage');
const {
  getConfiguredLogoPath,
  resolveExistingLogoPath,
  sanitizeFilename,
  sanitizeTenant,
} = require('../utils/schoolLogoStorage');

/** Namespace keys for legacy DB path formats (not school_{id}/...). */
const LEGACY_NAMESPACES = Object.freeze({
  STAFF_PROFILE: 'staff-profile',
  STAFF_DOC: 'staff-doc',
  TEACHER_DOC: 'teacher-doc',
  SCHOOL_LOGO: 'school-logo',
  SETTINGS: 'settings',
});

const MIME_BY_EXT = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
});

function getMimeFromFilename(filename) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

function localResolverForNamespace(namespace) {
  switch (namespace) {
    case LEGACY_NAMESPACES.STAFF_PROFILE:
      return resolveStaffProfilePath;
    case LEGACY_NAMESPACES.STAFF_DOC:
      return resolveStaffDocumentPath;
    case LEGACY_NAMESPACES.TEACHER_DOC:
      return resolveTeacherDocumentPath;
    case LEGACY_NAMESPACES.SCHOOL_LOGO:
      return (storedKey) => {
        const idx = storedKey.indexOf('/');
        if (idx < 1) return null;
        const tenant = sanitizeTenant(storedKey.slice(0, idx));
        const file = sanitizeFilename(storedKey.slice(idx + 1));
        if (!tenant || !file) return null;
        return resolveExistingLogoPath(tenant, file);
      };
    case LEGACY_NAMESPACES.SETTINGS:
      return (storedKey) => {
        const file = sanitizeFilename(storedKey);
        if (!file) return null;
        const dir = path.join(process.cwd(), 'uploads', 'settings');
        const resolved = path.resolve(path.join(dir, file));
        const boundary = path.resolve(dir);
        if (!resolved.startsWith(boundary + path.sep) && resolved !== boundary) return null;
        return resolved;
      };
    default:
      return () => null;
  }
}

function localWritePath(namespace, storedKey) {
  const resolver = localResolverForNamespace(namespace);
  const abs = resolver(storedKey);
  if (!abs) throw new Error('Invalid legacy storage path');
  return abs;
}

async function writeLocalFile(namespace, storedKey, buffer) {
  const abs = localWritePath(namespace, storedKey);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, buffer);
}

async function readLocalFile(namespace, storedKey) {
  const resolver = localResolverForNamespace(namespace);
  const abs = resolver(storedKey);
  if (!abs || !fs.existsSync(abs)) {
    const err = new Error(`File not found: ${storedKey}`);
    err.code = 'ENOENT';
    throw err;
  }
  return fsPromises.readFile(abs);
}

async function deleteLocalFile(namespace, storedKey) {
  const resolver = localResolverForNamespace(namespace);
  const abs = resolver(storedKey);
  if (!abs) return;
  await fsPromises.unlink(abs).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
}

function cloudinaryMeta(namespace, storedKey) {
  const prefix = getCloudinaryFolderPrefix();
  const publicId = legacyStoredKeyToPublicId(namespace, storedKey, prefix);
  const resourceType = getResourceType(storedKey);
  const formatHint = getFormatFromRelativeKey(storedKey);
  return { publicId, resourceType, formatHint };
}

/**
 * Upload legacy-format asset. DB storedKey format unchanged.
 * @param {{ namespace: string, storedKey: string, buffer: Buffer, mimetype?: string }} opts
 */
async function writeLegacyAsset({ namespace, storedKey, buffer }) {
  if (!namespace || !storedKey || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid legacy asset upload');
  }

  if (getStorageDriver() === 'local') {
    await writeLocalFile(namespace, storedKey, buffer);
    return storedKey;
  }

  const { publicId, resourceType } = cloudinaryMeta(namespace, storedKey);
  await cloudinaryUploadBuffer({ publicId, buffer, resourceType, overwrite: true });
  return storedKey;
}

/**
 * Read legacy asset: Cloudinary first, local filesystem fallback for pre-migration records.
 */
async function readLegacyAsset({ namespace, storedKey }) {
  if (!namespace || !storedKey) {
    const err = new Error('Invalid legacy asset path');
    err.code = 'ENOENT';
    throw err;
  }

  if (getStorageDriver() === 'local') {
    return readLocalFile(namespace, storedKey);
  }

  const { publicId, resourceType, formatHint } = cloudinaryMeta(namespace, storedKey);
  try {
    return await cloudinaryReadBuffer({
      publicId,
      resourceType,
      formatHint,
      contextKey: storedKey,
    });
  } catch (err) {
    if (!isStorageNotFoundError(err)) throw err;
    console.warn(
      `[storage] Cloudinary miss for legacy ${namespace} path "${storedKey}". Trying local filesystem fallback.`
    );
    try {
      const buffer = await readLocalFile(namespace, storedKey);
      console.warn(
        `[storage] Served legacy local ${namespace} file "${storedKey}". Re-upload recommended for Cloudinary migration.`
      );
      return buffer;
    } catch (localErr) {
      if (isStorageNotFoundError(localErr)) {
        console.warn(
          `[storage] File not found in Cloudinary or local storage for legacy ${namespace} path "${storedKey}". Client will receive 404.`
        );
        const notFound = new Error(`File not found: ${storedKey}`);
        notFound.code = 'ENOENT';
        throw notFound;
      }
      throw localErr;
    }
  }
}

async function deleteLegacyAsset({ namespace, storedKey }) {
  if (!namespace || !storedKey) return;

  if (getStorageDriver() === 'cloudinary') {
    const { publicId, resourceType } = cloudinaryMeta(namespace, storedKey);
    await cloudinaryDelete({ publicId, resourceType }).catch((err) => {
      if (!isStorageNotFoundError(err)) throw err;
    });
  }
  await deleteLocalFile(namespace, storedKey);
}

/**
 * Parse school logo DB/API reference → { tenant, filename, storedKey }.
 * Supports /api/school/profile/logo/... and /uploads/school-logos/...
 */
function parseSchoolLogoRef(logoUrl) {
  let value = String(logoUrl || '').trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname || value;
    } catch {
      /* keep raw */
    }
  }

  if (value.startsWith('/api/school/profile/logo/')) {
    const parts = value.split('/').filter(Boolean);
    const tenant = sanitizeTenant(parts[4] || '');
    const filename = sanitizeFilename(parts[5] || '');
    if (!tenant || !filename) return null;
    return { tenant, filename, storedKey: `${tenant}/${filename}` };
  }

  if (value.startsWith('/uploads/school-logos/')) {
    const parts = value.split('/').filter(Boolean);
    const tenant = sanitizeTenant(parts[2] || '');
    const filename = sanitizeFilename(parts[3] || '');
    if (!tenant || !filename) return null;
    return { tenant, filename, storedKey: `${tenant}/${filename}` };
  }

  return null;
}

function buildSchoolLogoApiUrl(tenant, filename) {
  const safeTenant = sanitizeTenant(tenant);
  const safeFile = sanitizeFilename(filename);
  if (!safeTenant || !safeFile) return null;
  return `/api/school/profile/logo/${safeTenant}/${safeFile}`;
}

module.exports = {
  LEGACY_NAMESPACES,
  writeLegacyAsset,
  readLegacyAsset,
  deleteLegacyAsset,
  parseSchoolLogoRef,
  buildSchoolLogoApiUrl,
  getMimeFromFilename,
  getConfiguredLogoPath,
};
