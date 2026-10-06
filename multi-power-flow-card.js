/* Multi Power Flow Card v2 - generic/shareable Home Assistant custom card */

const MPFC_DEFAULTS = {
  title: 'Power Flow',
  core: {
    grid: { name: 'Grid', icon: 'mdi:transmission-tower', color: '#0288D1', invert: false },
    solar: { name: 'Solar', icon: 'mdi:solar-power', color: '#FF9800', invert: false },
    home: { name: 'Home', icon: 'mdi:home', color: '#00BCD4', invert: false },
    low_carbon: { name: 'Low Carbon', icon: 'mdi:leaf', color: '#00C853', invert: false },
  },
  battery: { name: 'Battery', icon: 'mdi:battery', color: '#00BCD4', invert: false },
  device: { name: 'Device', icon: 'mdi:flash', color: '#9C27B0', invert: false },
  display: { show_title: true, show_values: true, show_soc: true, show_icons: true, show_zero_values: false },
  flow: { animate: true, animation_speed: 1, minimum_power: 10 },
  appearance: { background: '#111827', border_radius: 16, node_size: 48, line_width: 2.8 },
};

const MPFC_EMOJI = {
  'mdi:transmission-tower':'🗼','mdi:solar-power':'☀️','mdi:home':'🏠','mdi:leaf':'🍃',
  'mdi:battery':'🔋','mdi:battery-high':'🔋','mdi:battery-charging-100':'🔋','mdi:flash':'⚡',
  'mdi:heat-pump':'🌀','mdi:server-network':'🖥️','mdi:car-electric':'🚗','mdi:ev-station':'🔌',
  'mdi:tumble-dryer':'♨️','mdi:washing-machine':'🫧','mdi:television':'📺','mdi:dishwasher':'🍽️'
};

const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const entityId = v => typeof v === 'string' ? v : (v && typeof v.entity === 'string' ? v.entity : '');
function merge(a,b) {
  const r=clone(a)||{};
  Object.entries(b||{}).forEach(([k,v])=>{
    if(v && typeof v==='object'&&!Array.isArray(v)&&r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k])) r[k]=merge(r[k],v);
    else r[k]=clone(v);
  }); return r;
}
function node(v, defaults) { return merge(defaults, typeof v==='string'?{entity:v}:v||{}); }

// Converts the original entities.* format into the new generic format.
function migrateLegacyConfig(c) {
  if (!c || typeof c !== 'object') return {};
  if (c.core || Array.isArray(c.batteries) || Array.isArray(c.devices)) return clone(c);
  const e=c.entities||{};
  const out={title:c.title||'Power Flow',core:{
    grid:node(e.grid,MPFC_DEFAULTS.core.grid), solar:node(e.solar,MPFC_DEFAULTS.core.solar),
    home:node(e.home,MPFC_DEFAULTS.core.home), low_carbon:node(e.fossil_fuel_percentage,MPFC_DEFAULTS.core.low_carbon)
  },batteries:[],devices:[]};
  const battery=(v,id,name,icon,color)=>{
    if(!v)return null; const b=typeof v==='string'?{entity:v}:v; const ent=entityId(b.entity); if(!ent)return null;
    return {id:b.id||id,entity:ent,soc_entity:entityId(b.soc_entity||b.state_of_charge),status_entity:entityId(b.status_entity||b.status),
      name:b.name||name,icon:b.icon||icon,color:b.color||color,invert:!!b.invert,enabled:b.enabled!==false};
  };
  (Array.isArray(e.batteries)?e.batteries:[]).forEach((b,i)=>{const x=battery(b,b.id||`battery_${i+1}`,b.name||'Battery',b.icon||'mdi:battery',b.color||'#00BCD4');if(x)out.batteries.push(x);});
  const g=battery(e.givenergy,'givenergy','GivEnergy','mdi:battery','#00BCD4');
  const s=battery(e.solix,'solix','Solix','mdi:battery','#FFC107');
  if(g&&!out.batteries.some(x=>x.id===g.id))out.batteries.push(g);
  if(s&&!out.batteries.some(x=>x.id===s.id))out.batteries.push(s);
  (Array.isArray(e.individual)?e.individual:[]).forEach((d,i)=>{if(d&&d.entity)out.devices.push({id:d.id||`device_${i+1}`,entity:d.entity,name:d.name||'Device',icon:d.icon||'mdi:flash',color:d.color||'#9C27B0',invert:!!d.invert,enabled:d.enabled!==false,position:d.position||'auto'});});
  return out;
}
function normaliseConfig(c) {
  const m=migrateLegacyConfig(c||{});
  const r=merge({title:'Power Flow',core:{grid:null,solar:null,home:null,low_carbon:null},batteries:[],devices:[],display:MPFC_DEFAULTS.display,flow:MPFC_DEFAULTS.flow,appearance:MPFC_DEFAULTS.appearance},m);
  Object.keys(r.core).forEach(k=>{if(r.core[k]!=null){r.core[k]=merge(MPFC_DEFAULTS.core[k],r.core[k]);r.core[k].entity=entityId(r.core[k].entity);r.core[k].enabled=!!r.core[k].entity;}});
  r.batteries=(Array.isArray(r.batteries)?r.batteries:[]).map((b,i)=>{const x=merge(MPFC_DEFAULTS.battery,b||{});return {...x,id:x.id||`battery_${i+1}`,entity:entityId(x.entity),soc_entity:entityId(x.soc_entity),status_entity:entityId(x.status_entity),enabled:x.enabled!==false&&!!entityId(x.entity),invert:!!x.invert};});
  r.devices=(Array.isArray(r.devices)?r.devices:[]).map((d,i)=>{const x=merge(MPFC_DEFAULTS.device,d||{});return {...x,id:x.id||`device_${i+1}`,entity:entityId(x.entity),enabled:x.enabled!==false&&!!entityId(x.entity),invert:!!x.invert,position:x.position||'auto'};});
  return r;
}

class MultiPowerFlowCard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._config={};this._cfg=normaliseConfig({});this._key='';}
  setConfig(c){if(!c||typeof c!=='object')throw new Error('Invalid configuration');this._config=c;this._cfg=normaliseConfig(c);if(this._hass){this.syncLayout(true);this.updateValues();}}
  set hass(h){this._hass=h;if(!this.shadowRoot.querySelector('svg'))this.syncLayout(true);this.updateValues();}
  getCardSize(){return Math.max(5,4+Math.ceil(this._cfg.batteries.length/3)+Math.ceil(this._cfg.devices.length/4));}
  getGridOptions(){return {rows:this.getCardSize(),columns:9,min_rows:5,min_columns:6};}
  static getConfigElement(){return document.createElement('multi-power-flow-card-editor');}
  static getStubConfig(){return {title:'Power Flow',core:{grid:{entity:''},solar:{entity:''},home:{entity:''},low_carbon:{entity:''}},batteries:[],devices:[]};}

  _state(id){return id?this._hass?.states?.[id]:null;}
  _raw(id){const s=this._state(id);let n=Number.parseFloat(s?.state);if(!Number.isFinite(n))return 0;return String(s?.attributes?.unit_of_measurement||'').toLowerCase().includes('kw')?n*1000:n;}
  _power(n){const v=this._raw(n?.entity);return n?.invert?-v:v;}
  _soc(id){const n=Number.parseFloat(this._state(id)?.state);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):null;}
  _display(n){let v=Math.abs(this._power(n));if(v>=1000)return `${(v/1000).toFixed(1)} kW`;return `${Math.round(v)} ${this._state(n.entity)?.attributes?.unit_of_measurement||'W'}`;}
  _name(n,fallback){return n?.name||this._state(n?.entity)?.attributes?.friendly_name||fallback;}
  _icon(n,fallback){const i=n?.icon||fallback;return i?.startsWith('mdi:')?(MPFC_EMOJI[i]||'⚡'):i;}
  _esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

  _handleNodeClick(ent){if(ent)this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:ent},bubbles:true,composed:true}));}
  _nodes(){const c=this._cfg,n=[];
    [['lowcarbon',c.core.low_carbon,65,40,'Low Carbon'],['grid',c.core.grid,65,205,'Grid'],['solar',c.core.solar,235,40,'Solar'],['home',c.core.home,405,205,'Home']].forEach(([id,x,px,py,f])=>{if(x?.enabled)n.push({id,...x,x:px,y:py,label:this._name(x,f),icon:this._icon(x,MPFC_DEFAULTS.core[id==='lowcarbon'?'low_carbon':id].icon),home:id==='home'});});
    c.batteries.filter(x=>x.enabled).forEach((b,i)=>{n.push({id:`battery:${b.id}`,type:'battery',batteryId:b.id,...b,x:235+(i%3)*170,y:365+Math.floor(i/3)*135,label:this._name(b,b.name||'Battery'),icon:this._icon(b,'mdi:battery')});});
    c.devices.filter(x=>x.enabled).forEach((d,i)=>{n.push({id:`device:${d.id}`,type:'device',deviceId:d.id,...d,x:575+(i%4)*150,y:40+Math.floor(i/4)*135,label:this._name(d,d.name||'Device'),icon:this._icon(d,'mdi:flash')});});return n;
  }
  _path(a,b){const r=48,fx=a.x+r,fy=a.y+r,tx=b.x+r,ty=b.y+r,dx=tx-fx,dy=ty-fy,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len,sx=fx+ux*r,sy=fy+uy*r,ex=tx-ux*r,ey=ty-uy*r;if(Math.abs(dx)>Math.abs(dy)*1.3){const mx=(sx+ex)/2;return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${mx.toFixed(1)} ${sy.toFixed(1)},${mx.toFixed(1)} ${ey.toFixed(1)},${ex.toFixed(1)} ${ey.toFixed(1)}`;}const my=(sy+ey)/2,bend=Math.min(55,Math.max(18,len*.18));return `M${sx.toFixed(1)} ${sy.toFixed(1)} C${sx.toFixed(1)} ${(my-bend*Math.sign(dy)).toFixed(1)},${ex.toFixed(1)} ${(my+bend*Math.sign(dy)).toFixed(1)},${ex.toFixed(1)} ${ey.toFixed(1)}`;}
  _connections(){const c=this._cfg,n=this._nodes(),by=id=>n.find(x=>x.id===id),out=[];const grid=by('grid'),solar=by('solar'),home=by('home');
    if(by('lowcarbon')&&grid)out.push({id:'lowcarbon-grid',from:'lowcarbon',to:'grid',watts:1,color:c.core.low_carbon.color,reverse:false});
    if(grid&&home){const p=this._power(c.core.grid);out.push({id:'grid-home',from:'grid',to:'home',watts:Math.abs(p),color:c.core.grid.color,reverse:p<0});}
    if(solar&&home)out.push({id:'solar-home',from:'solar',to:'home',watts:Math.max(0,this._power(c.core.solar)),color:c.core.solar.color,reverse:false});
    c.batteries.filter(b=>b.enabled).forEach(b=>{const id=`battery:${b.id}`;if(!by(id))return;const p=this._power(b);if(home)out.push({id:p>=0?`${id}-home`:`home-${id}`,from:p>=0?id:'home',to:p>=0?'home':id,watts:Math.abs(p),color:b.color,reverse:false});});
    c.devices.filter(d=>d.enabled).forEach(d=>{const id=`device:${d.id}`;if(home&&by(id))out.push({id:`home-${id}`,from:'home',to:id,watts:Math.abs(this._power(d)),color:d.color,reverse:false});});return out;
  }
  syncLayout(force=false){const n=this._nodes(),key=n.map(x=>[x.id,x.entity,x.label,x.color,x.icon,x.x,x.y].join('|')).join(';');if(!force&&key===this._key&&this.shadowRoot.querySelector('svg'))return;this._key=key;const c=this._cfg,conn=this._connections(),maxX=Math.max(850,...n.map(x=>x.x+110)),maxY=Math.max(455,...n.map(x=>x.y+125));let paths='',dots='',nodes='';conn.forEach(x=>{const a=n.find(z=>z.id===x.from),b=n.find(z=>z.id===x.to);if(!a||!b)return;const d=this._path(a,b);paths+=`<path id="p-${this._esc(x.id)}" d="${d}" stroke="${this._esc(x.color)}" stroke-width="${Number(c.appearance.line_width)||2.8}" fill="none" stroke-linecap="round" opacity=".75"/>`;dots+=`<g id="d-${this._esc(x.id)}" style="display:none"></g>`;});n.forEach(x=>{const soc=x.type==='battery'?this._soc(x.soc_entity):null;nodes+=`<g transform="translate(${x.x},${x.y})" class="node-group" data-entity="${this._esc(x.entity||'')}"><circle cx="48" cy="48" r="46" fill="#0b0f19" stroke="${this._esc(x.home?'#00BCD4':x.color)}" stroke-width="3.5"/>${x.home?'<circle cx="48" cy="48" r="41" fill="none" stroke="#FF9800" stroke-width="2.5"/>':''}<text x="48" y="${x.y<100?-14:116}" text-anchor="middle" fill="#cbd5e1" font-size="13.5" font-weight="700" font-family="system-ui">${this._esc(x.label)}</text><text id="s-${this._esc(x.id)}" x="48" y="24" text-anchor="middle" fill="${this._esc(x.color)}" font-size="13.5" font-weight="800">${c.display.show_soc!==false&&soc!==null?soc+'%':''}</text><text id="i-${this._esc(x.id)}" x="48" y="${soc!==null?'54':'48'}" text-anchor="middle" font-size="30">${c.display.show_icons===false?'':this._esc(x.icon)}</text><text id="v-${this._esc(x.id)}" x="48" y="72" text-anchor="middle" fill="#f1f5f9" font-size="13.5" font-weight="800"></text></g>`;});this.shadowRoot.innerHTML=`<style>:host{display:block;width:100%}ha-card{background:${this._esc(c.appearance.background)};border-radius:${Number(c.appearance.border_radius)||16}px;padding:16px;color:#f1f5f9;font-family:system-ui,sans-serif;box-sizing:border-box;overflow:hidden}.title{display:${c.display.show_title===false?'none':'block'};font-size:18px;font-weight:700;text-align:center;margin-bottom:8px}.wrap{width:100%;overflow:auto}svg{width:100%;min-width:640px;height:auto;display:block}.node-group{cursor:pointer}</style><ha-card><div class="title">${this._esc(c.title)}</div><div class="wrap"><svg viewBox="0 -20 ${maxX+20} ${maxY+20}" preserveAspectRatio="xMidYMid meet">${paths}${dots}${nodes}</svg></div></ha-card>`;this.shadowRoot.querySelectorAll('.node-group').forEach(el=>el.addEventListener('click',()=>this._handleNodeClick(el.getAttribute('data-entity'))));}
  _animate(x){const g=this.shadowRoot.getElementById(`d-${x.id}`),p=this.shadowRoot.getElementById(`p-${x.id}`),n=this._nodes(),a=n.find(z=>z.id===x.from),b=n.find(z=>z.id===x.to);if(!g||!p||!a||!b)return;const d=this._path(a,b);p.setAttribute('d',d);const active=x.watts>=(Number(this._cfg.flow.minimum_power)||10);g.style.display=active?'block':'none';if(!active||this._cfg.flow.animate===false){g.innerHTML='';return;}const dur=Math.max(.55,Math.min(6,2400/Math.max(x.watts,10)/(Number(this._cfg.flow.animation_speed)||1))).toFixed(2)+'s';if(g.dataset.d===d&&g.dataset.t===dur)return;g.dataset.d=d;g.dataset.t=dur;const rev=x.reverse?' keyPoints="1;0" keyTimes="0;1"':'';g.innerHTML=`<circle r="4.8" fill="${this._esc(x.color)}"><animateMotion path="${d}" dur="${dur}" repeatCount="indefinite" calcMode="linear"${rev}/></circle><circle r="4.8" fill="${this._esc(x.color)}"><animateMotion path="${d}" dur="${dur}" begin="-${(parseFloat(dur)/2).toFixed(2)}s" repeatCount="indefinite" calcMode="linear"${rev}/></circle>`;}
  updateValues(){if(!this._hass)return;this.syncLayout();const c=this._cfg,n=this._nodes();n.forEach(x=>{const v=this.shadowRoot.getElementById(`v-${x.id}`),s=this.shadowRoot.getElementById(`s-${x.id}`);if(v)v.textContent=c.display.show_values===false?'':((x.id==='grid'?(this._power(x)<0?'← ':'→ '):x.type==='battery'?(this._power(x)<0?'↓ ':this._power(x)>0?'↑ ':''):'')+this._display(x));if(x.type==='battery'&&s)s.textContent=c.display.show_soc!==false&&this._soc(x.soc_entity)!==null?this._soc(x.soc_entity)+'%':'';if(x.id==='lowcarbon'&&s){const q=Number.parseFloat(this._state(x.entity)?.state);s.textContent=Number.isFinite(q)?Math.round(q)+'%':'';}});this._connections().forEach(x=>this._animate(x));}
}

class MultiPowerFlowCardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._config=null;this._hass=null;}
  setConfig(c){this._config=normaliseConfig(c||{});this._render();}
  set hass(h){this._hass=h;this._render();}
  _esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  _opts(sel,empty=true){const st=this._hass?.states||{},ids=Object.keys(st).filter(x=>x.startsWith('sensor.')||x.startsWith('number.')).sort();let h=empty?'<option value="">— None / disabled —</option>':'';ids.forEach(id=>h+=`<option value="${this._esc(id)}" ${id===sel?'selected':''}>${this._esc(st[id]?.attributes?.friendly_name||id)} — ${this._esc(id)}</option>`);if(sel&&!ids.includes(sel))h+=`<option selected value="${this._esc(sel)}">${this._esc(sel)} (configured)</option>`;return h;}
  _emit(c){this._config=normaliseConfig(c);this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config},bubbles:true,composed:true}));this._render();}
  _render(){if(!this._config||!this._hass)return;const c=this._config,field=(id,label,n,d)=>`<div class="core"><b>${label}</b><label>Entity</label><select id="${id}_entity">${this._opts(n?.entity||'',true)}</select><label>Name</label><input id="${id}_name" value="${this._esc(n?.name||'')}" placeholder="${d.name}"><label>Icon</label><input id="${id}_icon" value="${this._esc(n?.icon||'')}" placeholder="${d.icon}"><label>Colour</label><input id="${id}_color" value="${this._esc(n?.color||'')}" placeholder="${d.color}"><label>Invert</label><select id="${id}_invert"><option value="false" ${!n?.invert?'selected':''}>No</option><option value="true" ${n?.invert?'selected':''}>Yes</option></select></div>`;const item=(type,n,i)=>`<div class="item"><b>${type==='battery'?(n.name||`Battery ${i+1}`):(n.name||`Device ${i+1}`)}</b><button data-remove="${type}:${i}">Remove</button><label>ID</label><input data-f="id" value="${this._esc(n.id||'')}"><label>Power entity</label><select data-f="entity">${this._opts(n.entity||'',false)}</select>${type==='battery'?`<label>SOC entity</label><select data-f="soc_entity">${this._opts(n.soc_entity||'',true)}</select><label>Status entity</label><select data-f="status_entity">${this._opts(n.status_entity||'',true)}</select>`:''}<label>Name</label><input data-f="name" value="${this._esc(n.name||'')}"><label>Icon</label><input data-f="icon" value="${this._esc(n.icon||'')}" placeholder="${type==='battery'?'mdi:battery':'mdi:flash'}"><label>Colour</label><input data-f="color" value="${this._esc(n.color||'')}"><label>Invert</label><select data-f="invert"><option value="false" ${!n.invert?'selected':''}>No</option><option value="true" ${n.invert?'selected':''}>Yes</option></select><label>Enabled</label><select data-f="enabled"><option value="true" ${n.enabled!==false?'selected':''}>Yes</option><option value="false" ${n.enabled===false?'selected':''}>No</option></select></div>`;this.shadowRoot.innerHTML=`<style>:host{display:block;padding:16px;color:var(--primary-text-color);font-family:system-ui,sans-serif}.sec{border:1px solid var(--divider-color);border-radius:12px;padding:14px;margin-bottom:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.items{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.core,.item{border:1px solid var(--divider-color);border-radius:10px;padding:12px}label{display:block;font-size:12px;margin:7px 0 3px;opacity:.8}input,select{width:100%;box-sizing:border-box;padding:7px;border-radius:7px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color)}button{float:right;border:0;border-radius:7px;padding:6px 9px;background:var(--error-color);color:#fff;cursor:pointer}.add{float:none;background:var(--primary-color);margin-top:10px}.title{font-size:15px;font-weight:700;margin-bottom:10px}</style><div class="sec"><div class="title">General</div><label>Title</label><input id="title" value="${this._esc(c.title)}"></div><div class="sec"><div class="title">Core sensors</div><div class="grid">${field('grid','Grid',c.core.grid,MPFC_DEFAULTS.core.grid)}${field('solar','Solar',c.core.solar,MPFC_DEFAULTS.core.solar)}${field('home','Home',c.core.home,MPFC_DEFAULTS.core.home)}${field('low_carbon','Low Carbon',c.core.low_carbon,MPFC_DEFAULTS.core.low_carbon)}</div></div><div class="sec"><div class="title">Batteries</div><div class="items">${c.batteries.map((x,i)=>item('battery',x,i)).join('')}</div><button class="add" id="addBattery">+ Add battery</button></div><div class="sec"><div class="title">Devices</div><div class="items">${c.devices.map((x,i)=>item('device',x,i)).join('')}</div><button class="add" id="addDevice">+ Add device</button></div>`;this.shadowRoot.querySelectorAll('input,select').forEach(e=>{e.addEventListener('change',()=>this._read());e.addEventListener('input',()=>this._read());});this.shadowRoot.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{const [t,i]=b.dataset.remove.split(':');const key=t==='battery'?'batteries':'devices';this._emit({...c,[key]:c[key].filter((_,j)=>j!==Number(i))});}));this.shadowRoot.getElementById('addBattery')?.addEventListener('click',()=>this._emit({...c,batteries:[...c.batteries,{id:`battery_${c.batteries.length+1}`,entity:'',soc_entity:'',name:'',icon:'mdi:battery',color:'#00BCD4',invert:false,enabled:true}]}));this.shadowRoot.getElementById('addDevice')?.addEventListener('click',()=>this._emit({...c,devices:[...c.devices,{id:`device_${c.devices.length+1}`,entity:'',name:'',icon:'mdi:flash',color:'#9C27B0',invert:false,enabled:true}]}));}
  _read(){const c=clone(this._config);c.title=this.shadowRoot.getElementById('title')?.value||'Power Flow';['grid','solar','home','low_carbon'].forEach(id=>c.core[id]={...c.core[id],entity:this.shadowRoot.getElementById(`${id}_entity`)?.value||'',name:this.shadowRoot.getElementById(`${id}_name`)?.value||'',icon:this.shadowRoot.getElementById(`${id}_icon`)?.value||'',color:this.shadowRoot.getElementById(`${id}_color`)?.value||'',invert:this.shadowRoot.getElementById(`${id}_invert`)?.value==='true'});['batteries','devices'].forEach(key=>{c[key]=[...this.shadowRoot.querySelectorAll(`.item`)].filter(x=>x.querySelector('[data-f="status_entity"]')!==null=== (key==='batteries')).map(x=>{const v=f=>x.querySelector(`[data-f="${f}"]`)?.value||'';const o={id:v('id'),entity:v('entity'),name:v('name'),icon:v('icon'),color:v('color'),invert:v('invert')==='true',enabled:v('enabled')!=='false'};if(key==='batteries'){o.soc_entity=v('soc_entity');o.status_entity=v('status_entity');}return o;});});this._emit(c);}
}

if(!customElements.get('multi-power-flow-card'))customElements.define('multi-power-flow-card',MultiPowerFlowCard);
if(!customElements.get('multi-power-flow-card-editor'))customElements.define('multi-power-flow-card-editor',MultiPowerFlowCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(c=>c.type==='multi-power-flow-card'))window.customCards.push({type:'multi-power-flow-card',name:'Multi Power Flow Card',description:'Generic configurable Home Assistant power-flow card.',preview:true,documentationURL:'https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/'});
