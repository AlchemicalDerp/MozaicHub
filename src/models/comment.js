const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Comment = sequelize.define('Comment', {
    fileId: { type: DataTypes.INTEGER, allowNull: false },
    authorUserId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'comments',
  });
  return Comment;
};
