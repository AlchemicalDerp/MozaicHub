const express = require('express');
const { Op } = require('sequelize');
const { FriendRequest, Friendship, User, Block } = require('../models');

const router = express.Router();

router.get('/friends', async (req, res) => {
  const userId = req.session.user.id;
  const friendships = await Friendship.findAll({
    where: { [Op.or]: [{ userId1: userId }, { userId2: userId }] },
    include: ['user1', 'user2'],
  });
  const incoming = await FriendRequest.findAll({ where: { toUserId: userId, status: 'pending' }, include: ['fromUser'] });
  res.render('friends/index', { friendships, incoming });
});

router.post('/friends/requests', async (req, res) => {
  const { toUserId } = req.body;
  const userId = req.session.user.id;
  const block = await Block.findOne({ where: { [Op.or]: [{ blockerUserId: userId, blockedUserId: toUserId }, { blockerUserId: toUserId, blockedUserId: userId }] } });
  if (block) return res.status(403).send('Blocked');
  await FriendRequest.create({ fromUserId: userId, toUserId });
  res.redirect('/friends');
});

router.post('/friends/requests/:id/accept', async (req, res) => {
  const request = await FriendRequest.findByPk(req.params.id);
  if (!request || request.toUserId !== req.session.user.id) return res.status(404).send('Not found');
  request.status = 'accepted';
  await request.save();
  await Friendship.create({ userId1: request.fromUserId, userId2: request.toUserId });
  res.redirect('/friends');
});

router.post('/friends/requests/:id/decline', async (req, res) => {
  const request = await FriendRequest.findByPk(req.params.id);
  if (!request || request.toUserId !== req.session.user.id) return res.status(404).send('Not found');
  request.status = 'declined';
  await request.save();
  res.redirect('/friends');
});

router.post('/friends/:id/block', async (req, res) => {
  const userId = req.session.user.id;
  await Block.create({ blockerUserId: userId, blockedUserId: req.params.id });
  res.redirect('/friends');
});

router.delete('/friends/:id', async (req, res) => {
  const userId = req.session.user.id;
  await Friendship.destroy({ where: { [Op.or]: [{ userId1: userId, userId2: req.params.id }, { userId1: req.params.id, userId2: userId }] } });
  res.redirect('/friends');
});

module.exports = router;
