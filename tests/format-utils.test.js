'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const format=require('../format-utils');

test('escapes all HTML-sensitive characters',()=>{
  assert.equal(format.escapeHtml(`<a x="'">&</a>`),'&lt;a x=&quot;&#39;&quot;&gt;&amp;&lt;/a&gt;');
});
test('maps task priorities to stable weights',()=>{
  assert.equal(format.priorityWeight('High'),3);
  assert.equal(format.priorityWeight('Low'),1);
  assert.equal(format.priorityWeight('Medium'),2);
});
test('formats study minutes',()=>{
  assert.equal(format.formatMinutes(59),'59m');
  assert.equal(format.formatMinutes(65),'1h 5m');
});
test('formats rupee values including negatives',()=>{
  assert.equal(format.formatRupees(123456),'₹1,23,456');
  assert.equal(format.formatRupees(-500),'−₹500');
});
test('formats elapsed seconds as mm:ss',()=>{
  assert.equal(format.formatClockSeconds(0),'00:00');
  assert.equal(format.formatClockSeconds(125),'02:05');
});
