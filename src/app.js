const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const methodOverride = require('method-override');
const path = require('path');
const bcrypt = require('bcrypt');
const { sequelize, User, File, Graylist, Notification, Friendship, FriendRequest, Block } = require('./models');
const { Op } = require('sequelize');
const config = require('./config');
const { ensureAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const commentRoutes = require('./routes/comments');
const friendRoutes = require('./routes/friends');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const { removeFile, profileUpload } = require('./storage/localStorage');

const app = express();

const sessionStore = new SequelizeStore({ db: sequelize });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(session({
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
}));

sessionStore.sync();

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.use('/', authRoutes);

app.use(ensureAuth);

app.use(async (req, res, next) => {
  const unreadCount = await Notification.count({ where: { userId: req.session.user.id, readAt: null } });
  res.locals.unreadNotifications = unreadCount;
  next();
});

app.get('/', async (req, res) => {
  const blocks = await Block.findAll({ where: { [Op.or]: [{ blockerUserId: req.session.user.id }, { blockedUserId: req.session.user.id }] } });
  const hiddenOwners = blocks.map((b) => (b.blockerUserId === req.session.user.id ? b.blockedUserId : b.blockerUserId));
  const visibleWhere = {
    ownerUserId: hiddenOwners.length ? { [Op.notIn]: hiddenOwners } : { [Op.ne]: null },
    [Op.or]: [
      { visibility: 'public' },
      { visibility: 'unlisted' },
      { ownerUserId: req.session.user.id },
    ],
  };
  const friendIds = (await Friendship.findAll({ where: { [Op.or]: [{ userId1: req.session.user.id }, { userId2: req.session.user.id }] } }))
    .map((f) => (f.userId1 === req.session.user.id ? f.userId2 : f.userId1))
    .filter((id) => !hiddenOwners.includes(id));
  const popular = await File.findAll({ limit: 6, order: [['createdAt', 'DESC']], include: 'owner', where: visibleWhere });
  const imagesAndVideos = await File.findAll({
    limit: 8,
    order: [['createdAt', 'DESC']],
    where: { ...visibleWhere, fileCategory: { [Op.in]: ['image', 'video'] } },
    include: 'owner',
  });
  const otherFiles = await File.findAll({
    limit: 8,
    order: [['createdAt', 'DESC']],
    where: { ...visibleWhere, fileCategory: { [Op.notIn]: ['image', 'video'] } },
    include: 'owner',
  });
  const friendUploads = friendIds.length
    ? await File.findAll({
        limit: 6,
        order: [['createdAt', 'DESC']],
        where: { ...visibleWhere, ownerUserId: { [Op.in]: friendIds } },
        include: 'owner',
      })
    : [];
  res.render('dashboard', { popular, imagesAndVideos, otherFiles, friendUploads });
});

app.use('/files', fileRoutes);
app.use('/admin', adminRoutes);
app.use('/', commentRoutes);
app.use('/', friendRoutes);
app.use('/', messageRoutes);
app.use('/', notificationRoutes);

app.get('/users/:username', async (req, res) => {
  const profileUser = await User.findOne({ where: { username: req.params.username } });
  if (!profileUser) return res.status(404).render('404');
  const friendCount = await Friendship.count({
    where: { [Op.or]: [{ userId1: profileUser.id }, { userId2: profileUser.id }] },
  });
  const isFriend = await Friendship.findOne({ where: { [Op.or]: [{ userId1: req.session.user.id, userId2: profileUser.id }, { userId1: profileUser.id, userId2: req.session.user.id }] } });
  const pendingRequest = await FriendRequest.findOne({ where: { fromUserId: req.session.user.id, toUserId: profileUser.id, status: 'pending' } });
  const blocks = await Block.findAll({ where: { [Op.or]: [{ blockerUserId: req.session.user.id, blockedUserId: profileUser.id }, { blockerUserId: profileUser.id, blockedUserId: req.session.user.id }] } });
  const blockApplied = blocks.find((b) => b.blockerUserId === req.session.user.id);
  const blockedByThem = blocks.find((b) => b.blockerUserId === profileUser.id);
  const fileWhere = {
    ownerUserId: profileUser.id,
    [Op.or]: [
      { visibility: 'public' },
      { visibility: 'unlisted' },
      { ownerUserId: req.session.user.id },
    ],
  };
  if (req.session.user.role === 'ADMIN') delete fileWhere[Op.or];
  const uploads = await File.findAll({ where: fileWhere, order: [['createdAt', 'DESC']] });
  res.render('profile', { profileUser, friendCount, isFriend, pendingRequest, blockApplied, blockedByThem, uploads });
});

app.get('/account', async (req, res) => {
  const user = await User.findByPk(req.session.user.id, { include: ['sentFriendRequests', 'receivedFriendRequests'] });
  res.render('account', { user });
});

app.post('/account/profile', async (req, res) => {
  const { displayName, username, email } = req.body;
  const existingGray = await Graylist.findOne({ where: { [Op.or]: [{ username }, { email }] } });
  if (existingGray) {
    req.session.grayWarning = true;
  }
  await User.update({ displayName, username, email }, { where: { id: req.session.user.id } });
  const updated = await User.findByPk(req.session.user.id);
  req.session.user = {
    ...req.session.user,
    displayName: updated.displayName,
    username: updated.username,
    email: updated.email,
    profileImagePath: updated.profileImagePath,
  };
  res.redirect('/account');
});

app.post('/account/avatar', (req, res, next) => {
  profileUpload.single('profileImage')(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return res.redirect('/account');
    const relativePath = path.join('profiles', req.file.filename);
    await User.update({ profileImagePath: relativePath }, { where: { id: req.session.user.id } });
    req.session.user = { ...req.session.user, profileImagePath: relativePath };
    res.redirect('/account');
  });
});

app.post('/account/password', async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  await User.update({ passwordHash: hash }, { where: { id: req.session.user.id } });
  res.redirect('/account');
});

app.use((req, res) => {
  res.status(404).render('404');
});

async function deleteExpiredFiles() {
  const now = new Date();
  const expired = await File.findAll({ where: { isMarkedForDeletion: true, deletionScheduledAt: { [Op.lt]: now } } });
  expired.forEach((file) => {
    removeFile(path.join(config.uploadsDir, file.storedFilename));
    file.destroy();
  });
}

setInterval(deleteExpiredFiles, 60 * 60 * 1000);

async function ensureFirstAdmin() {
  const count = await User.count();
  if (count === 0) {
    const hash = await bcrypt.hash('adminpass', 10);
    await User.create({
      username: 'admin',
      email: 'admin@example.com',
      displayName: 'Administrator',
      passwordHash: hash,
      role: 'ADMIN',
    });
    console.log('Created default admin user: admin / adminpass');
  }
}

async function start() {
  const usesSqlite = config.databaseUrl.startsWith('sqlite:');
  if (usesSqlite) {
    await sequelize.query('PRAGMA foreign_keys = OFF');
  }

  await sequelize.sync({ alter: true });

  if (usesSqlite) {
    await sequelize.query('PRAGMA foreign_keys = ON');
  }
  await ensureFirstAdmin();
  app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
}

module.exports = { app, start };
