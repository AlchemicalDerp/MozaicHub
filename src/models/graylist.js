const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Graylist = sequelize.define('Graylist', {
    username: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.STRING },
    bannedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'graylist',
  });
  return Graylist;
};
