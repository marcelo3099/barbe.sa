const { codes } = require('./codes');

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static of(code, details, message) {
    const entry = codes[code];
    if (!entry) throw new Error(`Código de erro desconhecido: ${code}`);
    return new AppError(entry.status, code, message || entry.message, details);
  }
}

module.exports = { AppError };
