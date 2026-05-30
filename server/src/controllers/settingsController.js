const path = require('path');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const {
  LEGACY_NAMESPACES,
  writeLegacyAsset,
  readLegacyAsset,
  getMimeFromFilename,
} = require('../storage/legacyAssetStorage');
const { sanitizeFilename } = require('../utils/schoolLogoStorage');

const getSettings = async (req, res) => {
  try {
    const group = req.query.group;
    let sql = `SELECT * FROM settings`;
    const params = [];
    if (group) {
      sql += ` WHERE setting_group = $1`;
      params.push(group);
    }
    const r = await query(sql, params);

    const settings = {};
    for (const row of r.rows) {
      settings[row.setting_key] = row.setting_value;
    }

    return success(res, 200, 'Settings fetched', settings);
  } catch (err) {
    console.error('getSettings error:', err);
    return errorResponse(res, 500, 'Failed to fetch settings');
  }
};

const upsertSettings = async (req, res) => {
  try {
    const group = req.body.group || null;
    const settings = req.body.settings;
    if (!settings || typeof settings !== 'object') {
      return errorResponse(res, 400, 'Invalid settings body');
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO settings (setting_key, setting_value, setting_group, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_group = EXCLUDED.setting_group, updated_at = NOW()`,
        [key, value, group]
      );
    }

    return success(res, 200, 'Settings updated', settings);
  } catch (err) {
    console.error('upsertSettings error:', err);
    return errorResponse(res, 500, 'Failed to save settings');
  }
};

const uploadFile = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return errorResponse(res, 400, 'File is required');
    }

    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.bin';
    const filename = `settings-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await writeLegacyAsset({
      namespace: LEGACY_NAMESPACES.SETTINGS,
      storedKey: filename,
      buffer: req.file.buffer,
    });

    const fileUrl = `/settings/file/${filename}`;

    return success(res, 200, 'File uploaded', { url: fileUrl });
  } catch (err) {
    console.error('uploadFile error:', err);
    return errorResponse(res, 500, 'Failed to upload file');
  }
};

const getFile = async (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    if (!filename) return errorResponse(res, 400, 'Invalid filename');

    try {
      const buf = await readLegacyAsset({
        namespace: LEGACY_NAMESPACES.SETTINGS,
        storedKey: filename,
      });
      res.setHeader('Content-Type', getMimeFromFilename(filename));
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(buf);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'STORAGE_NOT_FOUND') {
        return res.status(404).send('Not Found');
      }
      throw err;
    }
  } catch (err) {
    console.error('getFile error:', err);
    return errorResponse(res, 500, 'Failed to fetch file');
  }
};

module.exports = {
  getSettings,
  upsertSettings,
  uploadFile,
  getFile,
};
