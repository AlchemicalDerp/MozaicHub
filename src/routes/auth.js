const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User } = require('../models');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const info = req.session.loginInfo;
  req.session.loginInfo = null;
  return res.render('login', { error: null, info });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user) return res.render('login', { error: 'Invalid credentials', info: null });
  if (user.isBanned) return res.render('login', { error: 'Account banned', info: null });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.render('login', { error: 'Invalid credentials', info: null });
  req.session.user = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
    profileImagePath: user.profileImagePath,
  };
  return res.redirect('/');
});

router.post('/recover', async (req, res) => {
  const { username } = req.body;
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.render('login', { error: null, info: 'If the account exists, a recovery password was generated.' });
  }
  const newPassword = crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(newPassword, 10);
  await user.update({ passwordHash: hash });
  console.log(`Recovery password for ${user.username}: ${newPassword}`);
  req.session.loginInfo = `Recovery password generated. Check server logs for ${user.username}.`;
  return res.redirect('/login');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
