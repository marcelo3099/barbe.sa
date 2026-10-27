const clock = require('../../src/utils/clock');

const NOW = '2026-11-02T08:00:00-03:00';

const freezeNow = (iso = NOW) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));

module.exports = { freezeNow, NOW };
