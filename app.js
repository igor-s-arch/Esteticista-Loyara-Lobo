(function(){
'use strict';

var KEYS={
 clients:'loyara_clients_v1',
 procedures:'loyara_procedures_v1',
 packages:'loyara_packages_v1',
 appointments:'loyara_appointments_v1',
 settings:'loyara_settings_v1'
};
var DEFAULT_PROCEDURES=[
 'Limpeza de pele','Drenagem linfática','Massagem modeladora','Massagem relaxante',
 'Hidratação facial','Revitalização facial','Peeling de diamante','Detox corporal',
 'Spa dos pés','Design de sobrancelhas','Depilação facial','Depilação corporal'
];

function uid(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2)}
function read(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return[]}}
function readObject(key,fallback){try{var v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:fallback}catch(e){return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function today(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+day}
function formatDate(v){return String(v||'').split('-').reverse().join('/')}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]||ch})}
function el(id){return document.getElementById(id)}
function qsa(sel){return Array.prototype.slice.call(document.querySelectorAll(sel))}
function toast(msg){var t=el('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(function(){t.classList.remove('show')},2300)}
function openModal(id){var m=el(id);if(m)m.classList.add('show')}
function closeModal(id){var m=el(id);if(m)m.classList.remove('show')}

var clients=read(KEYS.clients);
var procedures=read(KEYS.procedures);
var packages=read(KEYS.packages);
var appointments=read(KEYS.appointments);
var builder=[];
var DEFAULT_SETTINGS={
 lunchStart:'12:00',lunchEnd:'14:00',slotMinutes:30,
 days:{
  '0':{enabled:false,start:'08:00',end:'12:00'},
  '1':{enabled:true,start:'08:00',end:'18:00'},
  '2':{enabled:true,start:'08:00',end:'18:00'},
  '3':{enabled:true,start:'08:00',end:'18:00'},
  '4':{enabled:true,start:'08:00',end:'18:00'},
  '5':{enabled:true,start:'08:00',end:'18:00'},
  '6':{enabled:true,start:'08:00',end:'12:00'}
 }
};
var settings=readObject(KEYS.settings,JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
if(!settings.days)settings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
write(KEYS.settings,settings);

if(!localStorage.getItem(KEYS.procedures)){
 procedures=DEFAULT_PROCEDURES.map(function(name,i){return{id:'default-'+i,name:name,price:0,minPrice:0,duration:60,notes:''}});
 write(KEYS.procedures,procedures);
}

clients=clients.map(function(c){return Object.assign({favorite:false,notes:'',phone:''},c)});
procedures=procedures.map(function(p){
 var price=Number(p.price||0);
 var legacyFloor=Number(p.cost||0)+Number(p.minProfit||0);
 var minPrice=p.minPrice!=null?Number(p.minPrice||0):(legacyFloor>0?legacyFloor:price);
 return {id:p.id||uid(),name:p.name||'Procedimento',price:price,minPrice:minPrice,duration:Number(p.duration||60),notes:p.notes||''};
});
packages=packages.map(function(p){
 var items=(p.items||[]).map(function(i){
  var legacyFloor=Number(i.cost||0)+Number(i.minProfit||0);
  return Object.assign({},i,{minPrice:i.minPrice!=null?Number(i.minPrice||0):(legacyFloor>0?legacyFloor:Number(i.price||i.unitPrice||0)),unitPrice:Number(i.unitPrice!=null?i.unitPrice:i.price||0)});
 });
 return Object.assign({received:0,status:'Ativo'},p,{items:items});
});
write(KEYS.clients,clients);write(KEYS.procedures,procedures);write(KEYS.packages,packages);

function clientById(id){return clients.find(function(x){return x.id===id})}
function procedureById(id){return procedures.find(function(x){return x.id===id})}
function packageById(id){return packages.find(function(x){return x.id===id})}
function receivedTotal(p){
 if(Array.isArray(p.payments)&&p.payments.length)return p.payments.reduce(function(s,x){return s+Number(x.amount||0)},0);
 return Number(p.received||0);
}
function validProcedure(p){return p&&Number(p.price)>0&&Number(p.minPrice)>0&&Number(p.minPrice)<=Number(p.price)}

function navigate(name){
 qsa('.screen').forEach(function(s){s.classList.toggle('active',s.id==='screen-'+name)});
 qsa('.navBtn').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-screen')===name)});
 refreshAll();
}

function fillSelectors(){
 var clientOptions='<option value="">Selecione...</option>'+clients.map(function(c){return'<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('');
 ['packageClient','apptClient'].forEach(function(id){var x=el(id);if(x)x.innerHTML=clientOptions});
 var usable=procedures.filter(validProcedure);
 var procOptions='<option value="">Selecione...</option>'+usable.map(function(p){return'<option value="'+p.id+'">'+esc(p.name)+' — '+money(p.price)+'</option>'}).join('');
 ['builderProcedure','apptProcedure'].forEach(function(id){var x=el(id);if(x)x.innerHTML=procOptions});
 if(!el('packageInstallments').options.length){
  var html='';for(var i=1;i<=12;i++)html+='<option value="'+i+'">'+i+'x</option>';el('packageInstallments').innerHTML=html;
 }
}

function renderHero(){
 var t=today();
 var day=appointments.filter(function(a){return a.date===t&&a.status!=='Concluído'&&a.status!=='Cancelado'}).sort(function(a,b){return String(a.time).localeCompare(String(b.time))});
 var pending=packages.reduce(function(s,p){return s+Math.max(0,Number(p.total||0)-receivedTotal(p))},0);
 el('heroToday').textContent=String(day.length);
 el('heroNext').textContent=day[0]?day[0].clientName:'Livre';
 if(el('heroNextProc'))el('heroNextProc').textContent=day[0]?day[0].time+' · '+(day[0].procedureName||day[0].procedure||'Atendimento'):'Nenhum horário próximo';
 if(el('heroPending'))el('heroPending').textContent=money(pending);
}

function saveClient(){
 var name=el('clientName').value.trim();
 if(!name){toast('Digite o nome da cliente.');return}
 clients.unshift({id:uid(),name:name,phone:el('clientPhone').value.trim(),notes:el('clientNotes').value.trim(),favorite:el('clientFavorite').checked,createdAt:new Date().toISOString()});
 write(KEYS.clients,clients);
 el('clientName').value='';el('clientPhone').value='';el('clientNotes').value='';el('clientFavorite').checked=false;
 closeModal('clientModal');refreshAll();toast('Cliente salva.');
}
function toggleFavorite(id){
 var c=clientById(id);if(!c)return;c.favorite=!c.favorite;write(KEYS.clients,clients);renderClients();
}
function openWhats(phone,text){
 var p=String(phone||'').replace(/\D/g,'');
 var url='https://wa.me/'+(p?('55'+p.replace(/^55/,'')):'')+'?text='+encodeURIComponent(text);
 window.open(url,'_blank','noopener,noreferrer');
}
function messageClient(id){
 var c=clientById(id);if(!c)return;
 openWhats(c.phone,'Olá, '+c.name+'! 💗 Passando para saber como você está. Quando quiser reservar seu próximo momento de cuidado, estou por aqui.\n\nEsteticista Loyara Lobo');
}
function reminderClient(id){
 var c=clientById(id);if(!c)return;
 var next=appointments.filter(function(a){return a.clientId===id&&a.status==='Agendado'}).sort(function(a,b){return(a.date+a.time).localeCompare(b.date+b.time)})[0];
 var text=next?'Olá, '+c.name+'! 💗 Passando para lembrar do seu atendimento de '+next.procedureName+' no dia '+formatDate(next.date)+' às '+next.time+'. Qualquer imprevisto, me avise com antecedência. Te espero!\n\nEsteticista Loyara Lobo':'Olá, '+c.name+'! 💗 Passando para lembrar que estou à disposição para seu próximo atendimento.\n\nEsteticista Loyara Lobo';
 openWhats(c.phone,text);
}
function renderClients(){
 var term=(el('clientSearch').value||'').toLowerCase().trim();
 var data=clients.filter(function(c){return(c.name+' '+c.phone).toLowerCase().indexOf(term)>=0});
 var favorites=clients.filter(function(c){return c.favorite});
 el('favoriteClients').innerHTML=favorites.length?favorites.map(function(c){
  var initials=c.name.split(/\s+/).slice(0,2).map(function(p){return p.charAt(0).toUpperCase()}).join('');
  return'<div class="favPerson"><button class="favAvatar" data-msg="'+c.id+'" title="Enviar mensagem">'+esc(initials||'♡')+'</button><span>'+esc(c.name)+'</span></div>';
 }).join('')+'<div class="favPerson"><button class="favAvatar" data-open-inline="clientModal">＋</button><span>Adicionar</span></div>':'<div class="favPerson"><button class="favAvatar" data-open-inline="clientModal">＋</button><span>Adicionar favorita</span></div>';
 el('clientList').innerHTML=data.length?data.map(function(c){
  var ps=packages.filter(function(p){return p.clientId===c.id});
  var ag=appointments.filter(function(a){return a.clientId===c.id});
  return'<div class="item"><div class="itemTop"><div><strong>'+esc(c.name)+'</strong><div class="meta">'+esc(c.phone||'Sem telefone')+' · '+ps.length+' pacote(s) · '+ag.length+' agendamento(s)</div></div><button class="favorite '+(c.favorite?'on':'')+'" data-fav="'+c.id+'">'+(c.favorite?'♥':'♡')+'</button></div>'+(c.notes?'<div class="meta">'+esc(c.notes)+'</div>':'')+'<div class="actions"><button class="btn secondary sm" data-client-detail="'+c.id+'">Ver histórico</button><button class="btn secondary sm" data-msg="'+c.id+'">WhatsApp</button><button class="btn gold sm" data-rem="'+c.id+'">Lembrete</button></div></div>';
 }).join(''):'<div class="empty">Nenhuma cliente cadastrada.</div>';
 qsa('[data-fav]').forEach(function(b){b.onclick=function(){toggleFavorite(b.getAttribute('data-fav'))}});
 qsa('[data-msg]').forEach(function(b){b.onclick=function(){messageClient(b.getAttribute('data-msg'))}});
 qsa('[data-rem]').forEach(function(b){b.onclick=function(){reminderClient(b.getAttribute('data-rem'))}});
 qsa('[data-client-detail]').forEach(function(b){b.onclick=function(){openClientDetail(b.getAttribute('data-client-detail'))}});
 qsa('[data-open-inline]').forEach(function(b){b.onclick=function(){openModal(b.getAttribute('data-open-inline'))}});
}

function openClientDetail(id){
 var c=clientById(id);if(!c)return;
 var ps=packages.filter(function(p){return p.clientId===id});
 var ag=appointments.filter(function(a){return a.clientId===id}).sort(function(a,b){return(b.date+b.time).localeCompare(a.date+a.time)});
 el('clientDetailTitle').textContent=c.name;
 el('clientDetailBody').innerHTML=
  '<div class="card" style="box-shadow:none"><div class="meta">'+esc(c.phone||'Sem telefone')+'</div>'+(c.notes?'<div class="meta" style="margin-top:7px">'+esc(c.notes)+'</div>':'')+'<div class="actions"><button class="btn secondary sm" id="detailMsg">WhatsApp</button><button class="btn gold sm" id="detailReminder">Lembrete</button></div></div>'+
  '<div class="historyBlock"><h4>Pacotes</h4>'+(ps.length?ps.map(function(p){return'<div class="item"><strong>'+esc(p.name)+'</strong><div class="meta">'+money(p.total)+' · recebido '+money(receivedTotal(p))+'</div></div>'}).join(''):'<div class="empty">Nenhum pacote.</div>')+'</div>'+
  '<div class="historyBlock"><h4>Agendamentos</h4>'+(ag.length?ag.map(function(a){return'<div class="item"><strong>'+esc(a.procedureName||a.procedure||'Atendimento')+'</strong><div class="meta">'+formatDate(a.date)+' às '+esc(a.time)+' · '+esc(a.status)+'</div>'+(a.notes?'<div class="meta">'+esc(a.notes)+'</div>':'')+'</div>'}).join(''):'<div class="empty">Nenhum agendamento.</div>')+'</div>';
 openModal('clientDetailModal');
 if(el('detailMsg'))el('detailMsg').onclick=function(){messageClient(id)};
 if(el('detailReminder'))el('detailReminder').onclick=function(){reminderClient(id)};
}

function quickAddProcedure(){
 var name=el('quickProcName').value.trim(),price=Number(el('quickProcPrice').value||0),min=Number(el('quickProcMin').value||0),duration=Math.max(15,Number(el('quickProcDuration').value||60));
 if(!name){toast('Digite o nome do procedimento.');return}
 if(price<=0){toast('Digite o preço avulso.');return}
 if(min<=0||min>price){toast('O menor valor seguro deve ser maior que zero e não pode passar do preço avulso.');return}
 procedures.unshift({id:uid(),name:name,price:price,minPrice:min,duration:duration,notes:el('quickProcNotes').value.trim()});
 write(KEYS.procedures,procedures);
 ['quickProcName','quickProcPrice','quickProcMin','quickProcNotes'].forEach(function(id){el(id).value=''});el('quickProcDuration').value='60';
 refreshAll();toast('Procedimento adicionado.');
}
function renderProcedures(){
 var box=el('procedureList');
 if(!procedures.length){box.innerHTML='<div class="empty">Nenhum procedimento cadastrado.</div>';return}
 box.innerHTML=procedures.map(function(p){
  var ready=validProcedure(p);
  return'<div class="item"><div class="itemTop"><div><strong>'+esc(p.name)+'</strong><div class="meta">Avulso '+(p.price?money(p.price):'não definido')+' · mínimo seguro '+(p.minPrice?money(p.minPrice):'não definido')+' · '+p.duration+' min</div></div><span class="badge '+(ready?'ok':'warn')+'">'+(ready?'Pronto':'Configurar')+'</span></div><div class="grid3" style="margin-top:8px"><input class="input" data-p-price="'+p.id+'" type="number" step="0.01" value="'+(p.price||'')+'" placeholder="Avulso"><input class="input" data-p-min="'+p.id+'" type="number" step="0.01" value="'+(p.minPrice||'')+'" placeholder="Mínimo"><input class="input" data-p-duration="'+p.id+'" type="number" value="'+p.duration+'" placeholder="Min"></div><div class="actions" style="margin-top:8px"><button class="btn secondary sm" data-p-save="'+p.id+'">Salvar</button><button class="btn danger sm" data-p-delete="'+p.id+'">Excluir</button></div></div>';
 }).join('');
 qsa('[data-p-save]').forEach(function(b){b.onclick=function(){updateProcedure(b.getAttribute('data-p-save'))}});
 qsa('[data-p-delete]').forEach(function(b){b.onclick=function(){deleteProcedure(b.getAttribute('data-p-delete'))}});
}
function updateProcedure(id){
 var p=procedureById(id);if(!p)return;
 var price=Number(document.querySelector('[data-p-price="'+id+'"]').value||0),min=Number(document.querySelector('[data-p-min="'+id+'"]').value||0),duration=Math.max(15,Number(document.querySelector('[data-p-duration="'+id+'"]').value||60));
 if(price<=0||min<=0||min>price){toast('Confira o preço avulso e o menor valor seguro.');return}
 p.price=price;p.minPrice=min;p.duration=duration;write(KEYS.procedures,procedures);refreshAll();toast('Procedimento atualizado.');
}
function deleteProcedure(id){
 if(!confirm('Excluir este procedimento? Os pacotes já salvos continuam iguais.'))return;
 procedures=procedures.filter(function(p){return p.id!==id});write(KEYS.procedures,procedures);refreshAll();
}

function addBuilder(){
 var p=procedureById(el('builderProcedure').value),sessions=Math.max(1,Number(el('builderSessions').value||1));
 if(!p||!validProcedure(p)){toast('Escolha um procedimento configurado.');return}
 var old=builder.find(function(i){return i.procedureId===p.id});
 if(old)old.sessions+=sessions;
 else builder.push({procedureId:p.id,name:p.name,sessions:sessions,unitPrice:Number(p.price),minPrice:Number(p.minPrice)});
 el('builderSessions').value='1';renderBuilder();
}
function renderBuilder(){
 el('builderList').innerHTML=builder.length?builder.map(function(i,index){
  return'<div class="builderRow"><div><strong>'+esc(i.name)+'</strong><div class="meta">'+money(i.unitPrice)+' / sessão</div></div><input type="number" min="1" value="'+i.sessions+'" data-b-sessions="'+index+'"><input type="number" min="0" step="0.01" value="'+i.unitPrice+'" data-b-price="'+index+'"><button class="remove" data-b-remove="'+index+'">×</button></div>';
 }).join(''):'<div class="empty">Adicione os procedimentos do pacote.</div>';
 qsa('[data-b-sessions]').forEach(function(inp){inp.onchange=function(){var i=Number(inp.getAttribute('data-b-sessions'));builder[i].sessions=Math.max(1,Number(inp.value||1));renderPackageSummary()}});
 qsa('[data-b-price]').forEach(function(inp){inp.onchange=function(){var i=Number(inp.getAttribute('data-b-price'));builder[i].unitPrice=Math.max(0,Number(inp.value||0));renderPackageSummary()}});
 qsa('[data-b-remove]').forEach(function(b){b.onclick=function(){builder.splice(Number(b.getAttribute('data-b-remove')),1);renderBuilder()}});
 renderPackageSummary();
}
function calcPackage(){
 var subtotal=builder.reduce(function(s,i){return s+i.sessions*i.unitPrice},0);
 var floor=builder.reduce(function(s,i){return s+i.sessions*i.minPrice},0);
 var sessions=builder.reduce(function(s,i){return s+i.sessions},0);
 var discountPct=Math.min(100,Math.max(0,Number(el('packageDiscount').value||0)));
 var discount=subtotal*discountPct/100,total=Math.max(0,subtotal-discount);
 var maxDiscount=subtotal>0?Math.max(0,(subtotal-floor)/subtotal*100):0;
 var tier=sessions>=10?15:sessions>=6?10:sessions>=3?7:5;
 var suggested=Math.min(tier,maxDiscount);
 var installments=Math.max(1,Number(el('packageInstallments').value||1));
 return{subtotal:subtotal,floor:floor,sessions:sessions,discountPct:discountPct,discount:discount,total:total,maxDiscount:maxDiscount,suggested:suggested,installments:installments};
}
function renderPackageSummary(){
 var c=calcPackage();
 el('packageSummary').innerHTML='<div class="sumRow"><span>Valor avulso</span><strong>'+money(c.subtotal)+'</strong></div><div class="sumRow"><span>Economia da cliente</span><strong>'+money(c.discount)+'</strong></div><div class="sumRow"><span>Preço mínimo seguro</span><strong>'+money(c.floor)+'</strong></div><div class="sumRow"><span>Desconto aplicado</span><strong>'+c.discountPct.toFixed(1).replace('.',',')+'%</strong></div><div class="sumRow"><span>Parcelamento</span><strong>'+c.installments+'x de '+money(c.installments?c.total/c.installments:0)+'</strong></div><div class="sumRow total"><span>Valor do pacote</span><strong>'+money(c.total)+'</strong></div>';
 var box=el('safeBox');
 if(!builder.length){box.className='safe ok';box.textContent='Adicione os procedimentos para calcular a sugestão.'}
 else if(c.total+0.01<c.floor){box.className='safe bad';box.textContent='🔴 Desconto abaixo do preço mínimo seguro. Reduza o desconto.'}
 else if(c.discountPct>c.suggested+3){box.className='safe warn';box.textContent='🟡 Ainda está acima do mínimo, mas o desconto passou da sugestão. Sugestão: até '+c.suggested.toFixed(0)+'%.'}
 else{box.className='safe ok';box.textContent='🟢 Desconto dentro do limite definido. Sugestão: até '+c.suggested.toFixed(0)+'% · máximo permitido pelo mínimo: '+c.maxDiscount.toFixed(1).replace('.',',')+'%.'}
}
function draftPackage(){
 var c=clientById(el('packageClient').value),calc=calcPackage();
 if(!c){toast('Escolha a cliente.');return null}
 if(!builder.length){toast('Adicione pelo menos um procedimento.');return null}
 if(calc.total+0.01<calc.floor){toast('O valor do pacote está abaixo do mínimo seguro.');return null}
 return{id:uid(),clientId:c.id,clientName:c.name,clientPhone:c.phone,name:el('packageName').value.trim()||'Pacote Personalizado',items:builder.map(function(i){return Object.assign({},i)}),subtotal:calc.subtotal,safeFloor:calc.floor,discountPct:calc.discountPct,total:calc.total,received:0,installments:calc.installments,validity:Number(el('packageValidity').value||90),createdAt:new Date().toISOString(),status:'Ativo'};
}
function savePackage(){
 var p=draftPackage();if(!p)return;packages.unshift(p);write(KEYS.packages,packages);builder=[];el('packageName').value='';el('packageDiscount').value='0';refreshAll();toast('Pacote salvo.');
}
function proposalText(){
 var p=draftPackage();if(!p)return'';
 return'✨ '+p.name.toUpperCase()+'\n\nCliente: '+p.clientName+'\n\n'+p.items.map(function(i){return'• '+i.name+': '+i.sessions+' sessão(ões)'}).join('\n')+'\n\nValor avulso: '+money(p.subtotal)+'\nDesconto: '+p.discountPct+'%\nVALOR DO PACOTE: '+money(p.total)+'\nPagamento: '+p.installments+'x de '+money(p.total/p.installments)+'\nValidade: '+p.validity+' dias\n\nSerá um prazer cuidar de você! 💗\nEsteticista Loyara Lobo';
}
function copyProposal(){var t=proposalText();if(!t)return;navigator.clipboard.writeText(t).then(function(){toast('Proposta copiada.')}).catch(function(){toast('Não foi possível copiar.')})}
function sendProposal(){var t=proposalText();if(!t)return;var c=clientById(el('packageClient').value);openWhats(c?c.phone:'',t)}
function renderPackages(){
 el('packageList').innerHTML=packages.length?packages.map(function(p){
  var paid=receivedTotal(p),pending=Math.max(0,Number(p.total||0)-paid);
  return'<div class="item"><div class="itemTop"><div><strong>'+esc(p.name)+'</strong><div class="meta">'+esc(p.clientName)+' · '+(p.items||[]).reduce(function(s,i){return s+Number(i.sessions||0)},0)+' sessão(ões)</div></div><span class="badge">'+money(p.total)+'</span></div><div class="meta">Recebido '+money(paid)+' · falta '+money(pending)+'</div></div>';
 }).join(''):'<div class="empty">Nenhum pacote salvo.</div>';
}

function saveAppointment(){
 var c=clientById(el('apptClient').value),p=procedureById(el('apptProcedure').value),date=el('apptDate').value,time=el('apptTime').value;
 if(!c||!p||!date||!time){toast('Preencha cliente, procedimento, data e hora.');return}
 var clash=appointments.some(function(a){return a.date===date&&a.time===time&&a.status==='Agendado'});
 if(clash){toast('Esse horário já está ocupado.');return}
 appointments.push({id:uid(),clientId:c.id,clientName:c.name,clientPhone:c.phone,procedureId:p.id,procedureName:p.name,date:date,time:time,notes:el('apptNotes').value.trim(),status:'Agendado',createdAt:new Date().toISOString()});
 appointments.sort(function(a,b){return(a.date+a.time).localeCompare(b.date+b.time)});
 write(KEYS.appointments,appointments);el('apptNotes').value='';closeModal('appointmentModal');refreshAll();toast('Agendamento salvo.');
}
function completeAppointment(id){var a=appointments.find(function(x){return x.id===id});if(!a)return;a.status='Concluído';write(KEYS.appointments,appointments);refreshAll()}
function cancelAppointment(id){var a=appointments.find(function(x){return x.id===id});if(!a)return;if(!confirm('Cancelar este agendamento?'))return;a.status='Cancelado';write(KEYS.appointments,appointments);refreshAll()}
function bookingReminder(id){
 var a=appointments.find(function(x){return x.id===id});if(!a)return;
 openWhats(a.clientPhone,'Olá, '+a.clientName+'! 💗 Seu atendimento de '+a.procedureName+' está confirmado para '+formatDate(a.date)+' às '+a.time+'. Qualquer imprevisto, me avise com antecedência. Te espero!\n\nEsteticista Loyara Lobo');
}
function hm(v){var p=String(v||'00:00').split(':');return Number(p[0]||0)*60+Number(p[1]||0)}
function mh(v){return String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0')}
function dayIndex(date){return String(new Date(date+'T12:00:00').getDay())}
function buildSlots(date){
 var cfg=settings.days[dayIndex(date)]||{enabled:false,start:'08:00',end:'18:00'};
 if(!cfg.enabled)return[];
 var out=[],start=hm(cfg.start),end=hm(cfg.end),step=Math.max(30,Number(settings.slotMinutes||30)),ls=hm(settings.lunchStart),le=hm(settings.lunchEnd);
 for(var t=start;t<end;t+=step){
  var time=mh(t),inLunch=le>ls&&t>=ls&&t<le,busy=appointments.some(function(a){return a.date===date&&a.time===time&&a.status==='Agendado'});
  if(!inLunch)out.push({time:time,busy:busy});
 }
 return out;
}
function renderAgendaSlots(){
 if(!el('agendaDay'))return;
 var date=el('agendaDay').value||today();el('agendaDay').value=date;
 var slots=buildSlots(date);
 el('agendaSlots').innerHTML=slots.length?slots.map(function(s){return'<button class="timeChip '+(s.busy?'occupied':'free')+'" '+(s.busy?'disabled':'data-slot="'+s.time+'"')+'>'+s.time+(s.busy?' · ocupado':'')+'</button>'}).join(''):'<div class="empty" style="grid-column:1/-1">Sem atendimento configurado neste dia.</div>';
 qsa('[data-slot]').forEach(function(b){b.onclick=function(){openModal('appointmentModal');fillSelectors();el('apptDate').value=date;el('apptTime').value=b.getAttribute('data-slot')}});
}
function renderScheduleModal(){
 var names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 el('scheduleRows').innerHTML=names.map(function(name,i){var d=settings.days[String(i)]||DEFAULT_SETTINGS.days[String(i)];return'<div class="scheduleGrid" style="margin-bottom:7px"><label><input type="checkbox" data-day-enabled="'+i+'" '+(d.enabled?'checked':'')+'> <strong>'+name+'</strong></label><input class="input" type="time" data-day-start="'+i+'" value="'+d.start+'"><input class="input" type="time" data-day-end="'+i+'" value="'+d.end+'"></div>'}).join('');
 el('lunchStart').value=settings.lunchStart;el('lunchEnd').value=settings.lunchEnd;el('slotMinutes').value=String(settings.slotMinutes||30);
}
function saveSchedule(){
 for(var i=0;i<7;i++){settings.days[String(i)]={enabled:document.querySelector('[data-day-enabled="'+i+'"]').checked,start:document.querySelector('[data-day-start="'+i+'"]').value||'08:00',end:document.querySelector('[data-day-end="'+i+'"]').value||'18:00'}}
 settings.lunchStart=el('lunchStart').value||'12:00';settings.lunchEnd=el('lunchEnd').value||'14:00';settings.slotMinutes=Number(el('slotMinutes').value||30);
 write(KEYS.settings,settings);closeModal('scheduleModal');renderAgendaSlots();toast('Horários salvos.');
}
function renderAgenda(){
 var data=appointments.slice().sort(function(a,b){return(a.date+a.time).localeCompare(b.date+b.time)});
 el('agendaList').innerHTML=data.length?data.map(function(a){
  var cls=a.status==='Concluído'?'ok':a.status==='Cancelado'?'bad':'';
  return'<div class="item"><div class="itemTop"><div><strong>'+esc(a.clientName)+'</strong><div class="meta">'+formatDate(a.date)+' às '+esc(a.time)+' · '+esc(a.procedureName||a.procedure||'Procedimento')+'</div>'+(a.notes?'<div class="meta">'+esc(a.notes)+'</div>':'')+'</div><span class="badge '+cls+'">'+a.status+'</span></div><div class="actions">'+(a.status==='Agendado'?'<button class="btn green sm" data-appt-complete="'+a.id+'">Concluir</button><button class="btn danger sm" data-appt-cancel="'+a.id+'">Cancelar</button>':'')+'<button class="btn gold sm" data-appt-reminder="'+a.id+'">Enviar lembrete</button></div></div>';
 }).join(''):'<div class="empty">Nenhum atendimento agendado.</div>';
 qsa('[data-appt-complete]').forEach(function(b){b.onclick=function(){completeAppointment(b.getAttribute('data-appt-complete'))}});
 qsa('[data-appt-cancel]').forEach(function(b){b.onclick=function(){cancelAppointment(b.getAttribute('data-appt-cancel'))}});
 qsa('[data-appt-reminder]').forEach(function(b){b.onclick=function(){bookingReminder(b.getAttribute('data-appt-reminder'))}});
 el('bookingLink').textContent=location.href.split(/[?#]/)[0]+'?agendar=1';
 renderAgendaSlots();
}

function renderFinance(){
 var contracted=packages.reduce(function(s,p){return s+Number(p.total||0)},0),received=packages.reduce(function(s,p){return s+receivedTotal(p)},0),pending=Math.max(0,contracted-received);
 el('financeKpis').innerHTML='<div class="kpi"><small>Faturamento contratado</small><strong>'+money(contracted)+'</strong></div><div class="kpi"><small>Recebido</small><strong>'+money(received)+'</strong></div><div class="kpi"><small>A receber</small><strong>'+money(pending)+'</strong></div><div class="kpi"><small>Pacotes vendidos</small><strong>'+packages.length+'</strong></div>';
 el('financePackages').innerHTML=packages.length?packages.map(function(p){
  return'<div class="item"><div class="itemTop"><div><strong>'+esc(p.clientName)+' — '+esc(p.name)+'</strong><div class="meta">'+money(receivedTotal(p))+' de '+money(p.total)+'</div></div><button class="btn secondary sm" data-pay="'+p.id+'">Atualizar</button></div></div>';
 }).join(''):'<div class="empty">Nenhum pacote vendido.</div>';
 qsa('[data-pay]').forEach(function(b){b.onclick=function(){openPayment(b.getAttribute('data-pay'))}});
}
function openPayment(id){var p=packageById(id);if(!p)return;el('paymentPackageId').value=id;el('paymentAmount').value=receivedTotal(p);openModal('paymentModal')}
function savePayment(){var p=packageById(el('paymentPackageId').value);if(!p)return;var v=Math.max(0,Number(el('paymentAmount').value||0));p.received=Math.min(Number(p.total||0),v);p.payments=[];write(KEYS.packages,packages);closeModal('paymentModal');refreshAll();toast('Recebimento atualizado.')}

function copyBookingLink(){
 navigator.clipboard.writeText(el('bookingLink').textContent).then(function(){toast('Link copiado. A sincronização entre celulares será ativada quando conectarmos a nuvem.')}).catch(function(){toast('Não foi possível copiar.')});
}

function bind(){
 qsa('.navBtn').forEach(function(b){b.onclick=function(){navigate(b.getAttribute('data-screen'))}});
 qsa('[data-open]').forEach(function(b){b.onclick=function(){openModal(b.getAttribute('data-open'));if(b.getAttribute('data-open')==='procedureModal')renderProcedures();if(b.getAttribute('data-open')==='appointmentModal'){fillSelectors();el('apptDate').value=today()}}});
 qsa('[data-open-inline]').forEach(function(b){b.onclick=function(){openModal(b.getAttribute('data-open-inline'))}});
 qsa('[data-close]').forEach(function(b){b.onclick=function(){closeModal(b.getAttribute('data-close'))}});
 if(el('goPackageHome'))el('goPackageHome').onclick=function(){navigate('packages')};
 if(el('goAgendaHome'))el('goAgendaHome').onclick=function(){navigate('agenda')};
 if(el('goNewAppointment'))el('goNewAppointment').onclick=function(){openModal('appointmentModal');fillSelectors();el('apptDate').value=today()};
 if(el('goFavoritesHome'))el('goFavoritesHome').onclick=function(){el('favoriteClients').scrollIntoView({behavior:'smooth',block:'center'})};
 if(el('goBookingHome'))el('goBookingHome').onclick=function(){navigate('agenda');showAgendaPanel('link')};
 if(el('showAllClients'))el('showAllClients').onclick=function(){el('allClientsCard').scrollIntoView({behavior:'smooth',block:'start'})};
 if(el('agendaTabMine'))el('agendaTabMine').onclick=function(){showAgendaPanel('mine')};
 if(el('agendaTabLink'))el('agendaTabLink').onclick=function(){showAgendaPanel('link')};
 if(el('agendaDay'))el('agendaDay').onchange=renderAgendaSlots;
 if(el('openScheduleSettings'))el('openScheduleSettings').onclick=function(){renderScheduleModal();openModal('scheduleModal')};
 if(el('saveSchedule'))el('saveSchedule').onclick=saveSchedule;
 el('saveClient').onclick=saveClient;el('clientSearch').oninput=renderClients;el('quickAddProcedure').onclick=quickAddProcedure;el('addBuilder').onclick=addBuilder;el('packageDiscount').oninput=renderPackageSummary;el('packageInstallments').onchange=renderPackageSummary;el('savePackage').onclick=savePackage;el('copyProposal').onclick=copyProposal;el('sendProposal').onclick=sendProposal;el('saveAppointment').onclick=saveAppointment;el('savePayment').onclick=savePayment;el('copyBookingLink').onclick=copyBookingLink;
}

function showAgendaPanel(which){
 var mine=which!=='link';
 if(el('agendaMine'))el('agendaMine').classList.toggle('active',mine);
 if(el('agendaLinkPanel'))el('agendaLinkPanel').classList.toggle('active',!mine);
 if(el('agendaTabMine'))el('agendaTabMine').classList.toggle('active',mine);
 if(el('agendaTabLink'))el('agendaTabLink').classList.toggle('active',!mine);
}

function refreshAll(){fillSelectors();renderHero();renderClients();renderProcedures();renderBuilder();renderPackages();renderAgenda();renderFinance()}

var deferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;if(el('installBtn'))el('installBtn').style.display='block'});
if(el('installBtn'))el('installBtn').addEventListener('click',function(){if(!deferredPrompt){toast('Use o menu do navegador e escolha Adicionar à tela inicial.');return}deferredPrompt.prompt();deferredPrompt.userChoice.finally(function(){deferredPrompt=null;if(el('installBtn'))el('installBtn').style.display='none'})});

bind();refreshAll();
if(el('agendaDay'))el('agendaDay').value=today();
if(location.search.indexOf('agendar=1')>=0){navigate('agenda');showAgendaPanel('link')}
})();