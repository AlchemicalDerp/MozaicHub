const express = require('express');
const { Op } = require('sequelize');
const { MessageThread, Message } = require('../models');

const router = express.Router();

router.get('/messages', async (req, res) => {
  const userId = req.session.user.id;
  const threads = await MessageThread.findAll({ where: { [Op.or]: [{ userId1: userId }, { userId2: userId }] }, include: ['user1', 'user2', 'messages'] });
  res.render('messages/index', { threads });
});

router.get('/messages/thread/:userId', async (req, res) => {
  const userId = req.session.user.id;
  const peerId = req.params.userId;
  let thread = await MessageThread.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: peerId }, { userId1: peerId, userId2: userId }] }, include: ['messages'] });
  if (!thread) {
    thread = await MessageThread.create({ userId1: userId, userId2: peerId });
  }
  const messages = await Message.findAll({ where: { threadId: thread.id }, order: [['createdAt', 'ASC']] });
  res.render('messages/thread', { thread, messages, peerId });
});

router.post('/messages/thread/:userId', async (req, res) => {
  const userId = req.session.user.id;
  const peerId = req.params.userId;
  let thread = await MessageThread.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: peerId }, { userId1: peerId, userId2: userId }] } });
  if (!thread) thread = await MessageThread.create({ userId1: userId, userId2: peerId });
  await Message.create({ threadId: thread.id, fromUserId: userId, toUserId: peerId, text: req.body.text });
  res.redirect(`/messages/thread/${peerId}`);
});

module.exports = router;
