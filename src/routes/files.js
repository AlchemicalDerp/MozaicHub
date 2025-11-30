const express = require('express');
const path = require('path');
const { Op } = require('sequelize');
const { File, User, FileAccess, Comment } = require('../models');
const config = require('../config');
const { uploadMiddleware } = require('../storage/localStorage');
const { categorizeFile } = require('../utils/fileCategory');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const files = await File.findAll({
    where: {
      title: { [Op.like]: `%${q}%` },
      [Op.or]: [
        { visibility: 'public' },
        { visibility: 'unlisted' },
        { ownerUserId: req.session.user.id },
      ],
    },
    include: [{ model: User, as: 'owner' }],
    order: [['createdAt', 'DESC']],
  });
  res.render('files/index', { files, q });
});

router.get('/mine', async (req, res) => {
  const files = await File.findAll({ where: { ownerUserId: req.session.user.id }, order: [['createdAt', 'DESC']] });
  res.render('files/mine', { files });
});

router.get('/upload', (req, res) => {
  res.render('files/upload');
});

router.post('/', (req, res, next) => {
  uploadMiddleware.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send(`File too large. Max size is ${Math.round(config.maxUploadSize / (1024 * 1024))}MB.`);
      }
      return next(err);
    }

    const userId = req.session.user.id;
    const { title, description, visibility } = req.body;
    const file = req.file;
    if (!file) return res.status(400).send('No file uploaded');
    const user = await User.findByPk(userId);
    const newUsage = Number(user.storageUsedBytes) + Number(file.size);
    if (newUsage > Number(user.storageQuotaBytes)) {
      return res.status(400).send('Storage quota exceeded');
    }
    const category = categorizeFile(file.originalname, file.mimetype);
    const fileRecord = await File.create({
      ownerUserId: userId,
      title,
      description,
      originalFilename: file.originalname,
      storedFilename: file.filename,
      mimeType: file.mimetype,
      fileCategory: category,
      sizeBytes: file.size,
      visibility: visibility || 'private',
    });
    await user.update({ storageUsedBytes: newUsage });
    res.redirect(`/files/${fileRecord.id}`);
  });
});

router.get('/:id', async (req, res) => {
  const file = await File.findByPk(req.params.id, { include: [{ model: User, as: 'owner' }, { model: Comment, include: ['author'] }] });
  if (!file) return res.status(404).render('404');
  const canView = file.visibility === 'public' || file.ownerUserId === req.session.user.id || req.session.user.role === 'ADMIN';
  if (!canView) return res.status(403).send('Forbidden');
  const commentError = req.session.commentError;
  req.session.commentError = null;
  res.render('files/detail', { file, commentError });
});

router.get('/:id/download', async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).send('Not found');
  const canView = file.visibility === 'public' || file.ownerUserId === req.session.user.id || req.session.user.role === 'ADMIN';
  if (!canView) return res.status(403).send('Forbidden');
  return res.download(path.join(config.uploadsDir, file.storedFilename), file.originalFilename);
});

router.delete('/:id', async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).send('Not found');
  if (file.ownerUserId !== req.session.user.id && req.session.user.role !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  if (file.ownerUserId === req.session.user.id) {
    const user = await User.findByPk(req.session.user.id);
    await user.update({ storageUsedBytes: Number(user.storageUsedBytes) - Number(file.sizeBytes) });
  }
  file.destroy();
  res.redirect('/files/mine');
});

module.exports = router;
