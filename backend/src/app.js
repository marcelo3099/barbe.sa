const express = require('express');
const swaggerUi = require('swagger-ui-express');
const cors = require('./middlewares/cors');
const routes = require('./routes');
const openapiDocument = require('./docs/openapi');
const { notFound } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

function createApp() {
  const app = express();
  app.use(cors);
  app.use(express.json());
  app.use('/api', routes);
  app.get('/docs.json', (req, res) => res.json(openapiDocument));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
