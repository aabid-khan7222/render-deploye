/** Shared not-found detection for storage providers (Cloudinary API + local fs). */
function isStorageNotFoundError(err) {
  if (!err) return false;
  if (err.code === 'ENOENT' || err.code === 'STORAGE_NOT_FOUND') return true;
  if (err.http_code === 404) return true;
  if (err.error?.http_code === 404) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('not found') || msg.includes('resource not found');
}

function storageNotFoundError(relativeKey, source) {
  const err = new Error(`File not found (${source}): ${relativeKey}`);
  err.code = 'STORAGE_NOT_FOUND';
  return err;
}

module.exports = {
  isStorageNotFoundError,
  storageNotFoundError,
};
