const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MessageThread = sequelize.define('MessageThread', {
    userId1: { type: DataTypes.INTEGER, allowNull: false },
    userId2: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'message_threads',
  });
  return MessageThread;
};
