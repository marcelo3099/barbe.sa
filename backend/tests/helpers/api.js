const supertest = require('supertest');
const { createApp } = require('../../src/app');

const api = supertest(createApp());

module.exports = { api };
