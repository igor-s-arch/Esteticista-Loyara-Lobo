(function(){
'use strict';

var KEYS={
 clients:'loyara_clients_v1',
 procedures:'loyara_procedures_v1',
 packages:'loyara_packages_v1',
 appointments:'loyara_appointments_v1'
};

function uid(){
 if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
 return String(Date.now())+Math.random().toString(16).slice(2);
}
function read(key){
 try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return[]}
}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function today(){
 var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
 return d.getFullYear()+'-'+m+'-'+day;
}
function monthKey(date){
 var d=date?new Date(date+'T12:00:00'):new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function esc(v){
 return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]||ch;
 });
}
function el(id){return document.getElementById(id)}
function qsa(sel){return Array.prototype.slice.call(document.querySelectorAll(sel))}
function toast(msg){
 var t=el('toast');if(!t)return;
 t.textContent=msg;t.classList.add('show');
 clearTimeout(toast.timer);toast.timer=setTimeout(function(){t.classList.remove('show')},2300);
}
function openModal(id){var m=el(id);if(m)m.classList.add('show')}
function closeModal(id){var m=el(id);if(m)m.classList.remove('show')}

var defaultNames=[
 'Limpeza de pele','Drenagem linfática','Massagem modeladora','Massagem relaxante',
 'Hidratação facial','Revitalização facial','Peeling de diamante','Spa dos pés',
 'Design de sobrancelhas','Depilação facial','Depilação corporal','Microagulhamento'
];
var clients=read(KEYS.clients);
var procedures=read(KEYS.procedures);
var packages=read(KEYS.packages);
var appointments=read(KEYS.appointments);
var builder=[];

if(!localStorage.getItem(KEYS.procedures)){
 procedures=defaultNames.map(function(name){
  return {id:uid(),name:name,price:0,cost:0,minProfit:0,duration:60,notes:''};
 });
 write(KEYS.procedures,procedures);
}

function validProcedure(p){
 var floor=Number(p.cost||0)+Number(p.minProfit||0);
 return Number(p.price||0)>floor&&floor>0;
}
function procFloor(p){return Number(p.cost||0)+Number(p.minProfit||0)}
function clientById(id){return clients.find(function(x){return x.id===id})}
function packageById(id){return packages.find(function(x){return x.id===id})}
function procedureById(id){return procedures.find(function(x){return x.id===id})}
function receivedTotal(p){
 return (p.payments||[]).reduce(function(sum,x){return sum+Number(x.amount||0)},0);
}
function packageDoneSessions(p){
 return (p.items||[]).reduce(function(sum,x){return sum+Number(x.done||0)},0);
}
function packageTotalSessions(p){
 return (p.items||[]).reduce(function(sum,x){return sum+Number(x.sessions||0)},0);
}
function packageProgress(p){
 var total=packageTotalSessions(p);return total?Math.min(100,packageDoneSessions(p)/total*100):0;
}
function packageCost(p){
 return (p.items||[]).reduce(function(sum,x){return sum+Number(x.sessions||0)*Number(x.cost||0)},0);
}
function packageMinFloor(p){
 return (p.items||[]).reduce(function(sum,x){
  return sum+Number(x.sessions||0)*(Number(x.cost||0)+Number(x.minProfit||0));
 },0);
}
function packageGross(p){
 return (p.items||[]).reduce(function(sum,x){return sum+Number(x.sessions||0)*Number(x.price||0)},0);
}

function navigate(name){
 qsa('.screen').forEach(function(s){s.classList.toggle('active',s.id==='screen-'+name)});
 qsa('.navBtn').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-screen')===name)});
 if(name==='clients')renderClients();
 if(name==='procedures')renderProcedures();
 if(name==='packages')renderPackages();
 if(name==='agenda')renderAgenda();
 if(name==='finance')renderFinance();
 window.scrollTo({top:0,behavior:'smooth'});
}

function bind(){
 qsa('.navBtn').forEach(function(b){b.addEventListener('click',function(){navigate(b.getAttribute('data-screen'))})});
 qsa('[data-open]').forEach(function(b){b.addEventListener('click',function(){openModal(b.getAttribute('data-open'));if(b.getAttribute('data-open')==='appointmentModal')prepareAppointmentModal()})});
 qsa('[data-close]').forEach(function(b){b.addEventListener('click',function(){closeModal(b.getAttribute('data-close'))})});
 el('saveClient').addEventListener('click',saveClient);
 el('saveProcedure').addEventListener('click',saveProcedure);
 el('addBuilder').addEventListener('click',addToBuilder);
 el('packageDiscount').addEventListener('input',renderBuilderSummary);
 el('packageInstallments').addEventListener('change',renderBuilderSummary);
 el('savePackage').addEventListener('click',savePackage);
 el('copyProposal').addEventListener('click',copyProposal);
 el('sendProposal').addEventListener('click',sendProposal);
 el('saveAppointment').addEventListener('click',saveAppointment);
 el('apptClient').addEventListener('change',refreshAppointmentPackages);
 el('apptPackage').addEventListener('change',refreshAppointmentProcedures);
 el('savePayment').addEventListener('click',savePayment);
 el('clientSearch').addEventListener('input',renderClients);
}

function saveClient(){
 var name=el('clientName').value.trim(),phone=el('clientPhone').value.trim(),notes=el('clientNotes').value.trim();
 if(!name){toast('Digite o nome da cliente.');return}
 clients.unshift({id:uid(),name:name,phone:phone,notes:notes,createdAt:new Date().toISOString()});
 write(KEYS.clients,clients);
 el('clientName').value='';el('clientPhone').value='';el('clientNotes').value='';
 closeModal('clientModal');refreshAll();toast('Cliente cadastrada.');
}
function renderClients(){
 var box=el('clientList'),term=(el('clientSearch').value||'').toLowerCase().trim();
 var data=clients.filter(function(c){return (c.name+' '+c.phone).toLowerCase().indexOf(term)>=0});
 if(!data.length){box.innerHTML='<div class="empty">Nenhuma cliente cadastrada.</div>';return}
 box.innerHTML=data.map(function(c){
  var ps=packages.filter(function(p){return p.clientId===c.id});
  var pending=ps.reduce(function(sum,p){return sum+Math.max(0,Number(p.total||0)-receivedTotal(p))},0);
  return '<div class="item"><div class="itemTop"><div><strong>'+esc(c.name)+'</strong><div class="meta">'+esc(c.phone||'Sem telefone')+' · '+ps.length+' pacote(s)</div></div><span class="badge">A receber '+money(pending)+'</span></div>'+(c.notes?'<div class="meta" style="margin-top:7px">'+esc(c.notes)+'</div>':'')+'</div>';
 }).join('');
}

function saveProcedure(){
 var name=el('procName').value.trim();
 var price=Number(el('procPrice').value||0),cost=Number(el('procCost').value||0),minProfit=Number(el('procMinProfit').value||0),duration=Number(el('procDuration').value||0),notes=el('procNotes').value.trim();
 if(!name){toast('Digite o nome do procedimento.');return}
 if(price<=0){toast('Digite o preço avulso.');return}
 if(cost<0||minProfit<0){toast('Custo e lucro mínimo não podem ser negativos.');return}
 if(cost+minProfit<=0){toast('Informe o custo ou o lucro mínimo que deseja preservar.');return}
 if(price<=cost+minProfit){toast('O preço avulso precisa ser maior que custo + lucro mínimo.');return}
 procedures.unshift({id:uid(),name:name,price:price,cost:cost,minProfit:minProfit,duration:duration,notes:notes});
 write(KEYS.procedures,procedures);
 ['procName','procPrice','procCost','procMinProfit','procNotes'].forEach(function(id){el(id).value=''});
 el('procDuration').value='60';
 refreshAll();toast('Procedimento salvo.');
}
function renderProcedures(){
 var box=el('procedureList');
 if(!procedures.length){box.innerHTML='<div class="empty">Nenhum procedimento cadastrado.</div>';return}
 box.innerHTML=procedures.map(function(p){
  var floor=procFloor(p),profit=Number(p.price||0)-Number(p.cost||0),ready=validProcedure(p);
  return '<div class="item" data-proc-row="'+p.id+'">'+
   '<div class="itemTop"><div><strong>'+esc(p.name)+'</strong><div class="meta">Venda '+money(p.price)+' · Custo '+money(p.cost)+' · Lucro avulso '+money(profit)+'</div></div><span class="badge '+(ready?'ok':'warn')+'">'+(ready?'Pronto':'Complete os valores')+'</span></div>'+
   '<div class="grid2" style="margin-top:9px">'+
    '<div class="field"><label>Nome</label><input class="input" data-pe-name="'+p.id+'" value="'+esc(p.name)+'"></div>'+
    '<div class="field"><label>Preço avulso</label><input class="input" type="number" step="0.01" data-pe-price="'+p.id+'" value="'+Number(p.price||0)+'"></div>'+
    '<div class="field"><label>Custo / sessão</label><input class="input" type="number" step="0.01" data-pe-cost="'+p.id+'" value="'+Number(p.cost||0)+'"></div>'+
    '<div class="field"><label>Lucro mínimo / sessão</label><input class="input" type="number" step="0.01" data-pe-min="'+p.id+'" value="'+Number(p.minProfit||0)+'"></div>'+
    '<div class="field"><label>Duração</label><input class="input" type="number" data-pe-duration="'+p.id+'" value="'+Number(p.duration||0)+'"></div>'+
    '<div class="field"><label>Preço mínimo seguro</label><input class="input" value="'+money(floor)+'" disabled></div>'+
   '</div><div class="actions"><button class="btn secondary sm" data-proc-save="'+p.id+'">Salvar alterações</button><button class="btn danger sm" data-proc-delete="'+p.id+'">Excluir</button></div></div>';
 }).join('');
 qsa('[data-proc-save]').forEach(function(b){b.onclick=function(){updateProcedure(b.getAttribute('data-proc-save'))}});
 qsa('[data-proc-delete]').forEach(function(b){b.onclick=function(){deleteProcedure(b.getAttribute('data-proc-delete'))}});
}
function updateProcedure(id){
 var p=procedureById(id);if(!p)return;
 var name=document.querySelector('[data-pe-name="'+id+'"]').value.trim();
 var price=Number(document.querySelector('[data-pe-price="'+id+'"]').value||0);
 var cost=Number(document.querySelector('[data-pe-cost="'+id+'"]').value||0);
 var minProfit=Number(document.querySelector('[data-pe-min="'+id+'"]').value||0);
 var duration=Number(document.querySelector('[data-pe-duration="'+id+'"]').value||0);
 if(!name||price<=0||cost<0||minProfit<0||cost+minProfit<=0||price<=cost+minProfit){toast('Confira os valores. O preço precisa ser maior que custo + lucro mínimo.');return}
 p.name=name;p.price=price;p.cost=cost;p.minProfit=minProfit;p.duration=duration;
 write(KEYS.procedures,procedures);refreshAll();toast('Procedimento atualizado.');
}
function deleteProcedure(id){
 if(!confirm('Excluir este procedimento do cadastro? Os pacotes já salvos não serão alterados.'))return;
 procedures=procedures.filter(function(x){return x.id!==id});write(KEYS.procedures,procedures);refreshAll();toast('Procedimento excluído.');
}

function renderPackageSelectors(){
 var clientSel=el('packageClient'),current=clientSel.value;
 clientSel.innerHTML='<option value="">Selecione...</option>'+clients.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('');
 if(clients.some(function(c){return c.id===current}))clientSel.value=current;
 var procSel=el('builderProcedure'),pcurrent=procSel.value;
 procSel.innerHTML='<option value="">Selecione...</option>'+procedures.map(function(p){
  return '<option value="'+p.id+'" '+(validProcedure(p)?'':'disabled')+'>'+esc(p.name)+(validProcedure(p)?' — '+money(p.price):' — complete os valores')+'</option>';
 }).join('');
 if(procedures.some(function(p){return p.id===pcurrent&&validProcedure(p)}))procSel.value=pcurrent;
 if(!el('packageInstallments').options.length){
  var opts='';for(var i=1;i<=12;i++)opts+='<option value="'+i+'">'+i+'x</option>';el('packageInstallments').innerHTML=opts;
 }
}

function addToBuilder(){
 var pid=el('builderProcedure').value,sessions=Math.max(1,Number(el('builderSessions').value||1)),p=procedureById(pid);
 if(!p){toast('Escolha um procedimento.');return}
 if(!validProcedure(p)){toast('Complete preço, custo e lucro mínimo deste procedimento.');return}
 var ex=builder.find(function(x){return x.procedureId===pid});
 if(ex)ex.sessions+=sessions;
 else builder.push({procedureId:p.id,name:p.name,sessions:sessions,price:Number(p.price),cost:Number(p.cost),minProfit:Number(p.minProfit),done:0});
 el('builderSessions').value='1';renderBuilder();toast('Procedimento adicionado.');
}
function builderCalc(){
 var gross=0,cost=0,minProfit=0;
 builder.forEach(function(i){gross+=i.sessions*i.price;cost+=i.sessions*i.cost;minProfit+=i.sessions*i.minProfit});
 var discountPercent=Math.min(100,Math.max(0,Number(el('packageDiscount').value||0)));
 var discount=gross*discountPercent/100,total=Math.max(0,gross-discount),floor=cost+minProfit;
 var profit=total-cost,margin=total?profit/total*100:0,maxSafe=gross?Math.max(0,(gross-floor)/gross*100):0;
 var installments=Math.max(1,Number(el('packageInstallments').value||1));
 return {gross:gross,cost:cost,minProfit:minProfit,floor:floor,discountPercent:discountPercent,discount:discount,total:total,profit:profit,margin:margin,maxSafe:maxSafe,installments:installments,installment:total/installments,safe:builder.length>0&&total>=floor};
}
function renderBuilder(){
 var box=el('builderList');
 if(!builder.length)box.innerHTML='<div class="empty">Adicione os procedimentos e a quantidade de sessões.</div>';
 else{
  box.innerHTML=builder.map(function(i,index){
   return '<div class="builderRow"><div><strong>'+esc(i.name)+'</strong><div class="meta">'+money(i.price)+' por sessão · custo '+money(i.cost)+' · mínimo '+money(i.minProfit)+'</div></div><input type="number" min="1" value="'+i.sessions+'" data-builder-sessions="'+index+'"><button class="remove" data-builder-remove="'+index+'">×</button></div>';
  }).join('');
  qsa('[data-builder-sessions]').forEach(function(input){input.oninput=function(){var idx=Number(input.getAttribute('data-builder-sessions'));builder[idx].sessions=Math.max(1,Number(input.value||1));renderBuilderSummary()}});
  qsa('[data-builder-remove]').forEach(function(b){b.onclick=function(){builder.splice(Number(b.getAttribute('data-builder-remove')),1);renderBuilder()}});
 }
 renderBuilderSummary();
}
function renderBuilderSummary(){
 var c=builderCalc(),box=el('packageSummary');
 box.innerHTML=
  '<div class="sumRow"><span>Valor avulso total</span><strong>'+money(c.gross)+'</strong></div>'+
  '<div class="sumRow"><span>Custo total</span><strong>'+money(c.cost)+'</strong></div>'+
  '<div class="sumRow"><span>Lucro mínimo reservado</span><strong>'+money(c.minProfit)+'</strong></div>'+
  '<div class="sumRow"><span>Preço mínimo seguro</span><strong>'+money(c.floor)+'</strong></div>'+
  '<div class="sumRow"><span>Desconto ('+c.discountPercent.toFixed(0)+'%)</span><strong>-'+money(c.discount)+'</strong></div>'+
  '<div class="sumRow"><span>Desconto máximo seguro</span><strong>'+c.maxSafe.toFixed(1).replace('.',',')+'%</strong></div>'+
  '<div class="sumRow"><span>Lucro estimado</span><strong>'+money(c.profit)+' · '+c.margin.toFixed(1).replace('.',',')+'%</strong></div>'+
  '<div class="sumRow"><span>Parcelamento</span><strong>'+c.installments+'x de '+money(c.installment)+'</strong></div>'+
  '<div class="sumRow total"><span>Preço do pacote</span><strong>'+money(c.total)+'</strong></div>'+
  '<div class="safe '+(c.safe?'ok':'bad')+'">'+(c.safe?'✓ Desconto seguro. O custo e o lucro mínimo estão preservados.':'⚠ Este pacote ainda não está seguro. Reduza o desconto ou ajuste os procedimentos.')+'</div>';
 el('savePackage').disabled=!c.safe;
 el('copyProposal').disabled=!c.safe;
 el('sendProposal').disabled=!c.safe;
}
function draftPackage(){
 var client=clientById(el('packageClient').value),name=el('packageName').value.trim()||'Pacote Personalizado',calc=builderCalc();
 if(!client){toast('Escolha uma cliente.');return null}
 if(!builder.length){toast('Adicione pelo menos um procedimento.');return null}
 if(!calc.safe){toast('Esse desconto não preserva o custo e o lucro mínimo.');return null}
 return {
  id:uid(),clientId:client.id,clientName:client.name,name:name,
  items:builder.map(function(x){return {procedureId:x.procedureId,name:x.name,sessions:x.sessions,done:0,price:x.price,cost:x.cost,minProfit:x.minProfit}}),
  gross:calc.gross,discountPercent:calc.discountPercent,discountAmount:calc.discount,total:calc.total,cost:calc.cost,minProfit:calc.minProfit,expectedProfit:calc.profit,
  installments:calc.installments,validityDays:Math.max(1,Number(el('packageValidity').value||90)),payments:[],status:'Ativo',createdAt:new Date().toISOString()
 };
}
function savePackage(){
 var p=draftPackage();if(!p)return;
 packages.unshift(p);write(KEYS.packages,packages);builder=[];el('packageName').value='';el('packageDiscount').value='0';renderBuilder();refreshAll();toast('Pacote salvo com lucro protegido.');
}
function proposalText(){
 var p=draftPackage();if(!p)return'';
 var lines=p.items.map(function(i){return '• '+i.name+': '+i.sessions+' sessão(ões)'}).join('\n');
 return '✨ '+p.name.toUpperCase()+'\n\nCliente: '+p.clientName+'\n\n'+lines+'\n\nValor avulso: '+money(p.gross)+'\nDesconto: '+p.discountPercent.toFixed(0)+'%\nVALOR DO PACOTE: '+money(p.total)+'\nPagamento: '+p.installments+'x de '+money(p.total/p.installments)+'\nValidade: '+p.validityDays+' dias\n\nEsteticista Loyara Lobo 💗';
}
function copyProposal(){
 var text=proposalText();if(!text)return;
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){toast('Proposta copiada.')}).catch(function(){fallbackCopy(text)});
 else fallbackCopy(text);
}
function fallbackCopy(text){
 var t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Proposta copiada.');
}
function sendProposal(){
 var text=proposalText();if(!text)return;
 var c=clientById(el('packageClient').value),phone=(c&&c.phone?c.phone:'').replace(/\D/g,'');
 var url=phone?'https://wa.me/55'+phone.replace(/^55/,'')+'?text='+encodeURIComponent(text):'https://wa.me/?text='+encodeURIComponent(text);
 window.open(url,'_blank');
}
function renderPackages(){
 renderPackageSelectors();renderBuilder();
 var box=el('packageList');
 if(!packages.length){box.innerHTML='<div class="empty">Nenhum pacote salvo.</div>';return}
 box.innerHTML=packages.map(function(p){
  var paid=receivedTotal(p),pending=Math.max(0,p.total-paid),done=packageDoneSessions(p),totalSessions=packageTotalSessions(p),progress=packageProgress(p);
  return '<div class="item"><div class="itemTop"><div><strong>'+esc(p.name)+'</strong><div class="meta">'+esc(p.clientName)+' · '+done+'/'+totalSessions+' sessões realizadas</div></div><span class="badge '+(progress>=100?'ok':'')+'">'+progress.toFixed(0)+'%</span></div>'+
   '<div class="meta" style="margin-top:7px">Pacote '+money(p.total)+' · custo '+money(p.cost||packageCost(p))+' · lucro estimado '+money(p.expectedProfit!=null?p.expectedProfit:p.total-packageCost(p))+'</div>'+
   '<div class="meta">Recebido '+money(paid)+' · falta '+money(pending)+'</div><div class="progress"><div style="width:'+progress+'%"></div></div>'+
   '<div class="actions" style="margin-top:9px"><button class="btn secondary sm" data-pay="'+p.id+'">+ Pagamento</button><button class="btn green sm" data-schedule-package="'+p.id+'">Agendar sessão</button></div></div>';
 }).join('');
 qsa('[data-pay]').forEach(function(b){b.onclick=function(){openPayment(b.getAttribute('data-pay'))}});
 qsa('[data-schedule-package]').forEach(function(b){b.onclick=function(){openScheduleForPackage(b.getAttribute('data-schedule-package'))}});
}

function prepareAppointmentModal(){
 var sel=el('apptClient');sel.innerHTML='<option value="">Selecione...</option>'+clients.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('');
 el('apptPackage').innerHTML='<option value="">Selecione a cliente primeiro</option>';
 el('apptProcedure').innerHTML='<option value="">Selecione o pacote primeiro</option>';
 el('apptDate').value=today();el('apptTime').value='';
}
function refreshAppointmentPackages(){
 var cid=el('apptClient').value;
 var list=packages.filter(function(p){return p.clientId===cid&&packageProgress(p)<100});
 el('apptPackage').innerHTML='<option value="">Selecione...</option>'+list.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('');
 refreshAppointmentProcedures();
}
function refreshAppointmentProcedures(){
 var p=packageById(el('apptPackage').value);
 if(!p){el('apptProcedure').innerHTML='<option value="">Selecione o pacote primeiro</option>';return}
 var available=(p.items||[]).filter(function(i){return Number(i.done||0)<Number(i.sessions||0)});
 el('apptProcedure').innerHTML='<option value="">Selecione...</option>'+available.map(function(i){return '<option value="'+i.procedureId+'">'+esc(i.name)+' — faltam '+(i.sessions-(i.done||0))+'</option>'}).join('');
}
function openScheduleForPackage(pid){
 var p=packageById(pid);if(!p)return;
 prepareAppointmentModal();el('apptClient').value=p.clientId;refreshAppointmentPackages();el('apptPackage').value=p.id;refreshAppointmentProcedures();openModal('appointmentModal');
}
function saveAppointment(){
 var c=clientById(el('apptClient').value),p=packageById(el('apptPackage').value),pid=el('apptProcedure').value,date=el('apptDate').value,time=el('apptTime').value;
 if(!c||!p||!pid||!date||!time){toast('Preencha cliente, pacote, procedimento, data e hora.');return}
 var item=p.items.find(function(x){return x.procedureId===pid});
 if(!item||Number(item.done||0)>=Number(item.sessions||0)){toast('Não há sessão disponível deste procedimento.');return}
 appointments.push({id:uid(),clientId:c.id,clientName:c.name,packageId:p.id,packageName:p.name,procedureId:item.procedureId,procedureName:item.name,date:date,time:time,status:'Agendado',consumed:false,createdAt:new Date().toISOString()});
 appointments.sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time)});
 write(KEYS.appointments,appointments);closeModal('appointmentModal');refreshAll();toast('Agendamento salvo.');
}
function renderAgenda(){
 var box=el('agendaList'),data=appointments.slice().sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time)});
 if(!data.length){box.innerHTML='<div class="empty">Nenhum agendamento.</div>';return}
 box.innerHTML=data.map(function(a){
  var cls=a.status==='Concluído'?'ok':a.status==='Cancelado'?'warn':'';
  return '<div class="item"><div class="itemTop"><div><strong>'+esc(a.clientName)+'</strong><div class="meta">'+a.date.split('-').reverse().join('/')+' às '+esc(a.time)+' · '+esc(a.procedureName)+'</div><div class="meta">'+esc(a.packageName)+'</div></div><span class="badge '+cls+'">'+a.status+'</span></div>'+
   (a.status==='Agendado'?'<div class="actions" style="margin-top:9px"><button class="btn green sm" data-complete="'+a.id+'">Concluir sessão</button><button class="btn danger sm" data-cancel="'+a.id+'">Cancelar</button></div>':'')+'</div>';
 }).join('');
 qsa('[data-complete]').forEach(function(b){b.onclick=function(){completeAppointment(b.getAttribute('data-complete'))}});
 qsa('[data-cancel]').forEach(function(b){b.onclick=function(){cancelAppointment(b.getAttribute('data-cancel'))}});
}
function completeAppointment(id){
 var a=appointments.find(function(x){return x.id===id});if(!a||a.status!=='Agendado')return;
 var p=packageById(a.packageId),item=p&&p.items.find(function(x){return x.procedureId===a.procedureId});
 if(!p||!item){toast('Pacote não encontrado.');return}
 if(Number(item.done||0)>=Number(item.sessions||0)){toast('Todas as sessões desse procedimento já foram usadas.');return}
 item.done=Number(item.done||0)+1;a.status='Concluído';a.consumed=true;a.completedAt=new Date().toISOString();
 if(packageProgress(p)>=100)p.status='Concluído';
 write(KEYS.packages,packages);write(KEYS.appointments,appointments);refreshAll();toast('Sessão concluída e baixada do pacote.');
}
function cancelAppointment(id){
 var a=appointments.find(function(x){return x.id===id});if(!a||a.status!=='Agendado')return;
 if(!confirm('Cancelar este agendamento?'))return;a.status='Cancelado';write(KEYS.appointments,appointments);refreshAll();
}

function openPayment(pid){
 var p=packageById(pid);if(!p)return;
 el('paymentPackageId').value=pid;el('paymentAmount').value='';el('paymentMethod').value='PIX';el('paymentDate').value=today();openModal('paymentModal');
}
function savePayment(){
 var p=packageById(el('paymentPackageId').value);if(!p)return;
 var amount=Number(el('paymentAmount').value||0),paid=receivedTotal(p),pending=Math.max(0,p.total-paid);
 if(amount<=0){toast('Digite o valor recebido.');return}
 if(amount>pending+0.01){toast('O pagamento é maior que o saldo de '+money(pending)+'.');return}
 p.payments=p.payments||[];p.payments.push({id:uid(),amount:amount,method:el('paymentMethod').value,date:el('paymentDate').value||today(),createdAt:new Date().toISOString()});
 write(KEYS.packages,packages);closeModal('paymentModal');refreshAll();toast('Pagamento registrado.');
}

function realizedProcedureStats(filterMonth){
 var stats={};
 appointments.filter(function(a){return a.status==='Concluído'&&(!filterMonth||a.date.indexOf(filterMonth)===0)}).forEach(function(a){
  var p=packageById(a.packageId);if(!p)return;
  var item=p.items.find(function(x){return x.procedureId===a.procedureId});if(!item)return;
  var gross=Number(p.gross||packageGross(p)),factor=gross?Number(p.total||0)/gross:1;
  var revenue=Number(item.price||0)*factor,cost=Number(item.cost||0),profit=revenue-cost;
  if(!stats[item.name])stats[item.name]={sessions:0,revenue:0,cost:0,profit:0};
  stats[item.name].sessions++;stats[item.name].revenue+=revenue;stats[item.name].cost+=cost;stats[item.name].profit+=profit;
 });
 return stats;
}
function renderFinance(){
 var contracted=packages.reduce(function(sum,p){return sum+Number(p.total||0)},0);
 var received=packages.reduce(function(sum,p){return sum+receivedTotal(p)},0);
 var pending=Math.max(0,contracted-received);
 var expectedProfit=packages.reduce(function(sum,p){return sum+Number(p.expectedProfit!=null?p.expectedProfit:Number(p.total||0)-packageCost(p))},0);
 var m=monthKey(),monthStats=realizedProcedureStats(m),monthProfit=Object.keys(monthStats).reduce(function(sum,k){return sum+monthStats[k].profit},0);
 el('financeKpis').innerHTML=
  '<div class="kpi"><small>Contratado</small><strong>'+money(contracted)+'</strong></div>'+
  '<div class="kpi"><small>Recebido</small><strong>'+money(received)+'</strong></div>'+
  '<div class="kpi"><small>A receber</small><strong>'+money(pending)+'</strong></div>'+
  '<div class="kpi"><small>Lucro estimado</small><strong>'+money(expectedProfit)+'</strong></div>'+
  '<div class="kpi"><small>Lucro realizado no mês</small><strong>'+money(monthProfit)+'</strong></div>';

 var pbox=el('financePackages');
 if(!packages.length)pbox.innerHTML='<div class="empty">Nenhum pacote financeiro.</div>';
 else{
  pbox.innerHTML=packages.map(function(p){
   var paid=receivedTotal(p),pend=Math.max(0,p.total-paid),cost=Number(p.cost||packageCost(p)),profit=Number(p.expectedProfit!=null?p.expectedProfit:p.total-cost);
   return '<div class="item"><div class="itemTop"><div><strong>'+esc(p.clientName)+' — '+esc(p.name)+'</strong><div class="meta">Pacote '+money(p.total)+' · custo '+money(cost)+' · lucro estimado '+money(profit)+'</div><div class="meta">Recebido '+money(paid)+' · falta '+money(pend)+'</div></div><button class="btn secondary sm" data-fin-pay="'+p.id+'">+ Pagamento</button></div></div>';
  }).join('');
  qsa('[data-fin-pay]').forEach(function(b){b.onclick=function(){openPayment(b.getAttribute('data-fin-pay'))}});
 }
 var sbox=el('procedureProfitList'),keys=Object.keys(monthStats).sort(function(a,b){return monthStats[b].profit-monthStats[a].profit});
 if(!keys.length)sbox.innerHTML='<div class="empty">Conclua sessões na Agenda para ver o lucro realizado por procedimento neste mês.</div>';
 else sbox.innerHTML=keys.map(function(name){
  var s=monthStats[name];
  return '<div class="item"><div class="itemTop"><div><strong>'+esc(name)+'</strong><div class="meta">'+s.sessions+' sessão(ões) realizadas · receita '+money(s.revenue)+' · custo '+money(s.cost)+'</div></div><span class="badge ok">Lucro '+money(s.profit)+'</span></div></div>';
 }).join('');
}

function renderHero(){
 var m=monthKey(),stats=realizedProcedureStats(m),profit=Object.keys(stats).reduce(function(sum,k){return sum+stats[k].profit},0);
 var t=today(),todayCount=appointments.filter(function(a){return a.date===t&&a.status==='Agendado'}).length;
 var pending=packages.reduce(function(sum,p){return sum+Math.max(0,p.total-receivedTotal(p))},0);
 el('heroProfit').textContent=money(profit);el('heroToday').textContent=String(todayCount);el('heroPending').textContent=money(pending);
}
function refreshAll(){
 renderHero();renderPackageSelectors();renderClients();renderProcedures();renderPackages();renderAgenda();renderFinance();
}

var deferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;el('installBtn').style.display='block'});
el('installBtn').addEventListener('click',function(){
 if(!deferredPrompt){toast('Use o menu do navegador e escolha Adicionar à tela inicial.');return}
 deferredPrompt.prompt();deferredPrompt.userChoice.finally(function(){deferredPrompt=null;el('installBtn').style.display='none'});
});

bind();
refreshAll();
})();