const test = require('node:test');
const assert = require('node:assert/strict');
const { getForecastStatus, getKgThresholds } = require('./dateUtils');

// Long-weekend detection moved to Python (calendar_features.calendar_flags_for_date);
// it is tested in waste_forecast/src/test_calendar_flags.py.

test('kg thresholds stay in kilograms and do not clamp to 100%', () => {
  const thresholds = getKgThresholds(100);
  assert.deepEqual(thresholds, { watchKg: 60, alertKg: 85 });

  assert.equal(getForecastStatus(59, 100), 'NORMAL');
  assert.equal(getForecastStatus(60, 100), 'WATCH');
  assert.equal(getForecastStatus(85, 100), 'ALERT');
  assert.equal(getForecastStatus(140, 100), 'ALERT');
});
