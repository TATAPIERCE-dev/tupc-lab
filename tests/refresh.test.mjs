import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const init=source.slice(source.indexOf('let loadingCatalog=false;'),source.lastIndexOf('\ninit();'));
function harness(fetch){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'all',options:[{value:'all'}],hidden:true,addEventListener(){}});return elements.get(id);};
 const context=vm.createContext({fetch,AbortSignal,console,$,Date,Boolean,Number,Array,Error,Set,Object,
 catalog:undefined,products:[],categories:[],build:{},favorites:[],compared:[],
 productById:id=>context.products.find(p=>p.id===id),timestamp:x=>x,esc:x=>x,
 renderCategories(){},syncNavigation(){},renderProducts(){},renderBuild(){},updateCompare(){}});
 vm.runInContext(init,context);
 return {context,$};
}
const payload={products:[{id:'cpu',store:'Alltec'}],categories:[],generatedAt:new Date().toISOString()};
test('refresh keeps selection and valid data when the next request fails',async()=>{
 let fail=false;
 const {context,$}=harness(async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>payload};});
 await context.init();
 assert.equal(context.products.length,1);
 assert.equal($('#store').value,'all');
 fail=true;
 await context.init();
 assert.equal(context.products.length,1);
 assert.equal($('#data-warning').hidden,false);
});
test('initial remote failure loads the deployed fallback',async()=>{
 let calls=0;
 const {context}=harness(async()=>{if(++calls===1)throw Error('offline');return {ok:true,json:async()=>payload};});
 await context.init();
 assert.equal(calls,2);
 assert.equal(context.products.length,1);
});
