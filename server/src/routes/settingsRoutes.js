const express = require('express');
const multer = require('multer');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get('/', settingsController.getSettings);
router.post('/', settingsController.upsertSettings);
router.post('/upload', upload.single('file'), settingsController.uploadFile);

module.exports = router;
