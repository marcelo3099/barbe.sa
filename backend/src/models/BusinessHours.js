module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'BusinessHours',
    {
      weekday: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: false },
      opensAt: { type: DataTypes.STRING(5), allowNull: false },
      closesAt: { type: DataTypes.STRING(5), allowNull: false },
      breakStartsAt: { type: DataTypes.STRING(5), allowNull: true },
      breakEndsAt: { type: DataTypes.STRING(5), allowNull: true },
      closed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: 'business_hours', timestamps: false },
  );
