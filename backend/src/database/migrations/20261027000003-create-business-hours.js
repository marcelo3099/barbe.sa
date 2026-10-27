module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('business_hours', {
      weekday: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false },
      opens_at: { type: Sequelize.STRING(5), allowNull: false },
      closes_at: { type: Sequelize.STRING(5), allowNull: false },
      break_starts_at: { type: Sequelize.STRING(5), allowNull: true },
      break_ends_at: { type: Sequelize.STRING(5), allowNull: true },
      closed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('business_hours');
  },
};
