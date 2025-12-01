const express = require('express');
const { Op } = require('sequelize');
const { Notification } = require('../models');

const router = express.Router();

router.get('/notifications', async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.render('notifications', { notifications });
});

router.get('/notifications/panel', async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });
  res.json(notifications);
});

router.post('/notifications/:id/read', async (req, res) => {
  const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.session.user.id } });
  if (notification) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.redirect('/notifications');
});

router.post('/notifications/mark-read', async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length) {
    await Notification.update({ readAt: new Date() }, { where: { id: ids, userId: req.session.user.id, readAt: null } });
  }
  res.json({ updated: ids.length });
});

router.post('/notifications/clear-seen', async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (ids.length) {
    await Notification.destroy({ where: { id: ids, userId: req.session.user.id, readAt: { [Op.ne]: null } } });
  }
  res.json({ removed: ids.length });
});

router.post('/notifications/read-all', async (req, res) => {
  await Notification.update({ readAt: new Date() }, { where: { userId: req.session.user.id, readAt: null } });
  res.redirect('/notifications');
});

module.exports = router;
