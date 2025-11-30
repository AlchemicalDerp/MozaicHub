const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');

if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}
if (!fs.existsSync(config.profileDir)) {
  fs.mkdirSync(config.profileDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: config.maxUploadSize },
});

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.profileDir),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function removeFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Failed to delete file', err);
  }
}

module.exports = { uploadMiddleware, profileUpload, removeFile };
