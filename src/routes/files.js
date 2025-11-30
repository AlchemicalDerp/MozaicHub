const express = require('express');
const path = require('path');
const { Op } = require('sequelize');
const { File, User, FileAccess, Comment, Notification, Friendship } = require('../models');
const config = require('../config');
const { uploadMiddleware } = require('../storage/localStorage');
const { categorizeFile } = require('../utils/fileCategory');
const { renderMarkdown } = require('../utils/markdown');

const router = express.Router();

async function friendIdsForUser(userId) {
  const friendships = await Friendship.findAll({ where: { [Op.or]: [{ userId1: userId }, { userId2: userId }] } });
  return friendships.map((f) => (f.userId1 === userId ? f.userId2 : f.userId1));
}

async function allowedFileIdsForUser(userId) {
  const accesses = await FileAccess.findAll({ where: { userId } });
  return accesses.map((a) => a.fileId);
}

router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const allowedFileIds = await allowedFileIdsForUser(req.session.user.id);
  const files = await File.findAll({
    where: {
      title: { [Op.like]: `%${q}%` },
      [Op.or]: [
        { visibility: 'public' },
        { visibility: 'unlisted' },
        { ownerUserId: req.session.user.id },
        { [Op.and]: [{ visibility: 'private' }, { id: { [Op.in]: allowedFileIds } }] },
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
    if (visibility === 'private' && req.body.allowedUsernames) {
      const usernames = req.body.allowedUsernames
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      if (usernames.length) {
        const allowedUsers = await User.findAll({ where: { username: { [Op.in]: usernames } } });
        await FileAccess.bulkCreate(
          allowedUsers.map((u) => ({ fileId: fileRecord.id, userId: u.id })),
          { ignoreDuplicates: true }
        );
      }
    }
    await user.update({ storageUsedBytes: newUsage });
    const friendIds = await friendIdsForUser(userId);
    await Notification.bulkCreate(
      friendIds.map((fid) => ({
        userId: fid,
        type: 'friend-upload',
        message: `${user.displayName} uploaded "${title}"`,
        link: `/files/${fileRecord.id}`,
      }))
    );
    res.redirect(`/files/${fileRecord.id}`);
  });
});

router.get('/:id', async (req, res) => {
  const file = await File.findByPk(req.params.id, {
    include: [
      { model: User, as: 'owner' },
      { model: Comment, include: ['author'], order: [['createdAt', 'ASC']] },
    ],
  });
  if (!file) return res.status(404).render('404');
  const allowed = await FileAccess.findOne({ where: { fileId: file.id, userId: req.session.user.id } });
  const canView =
    file.visibility === 'public' ||
    file.visibility === 'unlisted' ||
    file.ownerUserId === req.session.user.id ||
    req.session.user.role === 'ADMIN' ||
    Boolean(allowed);
  if (!canView) return res.status(403).send('Forbidden');
  const commentError = req.session.commentError;
  req.session.commentError = null;
  const commentModels = await Comment.findAll({
    where: { fileId: file.id },
    include: ['author'],
    order: [['createdAt', 'ASC']],
  });
  const mapped = commentModels.map((c) => {
    const raw = c.toJSON();
    return { ...raw, renderedText: renderMarkdown(c.text, (username) => `/users/${username}`), replies: [] };
  });
  const byId = new Map(mapped.map((c) => [c.id, c]));
  const roots = [];
  mapped.forEach((comment) => {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  });
  res.render('files/detail', { file: { ...file.toJSON(), Comments: roots }, commentError });
});

router.get('/:id/download', async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).send('Not found');
  const allowed = await FileAccess.findOne({ where: { fileId: file.id, userId: req.session.user.id } });
  const canView =
    file.visibility === 'public' ||
    file.visibility === 'unlisted' ||
    file.ownerUserId === req.session.user.id ||
    req.session.user.role === 'ADMIN' ||
    Boolean(allowed);
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
