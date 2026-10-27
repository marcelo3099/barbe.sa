module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Appointment',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      clientId: { type: DataTypes.INTEGER, allowNull: false },
      barberId: { type: DataTypes.INTEGER, allowNull: false },
      serviceId: { type: DataTypes.INTEGER, allowNull: false },
      startsAt: { type: DataTypes.DATE, allowNull: false },
      endsAt: { type: DataTypes.DATE, allowNull: false },
      priceCents: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM('SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
      paymentMethod: { type: DataTypes.ENUM('CASH', 'PIX', 'CARD'), allowNull: true },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      canceledAt: { type: DataTypes.DATE, allowNull: true },
      cancelReason: { type: DataTypes.STRING, allowNull: true },
    },
    {
      tableName: 'appointments',
      indexes: [{ fields: ['barber_id', 'starts_at'] }, { fields: ['client_id', 'starts_at'] }],
    },
  );
