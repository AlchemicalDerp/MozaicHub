const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    threadId: { type: DataTypes.INTEGER, allowNull: false },
    fromUserId: { type: DataTypes.INTEGER, allowNull: false },
    toUserId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    readAt: { type: DataTypes.DATE },
  }, {
    tableName: 'messages',
  });
  return Message;
};
