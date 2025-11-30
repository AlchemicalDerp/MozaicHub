const { DataTypes } = require('sequelize');
const config = require('../config');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    displayName: { type: DataTypes.STRING, allowNull: false },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('ADMIN', 'USER'), allowNull: false, defaultValue: 'USER' },
    isBanned: { type: DataTypes.BOOLEAN, defaultValue: false },
    storageQuotaBytes: { type: DataTypes.BIGINT, defaultValue: config.defaultQuotaBytes },
    storageUsedBytes: { type: DataTypes.BIGINT, defaultValue: 0 },
    profileImagePath: { type: DataTypes.STRING },
  }, {
    tableName: 'users',
  });
  return User;
};
