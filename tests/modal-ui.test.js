'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const modalModule=require('../modal-ui');

test('creates a modal UI controller with dialog and prompt operations',()=>{
  const controller=modalModule.create({$:()=>({}),safe:String});
  for(const method of ['showModal','closeModal','closeSearchModal','setSearchReturnFocus','trapDialogTab','inPageConfirm','inPagePrompt','bindModalClose'])assert.equal(typeof controller[method],'function');
});
