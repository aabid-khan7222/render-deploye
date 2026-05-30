const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

/**
 * Map DB relativePath → Cloudinary public_id (no file extension).
 * @param {string} relativeKey e.g. school_12/students/abc.jpg
 * @param {string} [prefix] optional env prefix e.g. webschool-prod
 */
function relativeKeyToPublicId(relativeKey, prefix) {
  const normalized = String(relativeKey || '').replace(/\\/g, '/').trim();
  const withoutExt = normalized.replace(/\.[^/.]+$/, '');
  const safePrefix = String(prefix || '').trim().replace(/^\/+|\/+$/g, '');
  return safePrefix ? `${safePrefix}/${withoutExt}` : withoutExt;
}

function getResourceType(relativeKey) {
  const ext = path.extname(String(relativeKey || '')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext) ? 'image' : 'raw';
}

function getFormatFromRelativeKey(relativeKey) {
  const ext = path.extname(String(relativeKey || '')).toLowerCase();
  if (!ext) return undefined;
  return ext.slice(1);
}

/**
 * Legacy tenant paths (staff/teacher/logo/settings) → Cloudinary public_id.
 * @param {string} namespace e.g. staff-profile, school-logo
 * @param {string} storedKey DB key e.g. tenant_db/file.jpg or settings-123.png
 */
function legacyStoredKeyToPublicId(namespace, storedKey, prefix) {
  const normalized = String(storedKey || '').replace(/\\/g, '/').trim().replace(/^\/+/, '');
  const withoutExt = normalized.replace(/\.[^/.]+$/, '');
  const safeNs = String(namespace || 'legacy').replace(/[^a-z0-9-]/gi, '');
  const safeKey = withoutExt.replace(/[^a-zA-Z0-9_./-]/g, '_');
  const safePrefix = String(prefix || '').trim().replace(/^\/+|\/+$/g, '');
  return safePrefix ? `${safePrefix}/legacy/${safeNs}/${safeKey}` : `legacy/${safeNs}/${safeKey}`;
}

module.exports = {
  relativeKeyToPublicId,
  legacyStoredKeyToPublicId,
  getResourceType,
  getFormatFromRelativeKey,
};
