const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLongWeekend, getForecastStatus, getKgThresholds } = require('./dateUtils');

test('3-day long weekend detection for Friday to Sunday', () => {
  const result = calculateLongWeekend('2026-01-02');
  assert.equal(result.isLongWeekend, true);
  assert.equal(result.longWeekendDays, 3);
});

test('4-day long weekend detection when Thursday precedes a public holiday', () => {
  const result = calculateLongWeekend('2026-04-02');
  assert.equal(result.isLongWeekend, true);
  assert.equal(result.longWeekendDays, 4);
});

test('weekday stays normal when there is no holiday cluster', () => {
  const result = calculateLongWeekend('2026-01-06');
  assert.equal(result.isLongWeekend, false);
  assert.equal(result.longWeekendDays, 0);
});

test('kg thresholds stay in kilograms and do not clamp to 100%', () => {
  const thresholds = getKgThresholds(100);
  assert.deepEqual(thresholds, { watchKg: 60, alertKg: 85 });

  assert.equal(getForecastStatus(59, 100), 'NORMAL');
  assert.equal(getForecastStatus(60, 100), 'WATCH');
  assert.equal(getForecastStatus(85, 100), 'ALERT');
  assert.equal(getForecastStatus(140, 100), 'ALERT');
});
