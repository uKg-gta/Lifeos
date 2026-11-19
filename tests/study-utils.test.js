'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const study=require('../study-utils');

test('formats study durations in minutes and hours',()=>{
  assert.equal(study.formatDuration(0),'0m');
  assert.equal(study.formatDuration(59),'59m');
  assert.equal(study.formatDuration(60),'1h');
  assert.equal(study.formatDuration(125),'2h 5m');
});
test('formats hours and minutes with a two-digit minute field',()=>{
  assert.equal(study.formatHoursMinutes(5),'0h 05m');
  assert.equal(study.formatHoursMinutes(125),'2h 05m');
});
test('formats study progress and over-target time',()=>{
  assert.equal(study.progressText(90,180),'1h 30m studied · 3h target · 50%');
  assert.equal(study.progressText(210,180),'3h 30m studied · 3h target · 117% · 30m over');
});
test('normalizes invalid, negative and fractional minute values safely',()=>{
  assert.equal(study.formatDuration(-5),'0m');
  assert.equal(study.formatDuration(2.6),'3m');
  assert.equal(study.formatDuration('not a number'),'0m');
});
test('zero target avoids division by zero',()=>{
  assert.equal(study.progressText(20,0),'20m studied · 0m target · 0% · 20m over');
});
