const { Sequelize } = require('sequelize');
const path = require('path');
const config = require('../config');

const sequelize = new Sequelize(config.databaseUrl, {
  logging: false,
  dialectOptions: config.databaseUrl.startsWith('sqlite:')
    ? { storage: path.join(__dirname, '..', '..', 'data', 'mozaichub.sqlite') }
    : {},
});

const User = require('./user')(sequelize);
const Graylist = require('./graylist')(sequelize);
const File = require('./file')(sequelize);
const FileAccess = require('./fileAccess')(sequelize);
const Comment = require('./comment')(sequelize);
const FriendRequest = require('./friendRequest')(sequelize);
const Friendship = require('./friendship')(sequelize);
const Block = require('./block')(sequelize);
const MessageThread = require('./messageThread')(sequelize);
const Message = require('./message')(sequelize);
const Notification = require('./notification')(sequelize);

User.hasMany(File, { foreignKey: 'ownerUserId' });
File.belongsTo(User, { as: 'owner', foreignKey: 'ownerUserId' });

File.belongsToMany(User, { through: FileAccess, as: 'allowedUsers', foreignKey: 'fileId', otherKey: 'userId' });
User.belongsToMany(File, { through: FileAccess, as: 'accessibleFiles', foreignKey: 'userId', otherKey: 'fileId' });

File.hasMany(Comment, { foreignKey: 'fileId' });
Comment.belongsTo(File, { foreignKey: 'fileId' });
Comment.belongsTo(User, { as: 'author', foreignKey: 'authorUserId' });
User.hasMany(Comment, { foreignKey: 'authorUserId' });
Comment.belongsTo(Comment, { as: 'parent', foreignKey: 'parentCommentId' });
Comment.hasMany(Comment, { as: 'replies', foreignKey: 'parentCommentId' });

FriendRequest.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId' });
FriendRequest.belongsTo(User, { as: 'toUser', foreignKey: 'toUserId' });
User.hasMany(FriendRequest, { foreignKey: 'fromUserId', as: 'sentFriendRequests' });
User.hasMany(FriendRequest, { foreignKey: 'toUserId', as: 'receivedFriendRequests' });

Friendship.belongsTo(User, { as: 'user1', foreignKey: 'userId1' });
Friendship.belongsTo(User, { as: 'user2', foreignKey: 'userId2' });
User.hasMany(Friendship, { foreignKey: 'userId1', as: 'friendships1' });
User.hasMany(Friendship, { foreignKey: 'userId2', as: 'friendships2' });

Block.belongsTo(User, { as: 'blocker', foreignKey: 'blockerUserId' });
Block.belongsTo(User, { as: 'blocked', foreignKey: 'blockedUserId' });
User.hasMany(Block, { foreignKey: 'blockerUserId', as: 'blocksMade' });
User.hasMany(Block, { foreignKey: 'blockedUserId', as: 'blocksReceived' });

MessageThread.belongsTo(User, { as: 'user1', foreignKey: 'userId1' });
MessageThread.belongsTo(User, { as: 'user2', foreignKey: 'userId2' });
Message.belongsTo(MessageThread, { foreignKey: 'threadId' });
MessageThread.hasMany(Message, { foreignKey: 'threadId', as: 'messages' });
Message.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId' });
Message.belongsTo(User, { as: 'toUser', foreignKey: 'toUserId' });

Notification.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

module.exports = {
  sequelize,
  User,
  Graylist,
  File,
  FileAccess,
  Comment,
  FriendRequest,
  Friendship,
  Block,
  MessageThread,
  Message,
  Notification,
};
