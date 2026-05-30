const path = require('path');
const sharp = require('sharp');
const { query, masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getSchoolProfile, ensureSchoolProfile } = require('../services/schoolProfileService');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const {
  sanitizeFilename,
  sanitizeTenant,
} = require('../utils/schoolLogoStorage');
const {
  LEGACY_NAMESPACES,
  writeLegacyAsset,
  readLegacyAsset,
  deleteLegacyAsset,
  buildSchoolLogoApiUrl,
  parseSchoolLogoRef,
  getMimeFromFilename,
} = require('../storage/legacyAssetStorage');

function normalizeOptionalText(value, maxLen) {
  if (value == null) return null;
  const next = sanitizeChatText(value);
  if (!next) return null;
  return next.slice(0, maxLen);
}

async function validateLogoImageShape(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = Number(meta.width || 0);
  const height = Number(meta.height || 0);
  if (!width || !height) {
    const err = new Error('Could not read image dimensions.');
    err.statusCode = 400;
    throw err;
  }

  const maxAspectRatio = 3;
  if (width / height > maxAspectRatio) {
    const err = new Error('Image is too wide for a logo. Please upload a logo-style image.');
    err.statusCode = 400;
    throw err;
  }
}

async function optimizeSchoolLogoBuffer(buffer) {
  const meta = await sharp(buffer).metadata();
  const fmt = meta.format;
  const pipeline = sharp(buffer).rotate().resize(512, 512, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  if (fmt === 'png') {
    return pipeline.png({ compressionLevel: 9 }).toBuffer();
  }
  if (fmt === 'jpeg') {
    return pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
  if (fmt === 'webp') {
    return pipeline.webp({ quality: 88 }).toBuffer();
  }
  return pipeline.png().toBuffer();
}

function sendInlineFallbackLogo(res) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="School logo fallback">
      <rect width="128" height="128" rx="24" fill="#3D5EE1"/>
      <circle cx="64" cy="44" r="18" fill="#ffffff" opacity="0.95"/>
      <path d="M32 94c7-16 19-24 32-24s25 8 32 24" fill="#ffffff" opacity="0.95"/>
    </svg>
  `.trim();
  return res.type('image/svg+xml').status(200).send(svg);
}

const getProfile = async (req, res) => {
  try {
    const profile = await getSchoolProfile(req.user?.school_name || null);
    return success(res, 200, 'School profile fetched', profile);
  } catch (err) {
    console.error('School profile get error:', err);
    return errorResponse(res, 500, 'Failed to fetch school profile');
  }
};

const updateProfile = async (req, res) => {
  try {
    const schoolName = sanitizeChatText(req.body?.school_name || '');
    if (!schoolName) {
      return errorResponse(res, 400, 'school_name is required');
    }
    if (schoolName.length > 255) {
      return errorResponse(res, 400, 'school_name must be 255 characters or fewer');
    }

    const phone = normalizeOptionalText(req.body?.phone, 30);
    const fax = normalizeOptionalText(req.body?.fax, 30);
    const address = normalizeOptionalText(req.body?.address, 2000);
    const emailRaw = normalizeOptionalText(req.body?.email, 255);
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(res, 400, 'email must be a valid email address');
    }

    await ensureSchoolProfile(req.user?.school_name || null);

    const prevRes = await query(
      `SELECT school_name FROM school_profile ORDER BY id ASC LIMIT 1`
    );
    const previousSchoolName = prevRes.rows?.[0]?.school_name ?? null;

    const updated = await query(
      `UPDATE school_profile
       SET school_name = $1,
           phone = $2,
           email = $3,
           fax = $4,
           address = $5,
           updated_at = NOW()
       WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)
       RETURNING id, school_name, logo_url, phone, email, fax, address, created_at, updated_at`,
      [schoolName, phone, email, fax, address]
    );

    const schoolId = req.user?.school_id;
    if (schoolId != null) {
      try {
        await masterQuery(
          `UPDATE schools SET school_name = $1 WHERE id = $2 AND deleted_at IS NULL`,
          [schoolName, schoolId]
        );
      } catch (e) {
        console.error('School profile: failed to sync master_db.schools.school_name:', e);
        try {
          await query(
            `UPDATE school_profile SET school_name = $1, updated_at = NOW()
             WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)`,
            [previousSchoolName]
          );
        } catch (revertErr) {
          console.error('School profile: revert school_profile after master failure:', revertErr);
        }
        return errorResponse(
          res,
          500,
          'Could not save school name to the platform registry. Your previous name was restored.'
        );
      }
    }

    return success(res, 200, 'School profile updated', updated.rows[0] || null);
  } catch (err) {
    console.error('School profile update error:', err);
    return errorResponse(res, 500, 'Failed to update school profile');
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return errorResponse(res, 400, 'Logo file is required');
    }

    try {
      await validateLogoImageShape(req.file.buffer);
    } catch (shapeErr) {
      const msg = shapeErr?.message || 'Invalid logo image';
      return errorResponse(res, shapeErr.statusCode || 400, msg);
    }

    let optimizedBuffer;
    try {
      optimizedBuffer = await optimizeSchoolLogoBuffer(req.file.buffer);
    } catch (optErr) {
      console.error('School logo optimize error:', optErr);
      return errorResponse(
        res,
        400,
        'This image could not be processed. Please try another image (max 5 MB).'
      );
    }

    const tenant = sanitizeTenant(req.tenant?.db_name || 'default_tenant') || 'default_tenant';
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.png';
    const filename = `logo_${Date.now()}${ext}`;
    const storedKey = `${tenant}/${filename}`;
    const logoUrl = buildSchoolLogoApiUrl(tenant, filename);
    if (!logoUrl) {
      return errorResponse(res, 400, 'Invalid logo path');
    }

    await writeLegacyAsset({
      namespace: LEGACY_NAMESPACES.SCHOOL_LOGO,
      storedKey,
      buffer: optimizedBuffer,
    });

    await ensureSchoolProfile(req.user?.school_name || null);

    const prevRes = await query(
      `SELECT logo_url FROM school_profile ORDER BY id ASC LIMIT 1`
    );
    const previousLogoUrl = prevRes.rows?.[0]?.logo_url ?? null;

    const updated = await query(
      `UPDATE school_profile
       SET logo_url = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)
       RETURNING id, school_name, logo_url, phone, email, fax, address, created_at, updated_at`,
      [logoUrl]
    );

    const schoolId = req.user?.school_id;
    if (schoolId == null) {
      await query(
        `UPDATE school_profile SET logo_url = $1, updated_at = NOW()
         WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)`,
        [previousLogoUrl]
      );
      return errorResponse(res, 500, 'Invalid session: missing school scope');
    }

    try {
      await masterQuery(`UPDATE schools SET logo = $1 WHERE id = $2 AND deleted_at IS NULL`, [
        logoUrl,
        schoolId,
      ]);
    } catch (e) {
      console.error('School logo: failed to sync master_db.schools.logo:', e);
      try {
        await query(
          `UPDATE school_profile SET logo_url = $1, updated_at = NOW()
           WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)`,
          [previousLogoUrl]
        );
      } catch (revertErr) {
        console.error('School logo: revert school_profile after master failure:', revertErr);
      }
      return errorResponse(
        res,
        500,
        'Could not save logo to the platform registry. Your previous logo was restored.'
      );
    }

    if (previousLogoUrl && previousLogoUrl !== logoUrl) {
      try {
        const ref = parseSchoolLogoRef(previousLogoUrl);
        if (ref?.storedKey) {
          await deleteLegacyAsset({
            namespace: LEGACY_NAMESPACES.SCHOOL_LOGO,
            storedKey: ref.storedKey,
          });
        }
      } catch (err) {
        console.warn('Failed to delete old school logo:', err.message);
      }
    }

    return success(res, 200, 'School logo uploaded', updated.rows[0] || null);
  } catch (err) {
    console.error('School logo upload error:', err);
    return errorResponse(res, 500, 'Failed to upload school logo');
  }
};

const getLogo = async (req, res) => {
  try {
    const tenant = sanitizeTenant(req.params.tenant);
    const filename = sanitizeFilename(req.params.filename);
    if (!tenant || !filename) {
      return errorResponse(res, 400, 'Invalid logo reference');
    }
    const sessionTenant = sanitizeTenant(req.tenant?.db_name);
    if (!sessionTenant || tenant !== sessionTenant) {
      return errorResponse(res, 403, 'Access denied');
    }

    const storedKey = `${tenant}/${filename}`;
    try {
      const buf = await readLegacyAsset({
        namespace: LEGACY_NAMESPACES.SCHOOL_LOGO,
        storedKey,
      });
      res.setHeader('Content-Type', getMimeFromFilename(filename));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.status(200).send(buf);
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'STORAGE_NOT_FOUND') {
        return sendInlineFallbackLogo(res);
      }
      throw err;
    }
  } catch (err) {
    console.error('School logo fetch error:', err);
    return errorResponse(res, 500, 'Failed to fetch logo');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo,
  getLogo,
};
