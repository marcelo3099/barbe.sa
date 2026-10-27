const env = require('./config/env');
const { createApp } = require('./app');

createApp().listen(env.port, () => {
  console.log(`Barber Time API ouvindo na porta ${env.port}`);
});
