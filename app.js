'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'zusammen_lecker_recipes_v1';
  const ROOM_KEY = 'zusammen_lecker_room_v1';
  const categories = ['Alle', 'Asiatisch', 'Pasta', 'Vegetarisch', 'Meal Prep', 'Schnell & einfach', 'Backen', 'Sonstiges'];
  const catMeta = {
    'Asiatisch': ['🥟', 'tone-orange'], 'Pasta': ['🍝', 'tone-yellow'], 'Vegetarisch': ['🥦', 'tone-green'],
    'Meal Prep': ['🍱', 'tone-lilac'], 'Schnell & einfach': ['🍳', 'tone-yellow'], 'Backen': ['🥖', 'tone-pink'], 'Sonstiges': ['🍲', 'tone-green']
  };
  const seedRecipe = {
    id: 'chicken-gyoza-erstausgabe', title: 'Chicken Gyoza', subtitle: 'Dünner Teig, saftiges Hähnchen und knuspriger Boden. Inspiriert von euren Lieblings-Gyoza.',
    category: 'Asiatisch', time: 75, portions: 30, unit: 'Stück', favorite: true,
    ingredients: [
      '250 g Weizenmehl Type 405', '125 ml heißes Wasser', '½ TL Salz', '300 g Hähnchenhack aus der Keule',
      '150 g Chinakohl', '2 Stück Frühlingszwiebeln', '1 Stück Knoblauchzehe', '1 TL frisch geriebener Ingwer',
      '1,5 EL Sojasauce', '1 TL Sesamöl', '½ TL Zucker', '1 TL Speisestärke', '2 EL kaltes Wasser für die Füllung',
      '1 EL neutrales Öl zum Braten', '80 ml Wasser zum Dämpfen', '2 EL Sojasauce für den Dip',
      '1 EL Reisessig für den Dip', '½ TL Sesamöl für den Dip'
    ],
    steps: [
      'Wrapper-Teig: Mehl, Salz und heißes Wasser vermengen. Etwa 8–10 Minuten zu einem glatten Teig kneten und 30 Minuten abgedeckt ruhen lassen.',
      'Chinakohl sehr fein schneiden, etwas salzen, 10 Minuten ziehen lassen und anschließend gut ausdrücken.',
      'Hähnchenhack mit Chinakohl, fein geschnittenen Frühlingszwiebeln, Knoblauch, Ingwer, Sojasauce, Sesamöl, Zucker, Speisestärke und 2 EL kaltem Wasser verrühren, bis die Masse leicht klebrig ist.',
      'Teig in 30 Stücke teilen und sehr dünn (ca. 1 mm) zu Kreisen von 9–10 cm Durchmesser ausrollen.',
      'Je einen gut gehäuften Teelöffel Füllung in die Mitte geben. Rand mit Wasser befeuchten, zusammenklappen und in Falten verschließen.',
      'Öl in einer beschichteten Pfanne erhitzen. Die Gyoza mit der flachen Seite nach unten ca. 2 Minuten anbraten.',
      '80 ml Wasser zugießen, sofort abdecken und 5–7 Minuten dämpfen. Die Hähnchenfüllung muss vollständig durchgegart sein (mindestens 74 °C im Kern).',
      'Deckel abnehmen, Wasser verdampfen lassen und die Böden erneut knusprig braten. Sojasauce, Reisessig und Sesamöl zum Dip verrühren.'
    ], updatedAt: Date.now()
  };
  const initialState = () => ({ recipes: [seedRecipe], shopping: [] });
  const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const newId = () => crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newRoomId = () => {
    if (globalThis.crypto?.getRandomValues) {const bytes = new Uint8Array(16); crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');}
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  };
  function loadState() {
    try {const obj = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (obj && Array.isArray(obj.recipes) && Array.isArray(obj.shopping)) return obj;} catch(e) {}
    return initialState();
  }
  let state = loadState();
  let activeTab = 'recipes', selectedCategory = 'Alle', search = '', detailId = null, detailAmount = 30;
  let cloud = null, cloudConfigured = !!(window.COOKBOOK_FIREBASE_CONFIG?.apiKey && window.COOKBOOK_FIREBASE_CONFIG?.projectId);
  const queryRoom = new URLSearchParams(location.search).get('raum');
  let storedRoom = null; try {storedRoom = localStorage.getItem(ROOM_KEY);} catch(e) {}
  let roomId = (/^[a-f0-9]{32}$/.test(queryRoom || '') && queryRoom) || storedRoom || newRoomId();
  if (!/^[a-f0-9]{32}$/.test(roomId)) roomId = newRoomId();
  try {localStorage.setItem(ROOM_KEY, roomId);} catch(e) {}
  let toastTimer;
  function toast(message) {const el = $('toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2900);}
  function persistLocal() {try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){toast('Speicher voll – bitte eine Sicherung exportieren.');}}
  const recipeById = (id) => state.recipes.find(r => r.id === id);
  function saveRecipe(recipe) {
    const index = state.recipes.findIndex(r => r.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe; else state.recipes.unshift(recipe);
    persistLocal(); renderAll();
    if (cloud) cloud.api.setDoc(cloud.api.doc(cloud.db, 'rooms', roomId, 'recipes', recipe.id), recipe).catch(onCloudError);
  }
  function deleteRecipe(id) {
    state.recipes = state.recipes.filter(r => r.id !== id);
    persistLocal(); renderAll();
    if (cloud) cloud.api.deleteDoc(cloud.api.doc(cloud.db, 'rooms', roomId, 'recipes', id)).catch(onCloudError);
  }
  function saveShopping(item) {
    const index = state.shopping.findIndex(x => x.id === item.id);
    if (index < 0) state.shopping.push(item); else state.shopping[index] = item;
    persistLocal(); renderShopping();
    if (cloud) cloud.api.setDoc(cloud.api.doc(cloud.db, 'rooms', roomId, 'shopping', item.id), item).catch(onCloudError);
  }
  function deleteShopping(id) {
    state.shopping = state.shopping.filter(x => x.id !== id);
    persistLocal(); renderShopping();
    if (cloud) cloud.api.deleteDoc(cloud.api.doc(cloud.db, 'rooms', roomId, 'shopping', id)).catch(onCloudError);
  }
  function onCloudError(err) {console.error('Synchronisierung',err); toast('Synchronisierung fehlgeschlagen – Verbindung prüfen.');}
  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === `screen-${tab}`));
    document.querySelectorAll('.nav-button').forEach(el => {const yes = el.dataset.tab === tab; el.classList.toggle('selected',yes); if(yes) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function cardMarkup(r) {
    const [emoji,tone] = catMeta[r.category] || catMeta['Sonstiges'];
    return `<article class="recipe-card"><div class="recipe-picture ${tone}" data-open="${escapeHTML(r.id)}" tabindex="0" role="button" aria-label="Rezept ${escapeHTML(r.title)} öffnen"><span aria-hidden="true">${emoji}</span></div>
      <button class="fav-button ${r.favorite?'is-fav':''}" data-fav="${escapeHTML(r.id)}" type="button" aria-label="${r.favorite?'Aus Favoriten entfernen':'Zu Favoriten hinzufügen'}">${r.favorite?'♥':'♡'}</button>
      <div class="recipe-card-body"><span class="card-cat">${escapeHTML(r.category)}</span><h3 data-open="${escapeHTML(r.id)}">${escapeHTML(r.title)}</h3><p>${escapeHTML(r.subtitle || 'Selbst gemacht und richtig lecker.')}</p><div class="recipe-meta"><span>◷ ${Number(r.time)||'?'} Min.</span><span>♧ ${Number(r.portions)||'?'} ${escapeHTML(r.unit || 'Portionen')}</span></div></div></article>`;
  }
  function renderRecipes() {
    $('recipe-count').textContent = state.recipes.length;
    $('category-tabs').innerHTML = categories.map(c => `<button class="chip ${c===selectedCategory?'selected':''}" type="button" data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
    const matches = state.recipes.filter(r => (selectedCategory === 'Alle' || r.category === selectedCategory) && `${r.title} ${r.subtitle} ${r.category} ${r.ingredients?.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
    $('recipe-grid').innerHTML = matches.length ? matches.map(cardMarkup).join('') : `<div class="empty-state"><span>🍵</span><h3>Noch kein Treffer</h3><p>Probier einen anderen Suchbegriff oder füge ein Rezept hinzu.</p></div>`;
    const gyoza = state.recipes.find(r => r.id === seedRecipe.id);
    $('featured-recipe').style.display = gyoza ? '' : 'none';
  }
  function renderFavorites() {
    const matches = state.recipes.filter(r => r.favorite);
    $('favorite-grid').innerHTML = matches.length ? matches.map(cardMarkup).join('') : `<div class="empty-state"><span>♡</span><h3>Deine Favoriten warten</h3><p>Tippe bei einem Rezept auf das Herz – dann erscheint es hier.</p></div>`;
  }
  function renderShopping() {
    const list = state.shopping.slice().sort((a,b) => Number(a.checked)-Number(b.checked) || a.createdAt-b.createdAt);
    const done = list.filter(x=>x.checked).length;
    $('shopping-progress').textContent = list.length ? `${done} von ${list.length} erledigt` : 'Noch nichts auf der Liste';
    $('clear-completed').disabled = done===0;
    $('clear-completed').style.opacity = done===0 ? '.4':'1';
    $('shopping-list').innerHTML = list.length ? list.map(x=>`<div class="shopping-item ${x.checked?'done':''}"><input type="checkbox" data-check="${escapeHTML(x.id)}" ${x.checked?'checked':''} aria-label="${escapeHTML(x.name)} erledigt"><span class="shopping-name">${escapeHTML(x.name)}</span><button class="delete-row" type="button" data-delete-item="${escapeHTML(x.id)}" aria-label="Artikel löschen">×</button></div>`).join('') : `<div class="empty-state"><span>🛒</span><h3>Die Liste ist noch leer</h3><p>Trag etwas ein oder füge Zutaten aus einem Rezept hinzu.</p></div>`;
  }
  function renderMore() {
    $('room-description').textContent = cloud ? 'Euer Kochbuch wird in Echtzeit synchronisiert.' : cloudConfigured ? 'Verbindung wird aufgebaut …' : 'Noch privat auf diesem Gerät. Für Live-Teilen ist die Cloud-Einrichtung nötig.';
    $('sync-dot').classList.toggle('online',!!cloud);
    $('sync-label').textContent = cloud ? 'Gemeinsam live' : cloudConfigured ? 'Verbindung …' : 'Nur dieses Gerät';
  }
  function renderAll() {renderRecipes();renderFavorites();renderShopping();renderMore();}
  function openDialog(id) {const el = $(id); if (!el.open) el.showModal();}
  function closeDialog(id) {const el = $(id); if (el.open) el.close();}
  function parseIngredient(line, factor=1) {
    const match = String(line).trim().match(/^([0-9]+(?:[.,][0-9]+)?|½|¼|¾|\d+\/\d+)\s*(g|kg|ml|l|EL|TL|Stück|Prise|Prisen|Packung|Packungen|Bund|Zehe|Zehen|Dose|Dosen)?\s+(.+)$/i);
    if (!match) return String(line).trim();
    const frac = {'½':.5,'¼':.25,'¾':.75};
    const n = frac[match[1]] ?? (match[1].includes('/') ? match[1].split('/').map(Number).reduce((a,b)=>a/b) : Number(match[1].replace(',','.')));
    const value = n*factor;
    const display = (Math.round(value*100)/100).toLocaleString('de-DE',{maximumFractionDigits:2});
    return `${display} ${match[2] ? match[2]+' ' : ''}${match[3]}`;
  }
  function renderDetail() {
    const r = recipeById(detailId); if (!r) return;
    const factor = detailAmount / (Number(r.portions)||1);
    const ingredients = (r.ingredients||[]).map(s=>`<li>${escapeHTML(parseIngredient(s,factor))}</li>`).join('');
    const steps = (r.steps||[]).map(s=>`<li><span>${escapeHTML(s)}</span></li>`).join('');
    $('recipe-detail').innerHTML = `<div class="detail-cover"><div class="dialog-top"><span class="eyebrow">${escapeHTML(r.category)} · AUS UNSEREM KOCHBUCH</span><button class="close-button" type="button" data-close="recipe-dialog" aria-label="Schließen">×</button></div><h2 id="detail-title">${escapeHTML(r.title)}</h2><p>${escapeHTML(r.subtitle||'')}</p></div>
      <div class="detail-body"><div class="detail-stats"><span>◷ ${Number(r.time)||'?'} Minuten</span><span>🥄 ${Number(r.portions)||'?'} ${escapeHTML(r.unit||'Portionen')}</span><span>♡ ${r.favorite?'Favorit':'Selbst gemacht'}</span></div>
      <div class="serving-row"><h3>Zutaten</h3><div class="serving-controls"><button type="button" data-amount="minus" aria-label="Menge reduzieren">−</button><output>${detailAmount} ${escapeHTML(r.unit || 'Portionen')}</output><button type="button" data-amount="plus" aria-label="Menge erhöhen">+</button></div></div><ul class="ingredient-list">${ingredients}</ul>
      <button class="primary-button" type="button" data-action="ingredients-to-shopping">Zutaten auf Einkaufsliste <span>↗</span></button>
      <h3>So wird's gemacht</h3><ol class="step-list">${steps}</ol>
      <div class="detail-actions"><button type="button" data-action="edit-recipe">✎ Rezept bearbeiten</button><button type="button" data-action="delete-recipe" class="danger">Rezept löschen</button></div></div>`;
  }
  function openRecipe(id) {if(!recipeById(id))return;detailId=id;detailAmount=Number(recipeById(id).portions)||1;renderDetail();openDialog('recipe-dialog');}
  function openEditor(id=null) {
    const r = id ? recipeById(id) : null;
    $('editor-title').textContent = r ? 'Rezept bearbeiten' : 'Neues Rezept';
    $('form-id').value = r?.id || '';
    $('form-title').value = r?.title || '';
    $('form-subtitle').value = r?.subtitle || '';
    $('form-category').value = r?.category || 'Asiatisch';
    $('form-time').value = r?.time || 30;
    $('form-portions').value = r?.portions || 2;
    $('form-unit').value = r?.unit || 'Portionen';
    $('form-ingredients').value = (r?.ingredients||[]).join('\n');
    $('form-steps').value = (r?.steps||[]).join('\n');
    openDialog('editor-dialog');
  }
  function shareDialog() {
    $('join-details').hidden = !cloudConfigured;
    if (cloud) {
      const url = new URL(location.href);url.searchParams.set('raum',roomId);url.hash='';
      $('share-message').textContent = 'Schick Kathi diesen Einladungslink. Sobald sie ihn öffnet, seht ihr beide dieselben Rezepte und dieselbe Einkaufsliste.';
      $('share-link').value = url.toString();$('share-link-wrap').hidden=false;
      $('share-footnote').textContent = 'Wichtig: Wer den Link kennt, kann eure Sammlung bearbeiten. Teile ihn nur mit vertrauten Personen.';
    } else {
      $('share-link-wrap').hidden=true;
      $('share-message').textContent = cloudConfigured ? 'Die Live-Verbindung wird eingerichtet oder ist gerade nicht erreichbar. Überprüfe deine Internetverbindung sowie die Firebase-Einstellungen.' : 'Diese Vorschau speichert Rezepte auf deinem Gerät. Für ein echtes gemeinsames Kochbuch mit automatischer Synchronisierung muss die kostenlose Firebase-Datenbank einmal eingerichtet und die App online veröffentlicht werden. Die Anleitung liegt im Download-Paket.';
      $('share-footnote').textContent = 'Bis dahin kannst du eure Rezepte über „Mehr → Export“ sichern und als JSON-Datei austauschen.';
    }
    openDialog('share-dialog');
  }
  function exportJSON() {
    const file = new Blob([JSON.stringify({app:'zusammen-lecker',version:1,exportedAt:new Date().toISOString(),recipes:state.recipes,shopping:state.shopping},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='unser-kochbuch-sicherung.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Sicherung heruntergeladen.');
  }
  async function importJSON(file) {
    if (!file || file.size > 3_000_000) return toast('Bitte eine Sicherungsdatei unter 3 MB wählen.');
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.recipes) || !Array.isArray(parsed.shopping)) throw new Error('Keine gültige Sicherung.');
      if (!confirm('Alle Rezepte und Einkaufsartikel aus der Datei übernehmen? Vorhandene Einträge mit gleicher ID werden ersetzt.')) return;
      const cleanRecipes = parsed.recipes.filter(r=>r && typeof r.id==='string' && typeof r.title==='string' && Array.isArray(r.ingredients) && Array.isArray(r.steps)).slice(0,300);
      const cleanShopping = parsed.shopping.filter(x=>x && typeof x.id==='string' && typeof x.name==='string').slice(0,700);
      const recipeMap = new Map(state.recipes.map(x=>[x.id,x]));cleanRecipes.forEach(x=>recipeMap.set(x.id,x));
      const shopMap = new Map(state.shopping.map(x=>[x.id,x]));cleanShopping.forEach(x=>shopMap.set(x.id,x));
      state.recipes = Array.from(recipeMap.values());state.shopping=Array.from(shopMap.values());persistLocal();renderAll();
      if (cloud) {
        await Promise.all([...cleanRecipes.map(r=>cloud.api.setDoc(cloud.api.doc(cloud.db,'rooms',roomId,'recipes',r.id),r)),...cleanShopping.map(x=>cloud.api.setDoc(cloud.api.doc(cloud.db,'rooms',roomId,'shopping',x.id),x))]);
      }
      toast('Sicherung erfolgreich importiert.');
    } catch(err) {console.error(err);toast('Datei konnte nicht importiert werden.');}
  }
  function wireUI() {
    document.querySelectorAll('.nav-button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    $('brand-home').addEventListener('click',()=>setTab('recipes'));
    $('brand-home').addEventListener('keydown',e=>{if(e.key==='Enter')setTab('recipes');});
    $('sync-button').addEventListener('click',shareDialog);
    $('share-button').addEventListener('click',shareDialog);
    $('featured-open').addEventListener('click',()=>openRecipe(seedRecipe.id));
    $('add-recipe').addEventListener('click',()=>openEditor());
    $('recipe-search').addEventListener('input',e=>{search=e.target.value;renderRecipes();});
    $('shopping-form').addEventListener('submit',e=>{e.preventDefault();const name=$('shopping-input').value.trim();if(!name)return;saveShopping({id:newId(),name,checked:false,createdAt:Date.now()});$('shopping-input').value='';$('shopping-input').focus();toast('Auf die Einkaufsliste gesetzt.');});
    $('clear-completed').addEventListener('click',()=>{const done=state.shopping.filter(x=>x.checked);if(!done.length)return;done.forEach(x=>deleteShopping(x.id));toast('Erledigte Artikel gelöscht.');});
    $('recipe-form').addEventListener('submit',e=>{
      e.preventDefault();const old=recipeById($('form-id').value);
      const ingredients=$('form-ingredients').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,120);
      const steps=$('form-steps').value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,70);
      if(!ingredients.length||!steps.length)return toast('Zutaten und Zubereitung eintragen.');
      const recipe={id:old?.id||newId(),title:$('form-title').value.trim(),subtitle:$('form-subtitle').value.trim(),category:$('form-category').value,time:Number($('form-time').value),portions:Number($('form-portions').value),unit:$('form-unit').value,ingredients,steps,favorite:old?.favorite||false,updatedAt:Date.now()};
      saveRecipe(recipe);closeDialog('editor-dialog');toast(old?'Rezept aktualisiert.':'Rezept hinzugefügt.');
    });
    document.addEventListener('click',async e=>{
      const close=e.target.closest('[data-close]');if(close) return closeDialog(close.dataset.close);
      const cat=e.target.closest('[data-category]');if(cat){selectedCategory=cat.dataset.category;return renderRecipes();}
      const fav=e.target.closest('[data-fav]');if(fav){const r=recipeById(fav.dataset.fav);if(r)saveRecipe({...r,favorite:!r.favorite,updatedAt:Date.now()});return;}
      const open=e.target.closest('[data-open]');if(open)return openRecipe(open.dataset.open);
      const amount=e.target.closest('[data-amount]');if(amount){const r=recipeById(detailId);const delta=amount.dataset.amount==='plus'?1:-1;detailAmount=Math.min(1000,Math.max(1,detailAmount+delta));if(r)renderDetail();return;}
      const action=e.target.closest('[data-action]');if(action){
        const r=recipeById(detailId);if(!r)return;
        if(action.dataset.action==='ingredients-to-shopping') {
          const factor=detailAmount/(Number(r.portions)||1);
          const existing=new Set(state.shopping.filter(x=>!x.checked).map(x=>x.name.toLocaleLowerCase('de-DE')));
          let added=0;
          (r.ingredients||[]).forEach(line=>{const name=parseIngredient(line,factor);if(!existing.has(name.toLocaleLowerCase('de-DE'))){saveShopping({id:newId(),name,checked:false,createdAt:Date.now()});existing.add(name.toLocaleLowerCase('de-DE'));added++;}});
          toast(added ? `${added} Zutaten auf die Einkaufsliste gesetzt.` : 'Diese Zutaten stehen schon auf der Liste.');
        }
        if(action.dataset.action==='edit-recipe'){closeDialog('recipe-dialog');openEditor(r.id);}
        if(action.dataset.action==='delete-recipe' && confirm(`„${r.title}“ wirklich löschen?`)){deleteRecipe(r.id);closeDialog('recipe-dialog');toast('Rezept gelöscht.');}
        return;
      }
      const del=e.target.closest('[data-delete-item]');if(del)return deleteShopping(del.dataset.deleteItem);
    });
    document.addEventListener('keydown',e=>{if(e.key==='Enter'){const target=e.target.closest('.recipe-picture[data-open]');if(target){e.preventDefault();openRecipe(target.dataset.open);}}});
    $('shopping-list').addEventListener('change',e=>{const id=e.target?.dataset?.check;if(id){const item=state.shopping.find(x=>x.id===id);if(item)saveShopping({...item,checked:e.target.checked});}});
    $('export-button').addEventListener('click',exportJSON);
    $('import-button').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async e=>{await importJSON(e.target.files?.[0]);e.target.value='';});
    $('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('share-link').value);toast('Einladungslink kopiert!');}catch(e){$('share-link').select();toast('Link markieren und kopieren.');}});
    $('join-room-form').addEventListener('submit',e=>{
      e.preventDefault();const value=$('join-room-input').value.trim();
      let code=value;try{code=new URL(value,location.href).searchParams.get('raum')||value;}catch(err){}
      if(!/^[a-f0-9]{32}$/.test(code))return toast('Bitte einen gültigen Einladungslink einfügen.');
      if(code===roomId)return toast('Du bist bereits in diesem Kochbuch.');
      if(!confirm('Zum eingeladenen Kochbuch wechseln? Die bisherigen lokalen Rezepte werden dabei durch den gemeinsamen Raum ersetzt. Sichere sie bei Bedarf vorher über Export.'))return;
      try{localStorage.setItem(ROOM_KEY,code);localStorage.removeItem(STORAGE_KEY);}catch(err){}
      const url=new URL(location.href);url.searchParams.set('raum',code);location.assign(url.toString());
    });
    document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
  }
  async function startCloud() {
    if (!cloudConfigured) return;
    try {
      const version='13.1.0';
      const [{initializeApp},{getAuth,signInAnonymously},{getFirestore,collection,doc,setDoc,deleteDoc,getDocs,onSnapshot}] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
      ]);
      const app=initializeApp(window.COOKBOOK_FIREBASE_CONFIG);
      const auth=getAuth(app);await signInAnonymously(auth);
      const db=getFirestore(app),api={collection,doc,setDoc,deleteDoc,getDocs,onSnapshot};
      const r=collection(db,'rooms',roomId,'recipes'),s=collection(db,'rooms',roomId,'shopping');
      const initial=await getDocs(r);
      if (initial.empty){
        const seed=state.recipes.length?state.recipes:[seedRecipe];
        await Promise.all(seed.map(rec=>setDoc(doc(db,'rooms',roomId,'recipes',rec.id),rec)));
        await Promise.all(state.shopping.map(x=>setDoc(doc(db,'rooms',roomId,'shopping',x.id),x)));
      }
      cloud={db,api};
      onSnapshot(r,snap=>{state.recipes=snap.docs.map(d=>d.data()).filter(x=>typeof x.title==='string'&&Array.isArray(x.ingredients));persistLocal();renderRecipes();renderFavorites();},onCloudError);
      onSnapshot(s,snap=>{state.shopping=snap.docs.map(d=>d.data()).filter(x=>typeof x.name==='string');persistLocal();renderShopping();},onCloudError);
      const url=new URL(location.href);url.searchParams.set('raum',roomId);history.replaceState(null,'',url.pathname+url.search+url.hash);
      renderMore();toast('Gemeinsames Kochbuch ist verbunden!');
    } catch(err) {console.error('Firebase Setup',err);cloud=null;cloudConfigured=false;renderMore();toast('Cloud-Verbindung noch nicht eingerichtet.');}
  }
  renderAll();wireUI();startCloud();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
