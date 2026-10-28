module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
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

  // Defense in depth: never serialize the password hash.
  User.prototype.toJSON = function toJSON() {
    const values = { ...this.get() };
    delete values.passwordHash;
    return values;
  };

  return User;
};
