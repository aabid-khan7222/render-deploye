const path = require('path');
const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ADMIN_ROLE_IDS, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getProfile, updateProfile, uploadLogo, getLogo } = require('../controllers/schoolProfileController');
const { sanitizeTenant } = require('../utils/schoolLogoStorage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/');
    if (!ok) {
      const err = new Error('Only image files are allowed.');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getProfile);
router.get('/logo/:tenant/:filename', requireRole(ALL_AUTHENTICATED_ROLES), getLogo);
router.patch('/', requireRole(ADMIN_ROLE_IDS), updateProfile);
router.post('/logo', requireRole(ADMIN_ROLE_IDS), upload.single('logo'), uploadLogo);

module.exports = router;
