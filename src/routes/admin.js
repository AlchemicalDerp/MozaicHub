const express = require('express');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { ensureAdmin } = require('../middleware/auth');
const { User, File, Graylist } = require('../models');
const config = require('../config');

const router = express.Router();

router.use(ensureAdmin);

router.get('/', async (req, res) => {
  const userCount = await User.count();
  const fileCount = await File.count();
  const banned = await User.count({ where: { isBanned: true } });
  res.render('admin/dashboard', { userCount, fileCount, banned });
});

router.get('/users', async (req, res) => {
  const users = await User.findAll({ order: [['createdAt', 'DESC']] });
  res.render('admin/users', { users });
});

router.post('/users', async (req, res) => {
  const { username, email, displayName, password, role } = req.body;
  const gray = await Graylist.findOne({ where: { [Op.or]: [{ username }, { email }] } });
  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, displayName, passwordHash: hash, role });
  if (gray) req.session.grayWarning = true;
  res.redirect('/admin/users');
});

router.get('/users/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  res.render('admin/userDetail', { user, currentUser: req.session.user });
});

router.patch('/users/:id', async (req, res) => {
  const { username, email, displayName, role, storageQuotaValue, storageQuotaUnit } = req.body;
  const gray = await Graylist.findOne({ where: { [Op.or]: [{ username }, { email }] } });
  if (gray) req.session.grayWarning = true;
  const updatingSelf = Number(req.params.id) === req.session.user.id && req.session.user.role === 'ADMIN';
  const quotaBytes = storageQuotaValue
    ? Number(storageQuotaValue) * (storageQuotaUnit === 'MB' ? 1024 * 1024 : 1024 * 1024 * 1024)
    : undefined;
  await User.update(
    {
      username,
      email,
      displayName,
      role: updatingSelf ? req.session.user.role : role,
      storageQuotaBytes: quotaBytes,
    },
    { where: { id: req.params.id } }
  );
  res.redirect(`/admin/users/${req.params.id}`);
});

router.post('/users/:id/ban', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).send('Not found');
  user.isBanned = true;
  await user.save();
  await Graylist.create({ username: user.username, email: user.email, reason: req.body.reason || 'Banned' });
  await File.update({ isMarkedForDeletion: true, deletionScheduledAt: new Date(Date.now() + config.deletionGracePeriodMs) }, { where: { ownerUserId: user.id } });
  res.redirect('/admin/users');
});

router.post('/users/:id/unban', async (req, res) => {
  await User.update({ isBanned: false }, { where: { id: req.params.id } });
  res.redirect('/admin/users');
});

router.post('/users/:id/reset-password', async (req, res) => {
  const hash = await bcrypt.hash('changeme', 10);
  await User.update({ passwordHash: hash }, { where: { id: req.params.id } });
  res.redirect(`/admin/users/${req.params.id}`);
});

router.delete('/users/:id', async (req, res) => {
  await User.destroy({ where: { id: req.params.id } });
  res.redirect('/admin/users');
});

router.get('/files', async (req, res) => {
  const files = await File.findAll({ include: ['owner'], order: [['createdAt', 'DESC']] });
  res.render('admin/files', { files });
});

router.delete('/files/:id', async (req, res) => {
  await File.destroy({ where: { id: req.params.id } });
  res.redirect('/admin/files');
});

router.get('/graylist', async (req, res) => {
  const entries = await Graylist.findAll({ order: [['bannedAt', 'DESC']] });
  res.render('admin/graylist', { entries });
});

module.exports = router;
