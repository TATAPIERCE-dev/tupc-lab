import { quoteFilename, quoteWorkbook } from './quote.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const paths = {
 grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 cpu:'M6 6h12v12H6zM9 9h6v6H9zM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',
 motherboard:'M4 2h16v20H4zM7 6h7v7H7zM17 5v9M7 17h10M7 19h10',
 ram:'M2 6h20v11H2zM5 9h3v4H5zm6 0h3v4h-3zm6 0h2v4h-2M5 17v3m4-3v3m4-3v3m4-3v3m3-3v3',
 ssd:'M5 2h14v20H5zM8 6h8v6H8zM8 16h8M8 19h3m2 0h3',
 gpu:'M2 5h19v13H2zM5 18v3m4-3v3m4-3v3M21 8h2m-2 7h2M7 8a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7m9 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',
 psu:'M3 3h18v18H3zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 case:'M5 2h14v20H5zM8 5h8M8 8h8M12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6M8 20h1m6 0h1',
 cooler:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6m0 0c-7 2-9-4-6-6m9 3c-2-7 4-9 6-6m-6 9c7-2 9 4 6 6m-9-6c2 7-4 9-6 6',
 build:'M4 3h16v18H4zM8 7h8M8 11h3m-3 4h3m4-4v6m-3-3h6',
 search:'m21 21-5-5M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15',
 clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4v6l4 2'
};
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.cpu}"/></svg>`;
$$('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
const money = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
const date = value => new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Santiago'}).format(new Date(value));
const timestamp = value => new Intl.DateTimeFormat('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Santiago'}).format(new Date(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = u => {try {const url = new URL(u);return url.protocol === 'https:' ? url.href : '#';} catch {return '#';}};
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const shortNames = {cpu:'Procesadores',motherboard:'Placas madre',ram:'Memoria RAM',ssd:'SSD',gpu:'Tarjetas gráficas',psu:'Fuentes',case:'Gabinetes',cooler:'Refrigeración'};
let catalog, products = [], categories = [], selectedCategory = 'all', view = 'catalog', compared = [];
let saved;
try {saved = JSON.parse(localStorage.getItem('riglab-v1') || '{}');} catch {saved = {};}
let build = saved && typeof saved.build === 'object' && saved.build !== null ? saved.build : {};
let favorites = Array.isArray(saved?.favorites) ? saved.favorites : [];
let budget = Number(saved?.budget) || 0;
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3300);}
function persist(){try{localStorage.setItem('riglab-v1',JSON.stringify({build,favorites,budget}));}catch{toast('El navegador no permite guardar los cambios en este dispositivo.');}}
function productById(id){return products.find(p=>p.id===id);}
function displayName(p){return p.name.replace(/^T\.V\.\s*|^M\.B\.\s*/,'').replace(/\s+/g,' ').trim();}
function categoryName(id){return categories.find(c=>c.id===id)?.name||id;}
function imageMarkup(p){return `<img src="${esc(safeUrl(p.image))}" alt="${esc(displayName(p))}" loading="lazy" referrerpolicy="no-referrer">`;}
function handleImages(root=document){root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const replacement=document.createElement('div');replacement.className='image-fallback';replacement.setAttribute('aria-label','Imagen no disponible');replacement.innerHTML=icon('cpu');img.replaceWith(replacement);},{once:true}));}
function setCategory(id){selectedCategory=id;view='catalog';syncNavigation();renderProducts();}
function syncNavigation(){
 $$('.category-tab,.side-category').forEach(el=>{const active=el.dataset.category===selectedCategory;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
 $$('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
 $('#catalog-title').innerHTML=view==='favorites'?'Tu hardware favorito<span>.</span>':'Encuentra tu próximo upgrade<span>.</span>';
 $('#favorite-count').textContent=favorites.length;
}
function renderCategories(){
 $('#category-tabs').innerHTML=[{id:'all',name:'Todos'},...categories].map(c=>`<button class="category-tab ${c.id==='all'?'active':''}" data-category="${c.id}" aria-pressed="${c.id==='all'}">${icon(c.id==='all'?'grid':c.id)}<span>${shortNames[c.id]||c.name}</span></button>`).join('');
 $('#side-categories').innerHTML=categories.map(c=>`<button class="nav-item side-category" data-category="${c.id}">${icon(c.id)}${c.name}</button>`).join('');
 $$('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{setCategory(btn.dataset.category);if(btn.classList.contains('side-category'))$('#catalog').scrollIntoView();}));
}
function tags(p){return Object.values(p.specs).map(s=>`<span class="spec-pill">${esc(s)}</span>`).join('')||`<span class="spec-pill">${esc(p.store)}</span>`;}
function renderProducts(){
 const query=normalize($('#search').value.trim()), store=$('#store').value, inStock=$('#stock-only').checked;
 let visible=products.filter(p=>(selectedCategory==='all'||p.category===selectedCategory)&&(view!=='favorites'||favorites.includes(p.id))&&(store==='all'||p.store===store)&&(!inStock||p.inStock===true)&&normalize(p.name+' '+p.store+' '+categoryName(p.category)).includes(query));
 const sort=$('#sort').value;
 if(sort==='price-asc')visible.sort((a,b)=>a.price-b.price);
 else if(sort==='price-desc')visible.sort((a,b)=>b.price-a.price);
 else if(sort==='name')visible.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 else visible.sort((a,b)=>Number(b.inStock===true)-Number(a.inStock===true)||categories.findIndex(c=>c.id===a.category)-categories.findIndex(c=>c.id===b.category));
 $('#result-count').textContent=`${visible.length} componentes`;
 $('#product-grid').innerHTML=visible.length?visible.map(p=>`<article class="product-card"><div class="product-visual"><span class="stock-badge ${p.inStock!==true?'no-stock':''}">${p.stale?'Lectura anterior':p.inStock===true?'Con stock':p.inStock===false?'Sin stock':'Por confirmar'}</span><button class="favorite-button ${favorites.includes(p.id)?'selected':''}" data-favorite="${p.id}" aria-label="${favorites.includes(p.id)?'Quitar de':'Añadir a'} favoritos: ${esc(p.name)}" aria-pressed="${favorites.includes(p.id)}">${icon('heart')}</button>${imageMarkup(p)}</div><div class="product-body"><span class="product-category">${esc(categoryName(p.category))}</span><button class="product-title" data-detail="${p.id}" title="${esc(p.name)}">${esc(displayName(p))}</button><div class="product-specs">${tags(p)}</div><div class="product-price-row"><strong class="product-price">${money(p.price)}</strong></div><div class="price-unit">CLP · ${p.paymentMethod?'por transferencia':'precio publicado'}</div><a class="store-link" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer"><span>${esc(p.store)}</span><span>Ver tienda ↗</span></a></div><div class="card-actions"><label class="compare-option"><input type="checkbox" data-compare="${p.id}" ${compared.includes(p.id)?'checked':''}>Comparar</label><button class="add-button ${build[p.category]===p.id?'selected':''}" data-add="${p.id}">${build[p.category]===p.id?'✓ Añadido':'+ Añadir'}</button></div></article>`).join(''):`<div class="empty-state">${icon(view==='favorites'?'heart':'search')}<h3>${view==='favorites'&&!favorites.length?'Tu próxima idea empieza con un favorito.':'No encontramos componentes.'}</h3><p>${view==='favorites'&&!favorites.length?'Toca el corazón de un componente para guardarlo aquí.':'Prueba con otro modelo o ajusta los filtros.'}</p><button id="reset-filters">Explorar todos</button></div>`;
 handleImages($('#product-grid'));
 $('#reset-filters')?.addEventListener('click',()=>{$('#search').value='';$('#store').value='all';$('#stock-only').checked=false;setCategory('all');});
 syncNavigation();
}
function addProduct(id){const p=productById(id);if(!p)return;if(build[p.category]===id){delete build[p.category];toast('Componente quitado del armado.');}else{build[p.category]=id;toast(`${categoryName(p.category)} añadido a tu armado${p.inStock===false?' · actualmente sin stock':''}.`);}persist();renderBuild();renderProducts();}
function renderBuild(){
 const count=Object.values(build).filter(id=>productById(id)).length;
 $('#build-count').textContent=count;$('#build-progress-text').textContent=`${count} de 8 componentes`;$('#build-percentage').textContent=`${Math.round(count/8*100)}%`;$('#build-progress-bar').style.width=`${count/8*100}%`;
 $('#build-slots').innerHTML=categories.map(c=>{const p=productById(build[c.id]);return `<div class="build-slot">${icon(c.id)}<div class="slot-copy"><span>${esc(c.name)}</span>${p?`<strong title="${esc(p.name)}">${esc(displayName(p))}</strong><small>${money(p.price)}${p.inStock===false?' · sin stock':''}</small>`:''}</div><button class="slot-button" data-slot="${c.id}" aria-label="${p?'Quitar':'Elegir'} ${esc(c.name)}">${p?'×':'+'}</button></div>`;}).join('');
 const total=Object.values(build).reduce((sum,id)=>sum+(productById(id)?.price||0),0);
 $('#build-total').textContent=money(total);$('#export-build').disabled=!count;$('#clear-build').disabled=!count;
 $('#budget-message').textContent=budget>0?(total>budget?`Superas tu presupuesto por ${money(total-budget)}`:`Te quedan ${money(budget-total)} de presupuesto`):'Define un monto para seguir tu presupuesto.';
 $('#budget-message').classList.toggle('over-budget',budget>0&&total>budget);
 const cpu=productById(build.cpu), board=productById(build.motherboard), ram=productById(build.ram), messages=[];
 if(cpu&&board&&cpu.specs.socket&&board.specs.socket){const ok=cpu.specs.socket===board.specs.socket;messages.push([ok,ok?'CPU y placa comparten socket. Falta verificar soporte de BIOS.':'El socket del procesador no coincide con el de la placa.']);}
 if(board&&ram&&board.specs.memory&&ram.specs.memory){const ok=board.specs.memory===ram.specs.memory;messages.push([ok,ok?'Placa y RAM comparten generación de memoria.':'La generación de RAM no coincide con la placa madre.']);}
 if(Object.values(build).some(id=>productById(id)?.inStock===false))messages.push([false,'Tu armado incluye productos sin stock.']);
 $('#compatibility').innerHTML=messages.map(([ok,m])=>`<div class="compatibility-item ${ok?'good':''}">${ok?'✓':'!'} ${m}</div>`).join('');
 $$('[data-slot]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.slot;if(build[id]){delete build[id];persist();renderBuild();renderProducts();}else{setCategory(id);$('#catalog').scrollIntoView();}}));
}
function updateCompare(){const count=compared.length;$('#compare-bar').hidden=!count;$('#compare-count').textContent=`${count} / 3 seleccionados`;$('#open-compare').disabled=count<2;}
function platformOptions(p){
 const boards=p.category==='motherboard'?[p]:products.filter(b=>b.platformSupport?.cpuIds.includes(p.id));
 const groups=boards.filter(b=>b.platformSupport&&!b.stale&&b.inStock===true).map(b=>{
  const options=p.category==='motherboard'?b.platformSupport.cpuIds.map(productById).filter(c=>c&&c.inStock===true&&!c.stale):[b];
  if(!options.length)return '';
  return `<p>${p.category==='cpu'?esc(displayName(b)):''} <a href="${esc(safeUrl(b.platformSupport.source))}" target="_blank" rel="noopener noreferrer">Soporte del fabricante ↗</a></p><ul>${options.map(c=>`<li>${esc(displayName(c))} · ${money(c.price)}</li>`).join('')}</ul>`;
 }).filter(Boolean);
 return groups.length?`<section class="platform-options"><h3>${p.category==='cpu'?'Placas':'Procesadores'} de esta plataforma con stock observado</h3><p>Soporte de plataforma contrastado con el fabricante. Confirma la revisión y la BIOS requerida para el modelo exacto antes de comprar. El stock corresponde a la última captura.</p>${groups.join('')}</section>`:'';
}
function showDetail(id){
 const p=productById(id);if(!p)return;const history=p.history||[];const days=new Set(history.map(h=>date(h.date)));
 const prices=history.map(h=>h.price);const min=prices.length?Math.min(...prices):p.price;const max=prices.length?Math.max(...prices):p.price;
 let chart='';
 if(days.size>=2){const points=history.map((h,i)=>`${20+i/(history.length-1)*600},${125-(h.price-min)/(max-min||1)*100}`).join(' ');chart=`<svg class="history-chart" viewBox="0 0 640 150" role="img" aria-label="Evolución del precio entre ${esc(date(history[0].date))} y ${esc(date(history.at(-1).date))}"><path d="M20 125H620" stroke="#ced6e2"/><polyline points="${points}" fill="none" stroke="#597298" stroke-width="3"/></svg>`;}
 $('#detail-content').innerHTML=`<div class="detail-summary">${imageMarkup(p)}<div><span class="product-category">${esc(categoryName(p.category))}</span><h2>${esc(displayName(p))}</h2><strong class="product-price">${money(p.price)}</strong><p>${esc(p.store)} · ${p.inStock===true?'Con stock':p.inStock===false?'Sin stock':'Stock por confirmar'}<br>Observado: ${esc(timestamp(p.checkedAt))} (Chile)</p><a class="detail-link" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(p.url))}">Ver producto en la tienda ↗</a></div></div><h3>Detalles del componente</h3><p>${esc(p.description||'Consulta la ficha técnica completa en la tienda.')}</p><div class="product-specs">${tags(p)}</div>${platformOptions(p)}<h3>Historial de precios</h3>${days.size<2?'<p>Estamos empezando a seguir este componente. Aún no hay lecturas de días distintos para mostrar una tendencia.</p>':''}<div class="history-summary"><div><span>MENOR PRECIO OBSERVADO</span><strong>${money(min)}</strong></div><div><span>OBSERVACIONES REALES</span><strong>${history.length}</strong></div></div>${chart}<table class="history-table"><thead><tr><th>Fecha y hora (Chile)</th><th>Precio</th></tr></thead><tbody>${history.slice(-10).reverse().map(h=>`<tr><td>${esc(timestamp(h.date))}</td><td>${money(h.price)}</td></tr>`).join('')}</tbody></table><p>Fuente: ${esc(p.sourceType)}. ${p.stale?'Esta lectura es anterior: la última actualización de la fuente falló.':''}</p>`;
 handleImages($('#detail-content'));$('#detail-dialog').showModal();
}
function showComparison(){
 const list=compared.map(productById).filter(Boolean);if(list.length<2)return;
 $('#compare-content').innerHTML=`${new Set(list.map(p=>p.category)).size>1?'<p>Seleccionaste categorías diferentes. Esta vista compara sus datos, no su rendimiento.</p>':''}<div class="compare-grid" style="grid-template-columns:repeat(${list.length},minmax(0,1fr))">${list.map(p=>`<article class="compare-product">${imageMarkup(p)}<h3>${esc(displayName(p))}</h3><strong class="product-price">${money(p.price)}</strong><p>${esc(categoryName(p.category))}</p><p>${esc(p.store)} · ${p.inStock===true?'Con stock':p.inStock===false?'Sin stock':'Por confirmar'}</p><p>Socket: ${esc(p.specs.socket||'No informado')}</p><p>RAM: ${esc(p.specs.memory||'No informada')}</p><p>Lectura: ${esc(timestamp(p.checkedAt))}</p><a class="detail-link" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(p.url))}">Ver tienda ↗</a><p></p><button class="add-button" data-add="${p.id}">Añadir al armado +</button></article>`).join('')}</div>`;
 handleImages($('#compare-content'));$('#compare-dialog').showModal();
}
function exportBuild(){
 const selected=categories.map(c=>[c,productById(build[c.id])]).filter(([,p])=>p);
 if(!selected.length)return;
 const format=$('#export-format').value;
 if(format==='xlsx'){
  try{
   const items=selected.map(([c,p])=>({...p,categoryName:c.name,captureLabel:date(p.checkedAt)+' '+timestamp(p.checkedAt)}));
   const book=quoteWorkbook(window.XLSX,items,budget,date(new Date())+' '+timestamp(new Date()));
   window.XLSX.writeFile(book,quoteFilename('xlsx'),{compression:true});
   toast('Cotización Excel exportada.');
  }catch(error){console.error(error);toast('No se pudo exportar Excel. Intenta nuevamente o elige TXT.');}
  return;
 }
 const total=selected.reduce((s,[,p])=>s+p.price,0);
 const text=['PC COTIZACION TUPC.LABS',`Exportado: ${timestamp(new Date())} (Chile)`,'',...selected.flatMap(([c,p])=>[`${c.name}: ${p.name}`,`${money(p.price)} CLP · ${p.store} · ${p.stale?'Lectura anterior; confirmar':p.inStock===true?'Con stock':p.inStock===false?'Sin stock':'Stock sin confirmar'}`,`Pago: ${p.paymentMethod||'Precio publicado; confirmar en tienda'}`,`Lectura: ${date(p.checkedAt)} ${timestamp(p.checkedAt)}`,p.url,'']),`TOTAL ESTIMADO: ${money(total)} CLP`,budget?`Presupuesto: ${money(budget)}`:'','Sin envío ni armado. Verifica BIOS, medidas, conectores, potencia y disponibilidad.','La refrigeración puede estar incluida con el procesador.'].join('\n');
 const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=quoteFilename('txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Tu lista de componentes se exportó.');
}
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]');if(add){addProduct(add.dataset.add);return;}
 const fav=e.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];persist();renderProducts();return;}
 const detail=e.target.closest('[data-detail]');if(detail)showDetail(detail.dataset.detail);
});
$('#product-grid').addEventListener('change',e=>{const id=e.target.dataset.compare;if(!id)return;if(e.target.checked){if(compared.length>=3){e.target.checked=false;toast('Puedes comparar hasta 3 componentes a la vez.');return;}compared.push(id);}else compared=compared.filter(x=>x!==id);updateCompare();});
['search','sort','store','stock-only'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',renderProducts));
$$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.view;selectedCategory='all';renderProducts();$('#catalog').scrollIntoView();}));
$('#nav-build').addEventListener('click',()=>$('#builder').scrollIntoView({block:'start'}));
$('#budget-input').value=budget||'';$('#budget-input').addEventListener('input',e=>{budget=Math.max(0,Number(e.target.value)||0);persist();renderBuild();});
$('#clear-build').addEventListener('click',()=>{build={};persist();renderBuild();renderProducts();toast('Armado vaciado.');});
$('#export-build').addEventListener('click',exportBuild);
$('#open-compare').addEventListener('click',showComparison);
$('#clear-compare').addEventListener('click',()=>{compared=[];updateCompare();renderProducts();});
$$('.close-dialog').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
['about-button','sources-button'].forEach(id=>$('#'+id).addEventListener('click',()=>$('#about-dialog').showModal()));
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();$('#search').focus();}});
let loadingCatalog=false;
async function init(){
 if(loadingCatalog)return;
 loadingCatalog=true;
 const hadCatalog=Boolean(catalog), selectedStore=$('#store').value;
 try{
  let response;
  try{
   response=await fetch('https://raw.githubusercontent.com/TATAPIERCE-dev/tupc-lab/main/dist/data/catalog.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('HTTP '+response.status);
  }catch(error){
   if(hadCatalog)throw error;
   response=await fetch('./data/catalog.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
  }
  if(!response.ok)throw Error('HTTP '+response.status);const next=await response.json();
  if(!Array.isArray(next.products)||!Array.isArray(next.categories)||!Number.isFinite(Date.parse(next.generatedAt)))throw Error('Catálogo inválido');
  catalog=next;products=next.products;categories=next.categories;
  if(!Array.isArray(products)||!Array.isArray(categories))throw Error('Catálogo inválido');
  build=Object.fromEntries(Object.entries(build).filter(([category,id])=>productById(id)?.category===category));favorites=favorites.filter(id=>productById(id));
  $('#total-products').textContent=products.length;$('#store-count').textContent=new Set(products.map(p=>p.store)).size;
  $('#updated-at').textContent='Última captura · '+timestamp(catalog.generatedAt);
  $('#store').innerHTML='<option value="all">Todas las tiendas</option>'+[...new Set(products.map(p=>p.store))].map(store=>`<option>${esc(store)}</option>`).join('');
  if([...$('#store').options].some(option=>option.value===selectedStore))$('#store').value=selectedStore;
  compared=compared.filter(id=>productById(id));
  $('#data-warning').hidden=true;
  const age=Date.now()-new Date(catalog.generatedAt).getTime();
  if(catalog.errors?.length||age>48*3600*1000){$('#data-warning').hidden=false;$('#data-warning').textContent=catalog.errors?.length?'Algunas fuentes no pudieron actualizarse. Revisa la fecha de lectura en cada ficha.':'Esta captura tiene más de 48 horas. Consulta el precio y stock actual en la tienda.';}
  renderCategories();syncNavigation();renderProducts();renderBuild();updateCompare();
 }catch(error){
  if(hadCatalog){$('#data-warning').hidden=false;$('#data-warning').textContent='No se pudo comprobar una nueva captura. Conservamos el catálogo anterior.';console.error(error);return;}
  $('#updated-at').textContent='Catálogo no disponible';$('#product-grid').innerHTML='<div class="empty-state"><h3>No pudimos cargar los componentes.</h3><p>Revisa la conexión y vuelve a intentar.</p><button id="retry">Volver a cargar</button></div>';$('#retry').addEventListener('click',init);console.error('No se pudo cargar el catálogo',error);}
 finally{loadingCatalog=false;}
}
init();

setInterval(()=>{if(!document.hidden)init();},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)init();});
window.addEventListener('online',()=>init());
