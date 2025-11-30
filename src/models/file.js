const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const File = sequelize.define('File', {
    ownerUserId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    originalFilename: { type: DataTypes.STRING, allowNull: false },
    storedFilename: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING },
    fileCategory: { type: DataTypes.ENUM('audio', 'video', 'image', 'pdf', 'other'), allowNull: false },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: false },
    visibility: { type: DataTypes.ENUM('public', 'private', 'unlisted'), defaultValue: 'private' },
    isMarkedForDeletion: { type: DataTypes.BOOLEAN, defaultValue: false },
    deletionScheduledAt: { type: DataTypes.DATE },
  }, {
    tableName: 'files',
  });
  return File;
};
