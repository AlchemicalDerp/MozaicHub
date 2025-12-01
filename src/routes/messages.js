const express = require('express');
const { Op } = require('sequelize');
const { MessageThread, Message, Block, User, Notification } = require('../models');
const { renderMarkdown } = require('../utils/markdown');

const router = express.Router();

router.get('/messages', async (req, res) => {
  const userId = req.session.user.id;
  const threads = await MessageThread.findAll({ where: { [Op.or]: [{ userId1: userId }, { userId2: userId }] }, include: ['user1', 'user2'] });

  const summaries = await Promise.all(threads.map(async (thread) => {
    const peer = thread.userId1 === userId ? thread.user2 : thread.user1;
    const lastMessage = await Message.findOne({
      where: { threadId: thread.id },
      order: [['createdAt', 'DESC']],
      include: ['fromUser'],
    });
    const unreadCount = await Message.count({ where: { threadId: thread.id, toUserId: userId, readAt: null } });
    return {
      id: thread.id,
      peer,
      lastMessage,
      unreadCount,
    };
  }));

  res.render('messages/index', { threads: summaries });
});

router.get('/messages/thread/:userId', async (req, res) => {
  const userId = req.session.user.id;
  const peerId = req.params.userId;
  const peer = await User.findByPk(peerId);
  if (!peer) return res.status(404).render('404');
  const blocked = await Block.findOne({ where: { [Op.or]: [{ blockerUserId: userId, blockedUserId: peerId }, { blockerUserId: peerId, blockedUserId: userId }] } });
  if (blocked) return res.status(403).send('Messaging unavailable');
  let thread = await MessageThread.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: peerId }, { userId1: peerId, userId2: userId }] }, include: ['messages'] });
  if (!thread) {
    thread = await MessageThread.create({ userId1: userId, userId2: peerId });
  }
  const messages = await Message.findAll({ where: { threadId: thread.id }, order: [['createdAt', 'ASC']] });
  const now = new Date();
  messages.forEach((m) => {
    if (m.toUserId === userId && !m.readAt) {
      // eslint-disable-next-line no-param-reassign
      m.readAt = now;
    }
  });
  await Message.update({ readAt: now }, { where: { threadId: thread.id, toUserId: userId, readAt: null } });
  await Notification.update({ readAt: now }, { where: { userId, type: 'message', link: `/messages/thread/${peerId}`, readAt: null } });
  const rendered = messages.map((m) => ({ ...m.toJSON(), renderedText: renderMarkdown(m.text) }));
  res.render('messages/thread', { thread, messages: rendered, peerId, peer });
});

router.get('/messages/thread/:userId/data', async (req, res) => {
  const userId = req.session.user.id;
  const peerId = req.params.userId;
  const thread = await MessageThread.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: peerId }, { userId1: peerId, userId2: userId }] } });
  if (!thread) return res.json([]);
  const messages = await Message.findAll({ where: { threadId: thread.id }, order: [['createdAt', 'ASC']] });
  const now = new Date();
  messages.forEach((m) => {
    if (m.toUserId === userId && !m.readAt) {
      // eslint-disable-next-line no-param-reassign
      m.readAt = now;
    }
  });
  await Message.update({ readAt: now }, { where: { threadId: thread.id, toUserId: userId, readAt: null } });
  await Notification.update({ readAt: now }, { where: { userId, type: 'message', link: `/messages/thread/${peerId}`, readAt: null } });
  const rendered = messages.map((m) => ({ ...m.toJSON(), renderedText: renderMarkdown(m.text) }));
  res.json(rendered);
});

router.post('/messages/thread/:userId', async (req, res) => {
  const userId = req.session.user.id;
  const peerId = req.params.userId;
  const blocked = await Block.findOne({ where: { [Op.or]: [{ blockerUserId: userId, blockedUserId: peerId }, { blockerUserId: peerId, blockedUserId: userId }] } });
  if (blocked) return res.status(403).send('Messaging unavailable');
  let thread = await MessageThread.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: peerId }, { userId1: peerId, userId2: userId }] } });
  if (!thread) thread = await MessageThread.create({ userId1: userId, userId2: peerId });
  await Message.create({ threadId: thread.id, fromUserId: userId, toUserId: peerId, text: req.body.text });
  await Notification.create({
    userId: peerId,
    type: 'message',
    message: `${req.session.user.displayName} sent you a new message`,
    link: `/messages/thread/${userId}`,
  });
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    const messages = await Message.findAll({ where: { threadId: thread.id }, order: [['createdAt', 'ASC']] });
    const rendered = messages.map((m) => ({ ...m.toJSON(), renderedText: renderMarkdown(m.text) }));
    return res.json(rendered);
  }
  res.redirect(`/messages/thread/${peerId}`);
});

module.exports = router;
