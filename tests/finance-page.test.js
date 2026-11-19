'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const finance=require('../finance-page');

function setup(state,prefs={budgetResetDay:1},today='2026-11-20'){
  const elements=new Map();
  const $=selector=>{
    if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',value:'',style:{}});
    return elements.get(selector);
  };
  const controller=finance.create({
    $,queryAll:()=>[],getState:()=>state,getPrefs:()=>prefs,
    dayKey:date=>date?date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'):today,money:value=>String(value),safe:value=>String(value),
    save(){},toast(){},modal(){},getFinanceMonth:()=>null,setFinanceMonth(){}
  });
  return {controller,$};
}

test('normalizes transaction dates and calculates budget-cycle boundaries',()=>{
  const {controller}=setup({transactions:[],budgets:[],assets:[],investments:[],liabilities:[]},{budgetResetDay:5});
  assert.equal(controller.transactionDate({date:'2026-11-12'}),'2026-11-12');
  assert.equal(controller.budgetCycleStart('2026-11-03'),'2026-10-05');
  assert.equal(controller.budgetCycleStart('2026-11-12'),'2026-11-05');
});

test('renders finance totals and editable transaction and asset rows',()=>{
  const state={
    transactions:[
      {id:1,title:'Allowance',type:'income',amount:100,category:'Income',date:'2026-11-02'},
      {id:2,title:'Books',type:'expense',amount:40,category:'Study',date:'2026-11-03'}
    ],
    budgets:[{name:'Study',total:100,used:0}],
    assets:[{id:3,name:'Savings',type:'Bank account',value:50}],
    investments:[{id:4,name:'Index fund',type:'ETF',invested:150,currentValue:200,units:'2',date:'2026-11-01'}],
    liabilities:[{id:5,name:'Loan',type:'Education loan',amount:20}]
  };
  const {$,controller}=setup(state);
  controller.financePage();
  assert.equal($('#income').textContent,'100');
  assert.equal($('#expenses').textContent,'40');
  assert.equal($('#savings').textContent,'60');
  assert.equal($('#totalAssets').textContent,'250');
  assert.equal($('#totalLiabilities').textContent,'20');
  assert.equal($('#netWorth').textContent,'230');
  assert.match($('#transactions').innerHTML,/data-edit-txn="2"/);
  assert.match($('#assets').innerHTML,/data-edit-asset="3"/);
  assert.equal(state.budgets[0].used,40);
});
