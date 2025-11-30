const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FileAccess = sequelize.define('FileAccess', {
    fileId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'file_access',
  });
  return FileAccess;
};
