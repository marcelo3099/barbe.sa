module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.ENUM('ADMIN', 'BARBER', 'CLIENT'), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'users' },
  );
