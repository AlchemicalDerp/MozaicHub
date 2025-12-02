const express = require('express');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, File, User, FileAccess, Comment, Notification, Friendship } = require('../models');
const config = require('../config');
const { uploadMiddleware } = require('../storage/localStorage');
const { categorizeFile } = require('../utils/fileCategory');
const { renderMarkdown } = require('../utils/markdown');

const router = express.Router();

async function normalizeStoredFilenames() {
  const files = await File.findAll();
  await Promise.all(
    files.map(async (file) => {
      const expected = `${file.id}${path.extname(file.originalFilename || '')}`;
      if (file.storedFilename === expected) return;

      const currentPath = path.join(config.uploadsDir, file.storedFilename);
      const targetPath = path.join(config.uploadsDir, expected);

      try {
        await fs.promises.access(currentPath);
      } catch (err) {
        console.error(`Stored file missing on disk for id ${file.id}:`, err);
        return;
      }

      try {
        await fs.promises.rename(currentPath, targetPath);
        await file.update({ storedFilename: expected });
      } catch (err) {
        console.error(`Failed to normalize filename for id ${file.id}:`, err);
      }
    })
  );
}

normalizeStoredFilenames().catch((err) => console.error('Failed to normalize stored filenames', err));

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
    const tempFilename = file.filename;
    const fileRecord = await File.create({
      ownerUserId: userId,
      title,
      description,
      originalFilename: file.originalname,
      storedFilename: tempFilename,
      mimeType: file.mimetype,
      fileCategory: category,
      sizeBytes: file.size,
      visibility: visibility || 'private',
    });

    const newStoredFilename = `${fileRecord.id}${path.extname(file.originalFilename)}`;
    if (newStoredFilename !== tempFilename) {
      const currentPath = path.join(config.uploadsDir, tempFilename);
      const nextPath = path.join(config.uploadsDir, newStoredFilename);
      try {
        await fs.promises.rename(currentPath, nextPath);
        await fileRecord.update({ storedFilename: newStoredFilename });
      } catch (err) {
        console.error('Failed to rename uploaded file to id-based name', err);
      }
    }
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

router.get('/:id/edit', async (req, res) => {
  const file = await File.findByPk(req.params.id, { include: [{ model: User, as: 'allowedUsers' }] });
  if (!file) return res.status(404).render('404');
  if (file.ownerUserId !== req.session.user.id && req.session.user.role !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }

  const allowedUsernames = (file.allowedUsers || []).map((u) => u.username).join(',');
  res.render('files/edit', { file, allowedUsernames });
});

router.put('/:id', async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).send('Not found');
  if (file.ownerUserId !== req.session.user.id && req.session.user.role !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }

  const { title, description, visibility } = req.body;
  const trimmedTitle = title ? title.trim() : '';
  if (!trimmedTitle) {
    return res.status(400).send('Title is required');
  }

  const nextVisibility = ['public', 'private', 'unlisted'].includes(visibility) ? visibility : file.visibility;
  await file.update({ title: trimmedTitle, description, visibility: nextVisibility });

  if (nextVisibility === 'private') {
    const usernames = (req.body.allowedUsernames || '')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    const allowedUsers = usernames.length ? await User.findAll({ where: { username: { [Op.in]: usernames } } }) : [];
    await FileAccess.destroy({ where: { fileId: file.id } });
    if (allowedUsers.length) {
      await FileAccess.bulkCreate(allowedUsers.map((u) => ({ fileId: file.id, userId: u.id })), { ignoreDuplicates: true });
    }
  } else {
    await FileAccess.destroy({ where: { fileId: file.id } });
  }

  res.redirect(`/files/${file.id}`);
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

  await sequelize.transaction(async (t) => {
    await Comment.destroy({ where: { fileId: file.id }, transaction: t });
    await FileAccess.destroy({ where: { fileId: file.id }, transaction: t });

    const owner = await User.findByPk(file.ownerUserId, { transaction: t });
    if (owner) {
      const nextUsage = Math.max(0, Number(owner.storageUsedBytes) - Number(file.sizeBytes));
      await owner.update({ storageUsedBytes: nextUsage }, { transaction: t });
    }

    await file.destroy({ transaction: t });
  });

  const redirectPath = file.ownerUserId === req.session.user.id ? '/files/mine' : '/files';
  res.redirect(redirectPath);
});

module.exports = router;
