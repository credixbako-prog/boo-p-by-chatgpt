/* Illustrated reading milestones. Artwork is local SVG, no external image service. */
window.BT = window.BT || {};
BT.badges = (() => {
  const families = {reading:'Au fil des livres',lexicon:'Les mots qui restent',reflection:'Prendre le temps de penser',time:'Rendez-vous avec la lecture',goals:'À votre rythme',exploration:'Ouvrir ses horizons',sharing:'Faire circuler les livres'};
  const art = {
    reading:'<g class="badge-moving"><path d="M32 31h34a5 5 0 0 1 5 5v40H36a5 5 0 0 1-5-5V33Z" fill="#314c65"/><path d="M37 32v39m0 0h34M41 40h21M41 45h14"/><path d="M31 71q0 6 6 6h35"/></g><path class="badge-accent" d="M56 31v23l6-4 6 4V31" fill="#cca364"/>',
    lexicon:'<g class="badge-moving"><path d="m29 62 11-29 11 29m-18-9h15" stroke-width="3"/><path d="M58 48c14-8 20 0 13 7-5 5-18 0-15 9 2 6 13 1 15-5v8" stroke-width="3"/></g><path class="badge-accent" d="M28 75c15-6 29 4 46-3"/>',
    reflection:'<path class="badge-accent" d="M29 75c7-8 11 3 20-2 8-5 14 3 23-2"/><g class="badge-moving"><path d="M35 65c-2-24 15-37 39-39-1 22-10 34-30 34Z" fill="#829a89"/><path d="m29 73 36-37m-18 8 1 13 14-1M55 35v12"/></g>',
    time:'<path d="M30 72h44M34 28h36m-32 2c-2 21 7 15 14 24 7-9 15-3 14-24M38 70c-2-14 6-16 14-16 8 0 16 2 14 16"/><path class="badge-moving" d="m43 36 9 14 9-14M41 69l11-10 11 10Z" fill="#cca364"/><path d="M30 78h44"/>',
    goals:'<path class="badge-accent" d="M28 75c-8-25 43-12 36-30-3-7-17-2-14-11" stroke-width="3" stroke-dasharray="3 5"/><g class="badge-moving"><path d="M50 42V24m0 1c10-8 13 8 24 0v16c-11 8-14-8-24 0" fill="#829a89"/></g><circle cx="28" cy="75" r="4" fill="#cca364"/>',
    exploration:'<circle cx="52" cy="52" r="25"/><path d="M52 22v8m0 44v8M22 52h8m44 0h8"/><g class="badge-moving"><path d="m42 63 6-16 15-6-6 16Z" fill="#cca364"/><path d="m48 47 9 10"/></g><circle cx="52" cy="52" r="2" fill="#314c65"/>',
    sharing:'<g class="badge-moving"><rect x="41" y="28" width="25" height="32" rx="3" fill="#829a89"/><path d="M47 29v29m6-21h7m-7 5h7"/></g><path class="badge-accent" d="m23 53 12 12h16c8 0 6 7 0 7H37L23 63m58-18L69 57H55c-8 0-6 7 0 7h14l12-10"/>'
  };
  function artwork(badge) {
    const family=Object.hasOwn(art,badge.family)?badge.family:'reading';
    const tier=Math.min(5,Math.max(1,Number(badge.tier)||1));
    const marks=Array.from({length:tier},(_,i)=>`<circle cx="${52+(i-(tier-1)/2)*7}" cy="89" r="1.7" fill="#cca364" stroke="none"/>`).join('');
    const variants={
      'first-step':'<g class="badge-moving"><path d="M52 37c-9-8-21-8-29-5v37c10-4 20-1 29 5 9-6 19-9 29-5V32c-8-3-20-3-29 5Z" fill="#e4e8dc"/><path d="M52 37v37M31 41l13 3m-13 6 13 3m16-9 13-3m-13 12 13-3"/></g>',
      'between-pages':'<g class="badge-moving"><rect x="27" y="31" width="28" height="42" rx="3" fill="#829a89" transform="rotate(-10 41 52)"/><rect x="51" y="29" width="28" height="42" rx="3" fill="#cca364" transform="rotate(10 65 50)"/><path d="m34 38 3 27m24-31-4 29" stroke="#f7f3e9"/></g>',
      'five-books':'<g class="badge-moving"><path d="M29 65h44v11H29q-8-5 0-11Zm2-15h44v11H31q-8-5 0-11Zm-2-15h44v11H29q-8-5 0-11Z" fill="#829a89"/><path d="M32 41h36M34 56h35M32 71h36" stroke="#f7f3e9"/></g>',
      'ten-books':'<g class="badge-moving"><path d="M28 31h36v42H28Z" fill="#829a89"/><path d="M35 32v39m8-30h13m-13 7h9"/><path d="m62 51 6 12 13 2-10 9 2 13-11-6-12 6 3-13-10-9 13-2Z" fill="#cca364"/></g>',
      'twenty-five-books':'<g class="badge-moving"><path d="M24 77V28h56v49M24 52h56M24 77h56"/><path d="M30 32h9v20h-9Zm13 4h9v16h-9Zm14-5 8-2 6 21-8 2ZM30 57h10v20H30Zm15 3h8v17h-8Zm14-4h13v21H59Z" fill="#829a89"/></g>',
      'fifty-books':'<g class="badge-moving"><circle cx="52" cy="45" r="23" fill="#e4e8dc"/><path d="M29 45h46M52 22c-14 12-14 34 0 46 14-12 14-34 0-46"/><path d="M23 64q15-6 29 2 14-8 29-2v17q-14-6-29 2-15-8-29-2Z" fill="#cca364"/><path d="M52 66v17"/></g>',
      'expressions':'<g class="badge-moving"><path d="M27 31h50v33H48L34 77V64h-7Z" fill="#e4e8dc"/><path d="M37 43h30M37 52h21"/></g>',
      'citations':'<g class="badge-moving"><path d="M30 38h17v20H37q-1 11-9 14V59l2-21Zm29 0h17v20H66q-1 11-9 14V59l2-21Z" fill="#829a89"/></g>',
      'first-notebook':'<g class="badge-moving"><rect x="29" y="27" width="43" height="51" rx="4" fill="#e4e8dc"/><path d="M39 27v51m6-39h18m-18 8h18m-18 8h12"/><path d="m60 73 3-13 17-17 6 6-17 17-9 7Z" fill="#cca364"/></g>',
      'word-treasure':'<g class="badge-moving"><path d="M25 48q0-20 27-20t27 20v29H25Z" fill="#829a89"/><path d="M25 48h54M39 31v44m26-44v44"/><path d="M46 44h12v14H46Z" fill="#cca364"/><path d="m34 22 3-7 3 7m25-2 3-7 3 7"/></g>'
    };
    return `<svg class="badge-art badge-art--${family}" viewBox="0 0 104 104" aria-hidden="true" focusable="false" fill="none" stroke="#f1e5ce" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="52" cy="52" r="49" fill="#142438" stroke="#c9b68e"/><circle cx="52" cy="52" r="44" stroke="#425568"/><path d="m19 30 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#cca364" stroke="none"/>${(variants[badge.id]||art[family]).replace(/#183149/g,'#f1e5ce')}${marks}</svg>`;
  }
  function chip(badge) {
    const node=document.createElement('button');node.type='button';node.className='profile-badge-chip';
    node.innerHTML=artwork(badge);const name=document.createElement('span');name.textContent=badge.name;node.append(name);
    node.setAttribute('aria-label','Dernier badge : '+badge.name+'. Afficher sa signification');
    node.onclick=()=>{const d=document.createElement('dialog');d.className='app-dialog badge-detail';d.setAttribute('aria-label',badge.name);d.innerHTML=artwork(badge);
      const h=document.createElement('h2');h.textContent=badge.name;const p=document.createElement('p');p.textContent=badge.description;
      const close=document.createElement('button');close.type='button';close.className='button button--primary';close.textContent='Fermer';close.onclick=()=>d.close();d.append(h,p,close);document.body.append(d);d.onclose=()=>d.remove();d.showModal();};return node;
  }

  let started=false, timer, retryTimer, account, syncing=false, syncedSignature='', celebration;
  const who=()=>BT.auth?.isAuthenticated()&&!BT.auth?.isGuest()?BT.auth.getCurrentUser()?.id:null;
  const signature=()=>JSON.stringify(BT.store.getBadges().items.filter(b=>b.unlockedAt).map(b=>[b.id,b.unlockedAt]));
  function refreshChip() {
    const host=document.querySelector('[data-own-badge]');if(!host)return;const latest=BT.store.getBadges().latest;host.replaceChildren();if(latest)host.append(chip(latest));
  }
  async function sync() {
    const id=who();if(!id||!navigator.onLine||syncing||signature()===syncedSignature)return;
    syncing=true;
    try {
      const remote=await BT.readerProfileApi.badges(id);if(who()!==id)return;
      BT.store.mergeBadgeAwards(remote);
      const rows=BT.store.getBadges().items.filter(b=>b.unlockedAt&&!remote.some(r=>r.badge_id===b.id));
      if(rows.length)await BT.readerProfileApi.saveBadges(rows,id);
      if(who()!==id)return;
      // Read back authoritative dates after an insert race with another device.
      const saved=await BT.readerProfileApi.badges(id);
      if(who()!==id)return;
      BT.store.mergeBadgeAwards(saved,{preservePending:true});
      syncedSignature=JSON.stringify(BT.store.getBadges().items.filter(b=>saved.some(r=>r.badge_id===b.id)).map(b=>[b.id,b.unlockedAt]));refreshChip();
    } catch { /* Local awards remain available; retry on next mutation or reconnect. */ }
    finally {syncing=false;}
  }
  function check() {
    clearTimeout(timer);
    const id=who();
    if(account!==id){account=id;syncedSignature='';celebration?.close();BT.store.consumeBadgeCelebrations();}
    timer=setTimeout(()=>{
      refreshChip();void sync();
      if(!BT.store.getState().badges.pending?.length)return;
      if(document.hidden||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,[contenteditable="true"]')){clearTimeout(retryTimer);retryTimer=setTimeout(check,1000);return;}
      const awards=BT.store.consumeBadgeCelebrations();if(awards.length)celebrate(awards);
    },250);
  }
  function celebrate(awards) {
    const d=document.createElement('dialog');celebration=d;d.className='app-dialog badge-celebration';d.setAttribute('aria-labelledby','badge-celebration-title');
    const previous=document.activeElement;
    const latest=awards.slice().sort((a,b)=>new Date(b.unlockedAt)-new Date(a.unlockedAt)||a.id.localeCompare(b.id))[0];
    d.innerHTML=`<button class="icon-button badge-celebration-close" type="button" aria-label="Fermer la célébration">×</button><div class="badge-celebration-art">${artwork(latest)}</div><p class="eyebrow">Une nouvelle étape</p><h2 id="badge-celebration-title"></h2><p class="badge-celebration-copy"></p>`;
    d.querySelector('h2').textContent=awards.length>1?`${awards.length} nouveaux badges !`:latest.name;
    d.querySelector('.badge-celebration-copy').textContent=awards.length>1?awards.map(b=>b.name).join(' · '):'Chaque lecture laisse sa marque. Celle-ci est la vôtre.';
    if(awards.length>1){const row=document.createElement('div');row.className='badge-celebration-group';for(const badge of awards){const span=document.createElement('span');span.innerHTML=artwork(badge);span.title=badge.name;row.append(span);}d.append(row);}
    d.querySelector('button').onclick=()=>d.close();document.body.append(d);d.showModal();
    const timeout=setTimeout(()=>d.close(),awards.length>1?5000:3200);
    d.onclose=()=>{clearTimeout(timeout);d.remove();celebration=null;if(previous?.isConnected)previous.focus({preventScroll:true});check();};
  }
  function start() {
    if(started)return;started=true;account=who();BT.store.getBadges({silent:true});BT.store.consumeBadgeCelebrations();
    BT.store.subscribe(check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);check();
  }
  return {families,artwork,chip,start,refreshChip};
})();
