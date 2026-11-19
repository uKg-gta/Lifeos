'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const dates=require('../date-utils');

test('formats local calendar day keys and weekdays',()=>{
  const date=new Date(2026,10,20,12);
  assert.equal(dates.dayKey(date),'2026-11-20');
  assert.equal(dates.weekdayKey('2026-11-20'),5);
});
test('adds days without mutating the original date',()=>{
  const original=new Date(2026,10,20,12);
  const next=dates.addDays(1,original);
  assert.equal(dates.dayKey(next),'2026-11-21');
  assert.equal(dates.dayKey(original),'2026-11-20');
});
test('calculates Monday-first week starts',()=>{
  assert.equal(dates.weekStartKey(new Date(2026,10,20,12)),'2026-11-16');
});
test('returns an em dash for invalid or past exam dates',()=>{
  assert.equal(dates.examDaysLeft('not-a-date'),'—');
});
test('formats 12-hour and 24-hour clocks',()=>{
  const date=new Date(2026,0,1,17,5);
  assert.equal(dates.formatTime(date,'24'),'17:05');
  assert.equal(dates.formatTime(date,'12'),'5:05 PM');
});
