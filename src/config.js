const path = require('path');
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'supersecret',
  databaseUrl: process.env.DATABASE_URL || 'sqlite:' + path.join(__dirname, '..', 'data', 'mozaichub.sqlite'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads'),
  profileDir: process.env.PROFILE_DIR || path.join(__dirname, '..', 'uploads', 'profiles'),
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || 200 * 1024 * 1024, 10),
  deletionGracePeriodMs: 3 * 24 * 60 * 60 * 1000,
  defaultQuotaBytes: 10 * 1024 * 1024 * 1024,
};
