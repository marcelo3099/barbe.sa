module.exports = {
  async up(queryInterface, Sequelize) {
    const reference = (table) => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: table, key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    await queryInterface.createTable('appointments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      client_id: reference('users'),
      barber_id: reference('users'),
      service_id: reference('services'),
      starts_at: { type: Sequelize.DATE, allowNull: false },
      ends_at: { type: Sequelize.DATE, allowNull: false },
      price_cents: { type: Sequelize.INTEGER, allowNull: false },
      status: {
        type: Sequelize.ENUM('SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
      payment_method: { type: Sequelize.ENUM('CASH', 'PIX', 'CARD'), allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      canceled_at: { type: Sequelize.DATE, allowNull: true },
      cancel_reason: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('appointments', ['barber_id', 'starts_at']);
    await queryInterface.addIndex('appointments', ['client_id', 'starts_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('appointments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_payment_method"');
  },
};
