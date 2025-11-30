const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FriendRequest = sequelize.define('FriendRequest', {
    fromUserId: { type: DataTypes.INTEGER, allowNull: false },
    toUserId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'accepted', 'declined'), defaultValue: 'pending' },
  }, {
    tableName: 'friend_requests',
  });
  return FriendRequest;
};
