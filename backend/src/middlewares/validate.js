const { AppError } = require('../errors/AppError');

function collect(error, details) {
  const { fieldErrors, formErrors } = error.flatten();
  Object.assign(details, fieldErrors);
  if (formErrors.length) details._root = formErrors;
}

function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    const details = {};

    const run = (schema, source, assign) => {
      if (!schema) return;
      const result = schema.safeParse(source);
      if (result.success) assign(result.data);
      else collect(result.error, details);
    };

    run(body, req.body, (data) => { req.body = data; });
    run(params, req.params, (data) => { req.params = data; });
    run(query, req.query, (data) => { req.validatedQuery = data; });

    if (Object.keys(details).length > 0) {
      return next(AppError.of('VALIDATION_ERROR', details));
    }
    return next();
  };
}

module.exports = { validate };
