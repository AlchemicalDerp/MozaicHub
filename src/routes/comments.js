const express = require('express');
const { Op } = require('sequelize');
const { Comment, File, User, Notification } = require('../models');
const { extractMentions } = require('../utils/markdown');

const router = express.Router();

router.post('/files/:id/comments', async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).send('Not found');
  const canView = file.visibility === 'public' || file.ownerUserId === req.session.user.id || req.session.user.role === 'ADMIN';
  if (!canView) return res.status(403).send('Forbidden');
  const text = (req.body.text || '').trim();
  if (!text || text.length > 1000) {
    req.session.commentError = text.length > 1000 ? 'Comments are limited to 1000 characters.' : 'Comment cannot be empty.';
    return res.redirect(`/files/${file.id}`);
  }
  const comment = await Comment.create({ fileId: file.id, authorUserId: req.session.user.id, text });
  if (file.ownerUserId !== req.session.user.id) {
    await Notification.create({
      userId: file.ownerUserId,
      type: 'comment',
      message: `${req.session.user.displayName} commented on "${file.title}"`,
      link: `/files/${file.id}`,
    });
  }

  const mentions = extractMentions(text);
  if (mentions.length) {
    const taggedUsers = await User.findAll({ where: { username: { [Op.in]: mentions } } });
    for (const tagged of taggedUsers) {
      if (tagged.id === req.session.user.id) continue;
      await Notification.create({
        userId: tagged.id,
        type: 'mention',
        message: `${req.session.user.displayName} mentioned you in a comment`,
        link: `/files/${file.id}#comment-${comment.id}`,
      });
    }
  }
  res.redirect(`/files/${file.id}`);
});

router.post('/comments/:commentId/delete', async (req, res) => {
  const comment = await Comment.findByPk(req.params.commentId, { include: [File] });
  if (!comment) return res.status(404).send('Not found');
  if (comment.authorUserId !== req.session.user.id && comment.File.ownerUserId !== req.session.user.id && req.session.user.role !== 'ADMIN') {
    return res.status(403).send('Forbidden');
  }
  await comment.destroy();
  res.redirect(`/files/${comment.fileId}`);
});

module.exports = router;
