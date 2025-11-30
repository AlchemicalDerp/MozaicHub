const express = require('express');
const { Comment, File } = require('../models');

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
  await Comment.create({ fileId: file.id, authorUserId: req.session.user.id, text });
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
