const express = require('express');
const { Notification } = require('../models');

const router = express.Router();

router.get('/notifications', async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.session.user.id },
    order: [['createdAt', 'DESC']],
  });
  res.render('notifications', { notifications });
});

router.post('/notifications/:id/read', async (req, res) => {
  const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.session.user.id } });
  if (notification) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.redirect('/notifications');
});

router.post('/notifications/read-all', async (req, res) => {
  await Notification.update({ readAt: new Date() }, { where: { userId: req.session.user.id, readAt: null } });
  res.redirect('/notifications');
});

module.exports = router;
