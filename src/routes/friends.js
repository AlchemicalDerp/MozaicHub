const express = require('express');
const { Op } = require('sequelize');
const { FriendRequest, Friendship, User, Block } = require('../models');

const router = express.Router();

router.get('/friends', async (req, res) => {
  const userId = req.session.user.id;
  const blockedIds = await Block.findAll({ where: { [Op.or]: [{ blockerUserId: userId }, { blockedUserId: userId }] } });
  const hiddenIds = blockedIds.map((b) => (b.blockerUserId === userId ? b.blockedUserId : b.blockerUserId));
  const friendships = await Friendship.findAll({
    where: { [Op.or]: [{ userId1: userId }, { userId2: userId }] },
    include: ['user1', 'user2'],
  });
  const incoming = await FriendRequest.findAll({ where: { toUserId: userId, status: 'pending' }, include: ['fromUser'] });
  const search = (req.query.search || '').trim();
  const fuzzy = req.query.fuzzy === 'on';
  let results = [];
  let searchError = null;
  if (search) {
    const idFilter = hiddenIds.length ? { [Op.and]: [{ [Op.notIn]: hiddenIds }, { [Op.ne]: userId }] } : { [Op.ne]: userId };
    results = await User.findAll({
      where: {
        id: idFilter,
        [Op.or]: [
          { username: fuzzy ? { [Op.like]: `%${search}%` } : search },
          { displayName: fuzzy ? { [Op.like]: `%${search}%` } : search },
        ],
      },
    });
    if (results.length === 0) {
      searchError = 'No users found with that name.';
    }
  }
  res.render('friends/index', { friendships, incoming, results, search, fuzzy, searchError });
});

router.post('/friends/requests', async (req, res) => {
  const { toUserId } = req.body;
  const userId = req.session.user.id;
  if (Number(toUserId) === Number(userId)) return res.status(400).send('Cannot friend yourself');
  const block = await Block.findOne({ where: { [Op.or]: [{ blockerUserId: userId, blockedUserId: toUserId }, { blockerUserId: toUserId, blockedUserId: userId }] } });
  if (block) {
    await FriendRequest.update({ status: 'declined' }, { where: { fromUserId: toUserId, toUserId: userId, status: 'pending' } });
    return res.status(403).send('Blocked');
  }
  const existingFriend = await Friendship.findOne({ where: { [Op.or]: [{ userId1: userId, userId2: toUserId }, { userId1: toUserId, userId2: userId }] } });
  if (existingFriend) return res.status(400).send('Already friends');
  const existingRequest = await FriendRequest.findOne({ where: { fromUserId: userId, toUserId, status: 'pending' } });
  if (existingRequest) return res.status(400).send('Request already sent');
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
  const blockedId = req.params.id;
  await Block.findOrCreate({ where: { blockerUserId: userId, blockedUserId: blockedId } });
  await FriendRequest.update({ status: 'declined' }, { where: { fromUserId: blockedId, toUserId: userId, status: 'pending' } });
  await Friendship.destroy({ where: { [Op.or]: [{ userId1: userId, userId2: blockedId }, { userId1: blockedId, userId2: userId }] } });
  res.redirect('/friends');
});

router.delete('/friends/:id', async (req, res) => {
  const userId = req.session.user.id;
  await Friendship.destroy({ where: { [Op.or]: [{ userId1: userId, userId2: req.params.id }, { userId1: req.params.id, userId2: userId }] } });
  res.redirect('/friends');
});

router.post('/friends/:id/unblock', async (req, res) => {
  await Block.destroy({ where: { blockerUserId: req.session.user.id, blockedUserId: req.params.id } });
  res.redirect('/friends');
});

module.exports = router;
