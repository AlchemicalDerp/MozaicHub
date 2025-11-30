const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Friendship = sequelize.define('Friendship', {
    userId1: { type: DataTypes.INTEGER, allowNull: false },
    userId2: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'friendships',
  });
  return Friendship;
};
