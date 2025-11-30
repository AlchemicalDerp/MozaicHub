const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Block = sequelize.define('Block', {
    blockerUserId: { type: DataTypes.INTEGER, allowNull: false },
    blockedUserId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'blocks',
  });
  return Block;
};
