'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');

test('daily study target controls live in Time & planning settings, not the Study page',()=>{
  const study=html.slice(html.indexOf('id="page-study"'),html.indexOf('id="page-focus"'));
  const settings=html.slice(html.indexOf('id="page-settings"'),html.indexOf('id="page-profile"'));
  assert.doesNotMatch(study,/id="(?:targetDisplay|targetH|targetM|saveTarget|targetSummary)"/);
  for(const id of ['targetDisplay','targetH','targetM','saveTarget','targetSummary']) assert.match(settings,new RegExp('id="'+id+'"'));
  assert.ok(settings.indexOf('id="prefDate"')<settings.indexOf('id="targetH"'));
});
