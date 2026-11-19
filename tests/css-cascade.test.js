'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('mobile dashboard grid stacks without an unnecessary important override',()=>{
  assert.match(html,/@media\s*\(max-width:\s*760px\)[\s\S]*?\.dashgrid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  assert.doesNotMatch(html,/\.dashgrid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/i);
});

test('habit weekday grid keeps its responsive layout without an important flag',()=>{
  assert.match(html,/\.daychoices\s*\{[^}]*display:\s*grid;/);
  assert.match(html,/@media\s*\(max-width:\s*520px\)[\s\S]*?\.daychoices\s*\{\s*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/);
  assert.doesNotMatch(html,/\.daychoices\s*\{[^}]*display:\s*grid\s*!important/i);
});

test('quick add button uses its stronger ID selector instead of important overrides',()=>{
  const button=html.match(/#quickAdd\.primary\s*\{([^}]*)\}/);
  const hover=html.match(/#quickAdd\.primary:hover\s*\{([^}]*)\}/);
  assert.ok(button,'quick add button rule should exist');
  assert.ok(hover,'quick add hover rule should exist');
  assert.match(button[1],/background:\s*var\(--accent\);/);
  assert.match(button[1],/border:\s*1px solid var\(--accent\);/);
  assert.match(button[1],/color:\s*#ffffff;/);
  assert.match(button[1],/box-shadow:\s*0 4px 16px var\(--accent-glow\);/);
  assert.match(hover[1],/box-shadow:\s*0 6px 22px var\(--accent-glow\);/);
  assert.doesNotMatch(button[1]+hover[1],/!important/i);
});

test('habit icon theme styles rely on selector specificity, not important flags',()=>{
  const base=html.indexOf('.habiticon {');
  const vibrant=html.indexOf('.habiticon {',base+1);
  const light=html.indexOf('[data-theme="light"] .habiticon {');
  assert.ok(base>=0 && vibrant>base && light>vibrant,'base, vibrant, and light-theme rules should remain in cascade order');
  const vibrantRule=html.slice(vibrant,html.indexOf('}',vibrant)+1);
  const lightRule=html.slice(light,html.indexOf('}',light)+1);
  assert.match(vibrantRule,/background:\s*linear-gradient/);
  assert.match(vibrantRule,/color:\s*#34d399;/);
  assert.match(lightRule,/color:\s*#047857;/);
  assert.match(lightRule,/background:\s*rgba\(4, 120, 87, 0\.08\);/);
  assert.doesNotMatch(vibrantRule+lightRule,/!important/i);
});

test('productivity score card theme overrides use the normal cascade',()=>{
  const blocks=[...html.matchAll(/\.score(?:::after)?\s*\{([^}]*)\}|\[data-theme="light"\]\s+\.score(?:::after)?\s*\{([^}]*)\}/g)];
  const find=(selector, from=0)=> {
    const start=html.indexOf(selector,from);
    assert.ok(start>=0,selector+' rule should exist');
    const end=html.indexOf('}',start);
    return html.slice(start,end+1);
  };
  const dark=find('/* Vibrant gradients on card accents */');
  const darkGlow=find('.score::after {',html.indexOf('/* Vibrant gradients on card accents */'));
  const light=find('[data-theme="light"] .score {');
  const lightGlow=find('[data-theme="light"] .score::after {');
  assert.match(dark,/background:\s*linear-gradient/);
  assert.match(dark,/border:\s*1px solid/);
  assert.match(light,/background:\s*linear-gradient/);
  assert.match(light,/border-color:\s*var\(--line\)/);
  assert.match(darkGlow,/opacity:\s*0\.7;/);
  assert.match(lightGlow,/opacity:\s*0\.7;/);
  assert.doesNotMatch(dark+darkGlow+light+lightGlow,/!important/i);
});

test('focus timer ring dark and light rules use selector order and specificity',()=>{
  const get=(selector,from=0)=>{const i=html.indexOf(selector,from);assert.ok(i>=0,selector+' should exist');return html.slice(i,html.indexOf('}',i)+1);};
  const ringBase=get('.ring {');
  const ringDark=get('.ring {',html.indexOf('.ring {')+1);
  const ringLight=get('[data-theme="light"] .ring {');
  const timerDark=get('.timer-ring {',html.indexOf('.timer-ring {')+1);
  const timerLight=get('[data-theme="light"] .timer-ring {');
  assert.match(ringDark,/conic-gradient\(#10b981/);
  assert.match(ringLight,/var\(--panel3\)/);
  assert.match(timerDark,/border-right-color:\s*#ec4899;/);
  assert.match(timerLight,/border-right-color:\s*var\(--coral\);/);
  assert.doesNotMatch(ringBase+ringDark+ringLight+timerDark+timerLight,/!important/i);
});
test('metric number dark gradient and light text reset rely on cascade',()=>{
  const get=(selector,from=0)=>{const i=html.indexOf(selector,from);assert.ok(i>=0,selector+' should exist');return html.slice(i,html.indexOf('}',i)+1);};
  const dark=get('.metric strong {',html.indexOf('.metric strong {')+1);
  const light=get('[data-theme="light"] .metric strong {');
  assert.match(dark,/background:\s*linear-gradient/);
  assert.match(dark,/-webkit-text-fill-color:\s*transparent;/);
  assert.match(light,/background:\s*none;/);
  assert.match(light,/-webkit-text-fill-color:\s*var\(--text\);/);
  assert.doesNotMatch(dark+light,/!important/i);
});

test('progress bar and active mobile navigation styles rely on source order and theme specificity',()=>{
  const get=(selector,from=0)=>{const i=html.indexOf(selector,from);assert.ok(i>=0,selector+' should exist');return html.slice(i,html.indexOf('}',i)+1);};
  const barBase=get('.bar div {');
  const barAccent=get('.bar div {',html.indexOf('.bar div {')+1);
  const navBase=get('.bottomnav button.active {',html.indexOf('.bottomnav button.active {')+1);
  const navLight=get('[data-theme="light"] .bottomnav button.active {');
  assert.match(barAccent,/linear-gradient\(90deg, #10b981 0%, #f59e0b 100%\)/);
  assert.match(navBase,/color:\s*#f59e0b;/);
  assert.match(navLight,/color:\s*var\(--accent\);/);
  assert.doesNotMatch(barBase+barAccent+navBase+navLight,/!important/i);
});

test('application styles are consolidated into one ordered style block',()=>{
  const blocks=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  assert.equal(blocks.length,1,'all application CSS should live in one style block');
  const css=blocks[0][1];
  const base=css.indexOf(':root {');
  const weekday=css.indexOf('.daychoices{');
  const auth=css.indexOf('#authGate.lifeos-auth-gate {');
  assert.ok(base>=0&&weekday>base&&auth>weekday,'original CSS block order must be preserved');
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
  assert.match(html,/<script src="\.\/vendor\/supabase\.js"/);
  assert.match(html,/<script src="\.\/sync-core\.js"/);
  assert.match(html,/id="authGate"/);
});

test('static page markup uses CSS classes instead of inline style attributes',()=>{
  assert.doesNotMatch(html,/<[^>]+\sstyle\s*=/i,'static HTML should not carry inline style attributes');
  for(const cls of ['u-full-width','u-flex-end-between','u-grid-auto-290','u-timer-ring-large','u-profile-avatar','u-visually-hidden-file']){
    assert.match(html,new RegExp('\\.'+cls+'\\s*\\{'),cls+' class should be defined');
  }
});
