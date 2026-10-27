module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Service',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      priceCents: { type: DataTypes.INTEGER, allowNull: false },
      durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: 'services' },
  );
