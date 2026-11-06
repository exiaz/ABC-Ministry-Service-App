const root = document.querySelector('#review-app');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data;
const state = {source: '', topic: null, menu: false, filters: {query: '', area: '', status: ''}, findings: {area: '', priority: ''}};
const controls = (label, target, primary = false) => `<a class="btn${primary ? ' primary' : ''}" href="${escape(target)}">${escape(label)}</a>`;
const panel = (id, title, content, classes = '') => `<section id="${id}" class="panel ${classes}" aria-labelledby="${id}-title"><header><h2 id="${id}-title">${title}</h2></header>${content}</section>`;
const icon = id => `<svg aria-hidden="true" width="16" height="16"><use href="./assets/icons/ui-sprite.svg#ui-i-${id}"></use></svg>`;
const options = (items, selected) => items.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escape(label)}</option>`).join('');
const areaOptions = () => [['', 'Semua area'], ...Object.entries(data.areas).map(([id, area]) => [id, area.title])];
function field(id, label, items, selected) {
  return `<div class="field select-field"><label for="${id}">${label}</label><select id="${id}" class="input">${options(items, selected)}</select>${icon('chevron-down')}</div>`;
}
function navigation() {
  const {view} = data.parseRoute(location.hash);
  return data.navigation.map(([id, title]) => `<a class="nav-item" href="#/${id}"${id === view ? ' aria-current="page"' : ''}>${escape(title)}</a>`).join('');
}
function shell() {
  root.innerHTML = `<div class="app"><aside id="review-sidebar" class="sidebar" aria-label="Navigasi tinjauan">
    <button class="btn close-menu" type="button">Tutup menu</button>
    <div class="brand"><img src="./assets/abc-movement-logo.png" alt="ABC Movement" width="132" height="56"><p class="brand-name">${data.product}</p><p class="meta">Tinjauan UI/UX</p></div>
    <p class="group-label">Pemeriksaan</p><nav class="nav" aria-label="Area tinjauan">${navigation()}</nav><p class="scope meta">Mentor · Admin · Superadmin</p></aside>
    <div class="workspace"><div class="mobile-bar"><span>ABC MSA</span><button id="open-menu" class="btn" type="button" aria-controls="review-sidebar" aria-expanded="false">Menu</button></div><main id="review-main" class="canvas"></main></div></div>
    <dialog id="image-dialog" aria-labelledby="image-dialog-title"><div class="dialog-head"><h2 id="image-dialog-title">Pratinjau C10</h2><button class="btn" id="close-image" type="button">Tutup</button></div><div id="dialog-media"></div></dialog>`;
  document.querySelector('#open-menu').addEventListener('click', () => setMenu(true));
  document.querySelector('.nav').addEventListener('click', event => {
    const link=event.target.closest('a');
    if(link&&link.hash===location.hash&&state.menu){setMenu(false);document.querySelector('h1').focus();}
  });
  document.querySelector('.close-menu').addEventListener('click', () => setMenu(false));
  document.querySelector('#close-image').addEventListener('click', () => document.querySelector('#image-dialog').close());
  document.querySelector('#image-dialog').addEventListener('close', () => document.querySelector('#enlarge-image')?.focus());
  renderRoute();
}
function setMenu(open) {
  state.menu = open;
  const sidebar = document.querySelector('#review-sidebar');
  sidebar.classList.toggle('menu-open', open);
  sidebar.toggleAttribute('aria-modal', open);
  if (open) sidebar.setAttribute('role', 'dialog'); else sidebar.removeAttribute('role');
  document.querySelector('.workspace').inert = open;
  document.body.style.overflow = open ? 'hidden' : '';
  document.querySelector('#open-menu').setAttribute('aria-expanded', String(open));
  if (open) {
    document.querySelector('.close-menu').focus();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sidebar.animate([{transform:'translateX(-12px)'},{transform:'none'}], {duration:180,easing:'cubic-bezier(0.2, 0, 0, 1)'});
  } else document.querySelector('#open-menu').focus();
}
function overview() {
  const unassessed = data.categories.every(c => c.rating === null);
  const score = `<ul class="score-list">${data.categories.map(c => `<li><span>${c.name}</span>${unassessed ? '' : `<span class="meta">${c.rating === null ? 'Belum dinilai' : escape(c.rating)}</span>`}</li>`).join('')}</ul><p class="meta">Penilaian heuristik ahli, bukan hasil pengujian pengguna.</p>`;
  const comparison = `<ul class="baseline-list">${data.baseline.map(text => `<li><span class="meta">Baseline C10</span><span>${text}</span></li>`).join('')}<li><span class="meta">Mockup terbaru</span><span>Perbandingan belum tersedia</span></li></ul><p class="comparison-compact">${escape(data.baselineSummary)}</p><div class="panel-footer">${controls('Lihat baseline', '#/sumber?source=c10-preview')}</div>`;
  return `<div class="grid overview-grid">
    ${panel('tinjauan-ringkasan', 'Ringkasan', `<div class="summary-text"><p>${data.finding}</p></div>${controls('Periksa sumber', '#/sumber', true)}`, 'full summary')}
    ${panel('tinjauan-scorecard', `Scorecard${unassessed ? ' <span class="meta">Belum dinilai</span>' : ''}`, score, 'half paired')}
    ${panel('tinjauan-perbandingan', 'Kekuatan dan kelemahan', comparison, 'half comparison paired')}
    ${panel('tinjauan-temuan', 'Temuan', `<div class="filters">${field('finding-area','Area',areaOptions(),state.findings.area)}${field('finding-priority','Prioritas',[['','Semua prioritas'],['P0','P0 · Kritis'],['P1','P1 · Tinggi'],['P2','P2 · Sedang'],['P3','P3 · Opsional']],state.findings.priority)}<button class="btn" id="reset-findings" type="button">Reset</button></div><p id="finding-results" class="empty" role="status">Belum ada temuan desain terverifikasi.</p>`, 'half state-feedback')}
    ${panel('tinjauan-rekomendasi', 'Rekomendasi', `<p class="empty">Prioritas perbaikan menunggu temuan terverifikasi.</p><div class="panel-footer">${controls('Periksa sumber','#/sumber')}</div>`, 'half paired')}
    ${panel('tinjauan-keputusan', 'Keputusan adopsi', `<div><p>Belum ditetapkan</p><p class="meta">Verifikasi mockup terbaru dan baseline sebelum menentukan kelayakan adopsi.</p></div><div class="panel-footer">${controls('Lihat sumber','#/sumber')}</div>`, 'full decision')}
  </div>`;
}
function areaView(view) {
  const area = data.areas[view];
  const topics = `<ul class="topic-list">${area.topics.map((title, i) => `<li><button type="button" class="topic-row" data-topic="${i}" aria-pressed="${state.topic === i}" aria-controls="topic-detail"><span class="source-identity"><span>${title}</span><span class="meta">Belum diperiksa</span></span>${icon('chevron-right')}</button></li>`).join('')}</ul>`;
  return `<p class="notice">${area.finding}</p><div class="grid area-layout${state.topic !== null ? ' detail-open' : ''}">${panel(`${view}-pemeriksaan`, 'Pemeriksaan', topics, 'main-col list-panel')}${panel('topic-detail', 'Konteks pemeriksaan', '', 'side-col detail')}</div>`;
}
function renderTopic(view, focus = false) {
  const area = data.areas[view], detail = document.querySelector('#topic-detail');
  if (!detail) return;
  detail.innerHTML = `<button type="button" class="btn back-list">Kembali ke pemeriksaan</button><h2 id="topic-detail-title" tabindex="-1">${escape(state.topic === null ? 'Konteks pemeriksaan' : area.topics[state.topic])}</h2><p class="meta">${area.scope}</p><p>Belum diperiksa</p><p class="meta">${area.question}</p>${view === 'absensi' ? '<p class="meta">Dashboard Mentor dipilih sebagai acuan. Isi PDF belum dapat diperiksa.</p>' : ''}${controls('Periksa sumber', `#/sumber?area=${view}`, true)}`;
  detail.querySelector('.back-list').onclick = () => {
    const previous = state.topic; state.topic = null;
    document.querySelector('.area-layout').classList.remove('detail-open');
    document.querySelectorAll('[data-topic]').forEach(b => b.setAttribute('aria-pressed','false'));
    document.querySelector(`[data-topic="${previous}"]`)?.focus();
  };
  if (focus) detail.querySelector('h2').focus();
}
function sourceView() {
  return `<p class="notice">Bukti lokal dan katalog referensi · Tidak tersinkron otomatis</p><div class="grid source-layout${state.source ? ' detail-open' : ''}">
    ${panel('sumber-katalog', 'Daftar sumber', `<div class="filters"><div class="field search-field"><label for="source-search">Cari sumber</label><input id="source-search" class="input" type="search" autocomplete="off" value="${escape(state.filters.query)}"></div>${field('source-status','Ketersediaan',[['','Semua sumber'],['available','Tersedia lokal'],['unavailable','Belum tersedia']],state.filters.status)}${field('source-area','Area',areaOptions(),state.filters.area)}<button class="btn" id="reset-sources" type="button">Reset</button></div><p id="source-count" class="meta" role="status"></p><ul id="source-results" class="source-list"></ul>`, 'main-col list-panel state-feedback')}
    ${panel('source-detail', 'Bukti terpilih', '<p class="muted">Pilih sumber untuk memeriksa bukti.</p>', 'side-col detail')}
  </div>`;
}
function updateSources() {
  const rows = data.filterSources(state.filters);
  document.querySelector('#source-count').textContent = `${rows.length} sumber sesuai filter`;
  document.querySelector('#source-results').innerHTML = rows.length ? rows.map(s => `<li><button class="source-row" type="button" data-source="${s.id}" aria-pressed="${state.source === s.id}" aria-controls="source-detail"><span class="source-identity"><span>${escape(s.title)}</span><span class="source-kind">${s.kind}${s.selectedDirection ? ' · Referensi terpilih' : ''}</span></span><span class="source-status">${s.inspectionLevel}</span></button></li>`).join('') : '<li class="empty">Tidak ada sumber yang cocok.</li>';
  document.querySelector('#sumber-katalog').dataset.filtered = String(Object.values(state.filters).some(Boolean));
  document.querySelectorAll('[data-source]').forEach(button => button.onclick = () => {
    state.source = button.dataset.source;
    document.querySelector('.source-layout').classList.add('detail-open');
    updateSources(); renderSource(true);
  });
  if (state.source && !rows.some(s => s.id === state.source)) {
    state.source = ''; document.querySelector('.source-layout').classList.remove('detail-open');
    document.querySelector('#source-detail').innerHTML = '<h2>Bukti terpilih</h2><p class="muted">Pilih sumber untuk memeriksa bukti.</p>';
  }
}
function imageMarkup(source) {
  return `<p class="preview-status" role="status">Memuat pratinjau…</p><img class="preview" src="./${source.localPath}" alt="${escape(source.title)}"><button type="button" id="enlarge-image" class="btn" disabled>Perbesar</button>`;
}
function bindImage(container, source, enlarged = false) {
  const image = container.querySelector('img'), status = container.querySelector('.preview-status');
  const success = () => { status.textContent = ''; container.querySelector('#enlarge-image')?.removeAttribute('disabled'); };
  const failure = () => {
    image.hidden = true;
    status.textContent = 'Pratinjau tidak dapat dimuat.';
    container.querySelector('#enlarge-image')?.setAttribute('disabled','');
    if (!container.querySelector('[data-retry-image]')) {
      const button = document.createElement('button');button.type='button';button.className='btn';button.dataset.retryImage='';button.textContent='Coba lagi';
      button.onclick = () => {button.remove();image.hidden=false;status.textContent='Memuat pratinjau…';image.src=`./${source.localPath}?retry=${Date.now()}`;};container.append(button);
    }
  };
  image.addEventListener('load',success);image.addEventListener('error',failure);
  if (image.complete) { if(image.naturalWidth)success();else failure(); }
  if (!enlarged) container.querySelector('#enlarge-image').onclick = () => {
    const dialog = document.querySelector('#image-dialog');
    document.querySelector('#image-dialog-title').textContent = source.title;
    const media = document.querySelector('#dialog-media');
    media.innerHTML=`<p class="preview-status" role="status">Memuat pratinjau…</p><img src="./${source.localPath}" alt="${escape(source.title)}">`;
    dialog.showModal();bindImage(media, source, true);
  };
}
let sourceRequest = 0;
async function renderSource(focus = false) {
  const source = data.sources.find(s => s.id === state.source), detail = document.querySelector('#source-detail');
  if (!source || !detail) return;
  const request = ++sourceRequest;
  detail.innerHTML = `<button class="btn back-list" type="button">Kembali ke sumber</button><h2 id="source-detail-title" tabindex="-1">${escape(source.title)}</h2><p class="meta">${source.inspectionLevel}</p><p>${escape(source.provenance)}</p>${source.filename ? `<p class="meta">${escape(source.filename)}</p>` : ''}${source.media === 'image' ? `<div id="source-media">${imageMarkup(source)}</div>` : source.media === 'text' ? '<div id="source-text" class="loading-frame" aria-busy="true"><p class="meta">Memuat dokumen…</p><div class="skeleton"></div></div>' : '<p class="rule meta">Berkas belum tersedia. Tidak ada pratinjau yang dapat diperiksa.</p>'}`;
  detail.querySelector('.back-list').onclick = () => {
    const previous = state.source;document.querySelector('.source-layout').classList.remove('detail-open');
    document.querySelector(`[data-source="${previous}"]`)?.focus();
  };
  if(focus) detail.querySelector('h2').focus();
  if(source.media === 'image') bindImage(detail.querySelector('#source-media'), source);
  if(source.media === 'text') {
    try {
      const response = await fetch(`./${source.localPath}`);
      if(!response.ok)throw Error('Unavailable');
      const text = await response.text();
      if(request !== sourceRequest || !document.querySelector('#source-text'))return;
      const well = document.querySelector('#source-text');well.setAttribute('aria-busy','false');well.innerHTML='<pre></pre>';well.querySelector('pre').textContent=text;
    } catch {
      if(request !== sourceRequest || !document.querySelector('#source-text'))return;
      const well=document.querySelector('#source-text');well.setAttribute('aria-busy','false');well.innerHTML='<p class="error-text" role="status">Dokumen tidak dapat dimuat.</p><button class="btn" type="button">Coba lagi</button>';well.querySelector('button').onclick=()=>renderSource();
    }
  }
}
function renderRoute() {
  sourceRequest++;
  if(state.menu)setMenu(false);
  const dialog=document.querySelector('#image-dialog');if(dialog.open)dialog.close();
  const {view, params} = data.parseRoute(location.hash);
  state.topic = null;
  const title = data.navigation.find(([id]) => id === view)?.[1] || 'Halaman tidak ditemukan';
  document.title = `${title} · ABC MSA`;
  document.querySelector('.nav').innerHTML=navigation();
  const main=document.querySelector('#review-main');
  const body=view==='tinjauan'?overview():data.areas[view]?areaView(view):view==='sumber'?sourceView():panel('missing','Halaman tidak ditemukan',controls('Kembali ke tinjauan','#/tinjauan'),'full');
  main.innerHTML=`<div class="title-row"><h1 tabindex="-1">${title}</h1></div>${body}`;
  if(data.areas[view]) {
    renderTopic(view);
    main.querySelectorAll('[data-topic]').forEach(button=>button.onclick=()=>{
      state.topic=Number(button.dataset.topic);main.querySelector('.area-layout').classList.add('detail-open');
      main.querySelectorAll('[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderTopic(view,true);
    });
  }
  if(view==='tinjauan') {
    document.querySelector('#reset-findings').onclick=()=>{
      state.findings={area:'',priority:''};document.querySelector('#finding-area').value='';document.querySelector('#finding-priority').value='';
      document.querySelector('#finding-results').textContent='Belum ada temuan desain terverifikasi.';
      document.querySelector('#tinjauan-temuan').dataset.filtered='false';
    };
    for(const [id,key] of [['finding-area','area'],['finding-priority','priority']]) document.getElementById(id).onchange=event=>{
      state.findings[key]=event.target.value;
      const rows=data.filterFindings(state.findings);document.querySelector('#finding-results').textContent=rows.length?`${rows.length} temuan`:'Belum ada temuan desain terverifikasi.';
      document.querySelector('#tinjauan-temuan').dataset.filtered=String(Object.values(state.findings).some(Boolean));
    };
  }
  if(view==='sumber') {
    if(!params.has('source'))state.source='';
    if(params.has('area'))state.filters.area=params.get('area');
    if(params.has('source')) {state.filters={query:'',area:'',status:''};state.source=params.get('source');}
    document.querySelector('#source-area').value=state.filters.area;
    document.querySelector('#source-search').value=state.filters.query;
    document.querySelector('#source-status').value=state.filters.status;
    for(const [id,key,event] of [['source-search','query','input'],['source-status','status','change'],['source-area','area','change']])document.getElementById(id).addEventListener(event,e=>{state.filters[key]=e.target.value;updateSources();});
    document.querySelector('#reset-sources').onclick=()=>{state.filters={query:'',area:'',status:''};document.querySelector('#source-search').value='';document.querySelector('#source-status').value='';document.querySelector('#source-area').value='';updateSources();};
    updateSources();renderSource();
    document.querySelector('.source-layout').classList.toggle('detail-open',Boolean(state.source));
  }
  main.querySelector('h1').focus({preventScroll:true});
  window.scrollTo(0,0);
}
document.addEventListener('keydown', event => {
  if(!state.menu)return;
  if(event.key==='Escape'){event.preventDefault();setMenu(false);}
  if(event.key==='Tab') {
    const nodes=[...document.querySelectorAll('#review-sidebar button, #review-sidebar a')].filter(n=>n.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
matchMedia('(min-width:1101px)').addEventListener('change',event=>{if(event.matches&&state.menu)setMenu(false);});
window.addEventListener('hashchange',()=>{if(data)renderRoute();});
let bootAttempt=0;
async function boot() {
  const modulePath=bootAttempt++ ? `./review-data.js?retry=${bootAttempt}` : './review-data.js';
  try { data=await import(modulePath);shell(); }
  catch {root.innerHTML='<main class="canvas"><h1>Tinjauan UI/UX</h1><section class="panel"><h2>Data tinjauan</h2><p role="status">Data tinjauan tidak dapat dimuat.</p><button id="retry-app" class="btn" type="button">Coba lagi</button></section></main>';document.querySelector('#retry-app').onclick=boot;}
}
boot();
