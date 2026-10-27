module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'TimeOff',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      barberId: { type: DataTypes.INTEGER, allowNull: false },
      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: false },
      reason: { type: DataTypes.STRING, allowNull: true },
    },
    { tableName: 'time_offs' },
  );
