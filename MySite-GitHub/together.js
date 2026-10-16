'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch {} }
  };
  const messages = SiteText.list('поддержка.фразы');
  let lastMessage = -1;
  function differentIndex(length, last) { let n; do { n = Math.floor(Math.random() * length); } while (length > 1 && n === last); return n; }
  $('comfortBtn').addEventListener('click', () => {
    lastMessage = differentIndex(messages.length, lastMessage);
    $('comfortText').textContent = messages[lastMessage];
    $('comfortBtn').querySelector('[data-text]').textContent = SiteText.get('поддержка.кнопка_ещё');
  });

  let person = storage.get('together-person') === 'lesha' ? 'lesha' : 'anya';
  let lastAction = -1;
  function syncPerson() {
    document.querySelectorAll('[data-person]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.person === person)));
  }
  document.querySelectorAll('[data-person]').forEach(b => b.addEventListener('click', () => {
    person = b.dataset.person; storage.set('together-person', person); syncPerson();
    $('diceResult').textContent = SiteText.get('кубик.после_смены_участника'); lastAction = -1;
  }));
  syncPerson();
  $('rollDice').addEventListener('click', () => {
    const actions = [...SiteText.list('кубик.общие'), ...SiteText.list(person === 'anya' ? 'кубик.для_ани' : 'кубик.для_лёши')];
    lastAction = differentIndex(actions.length,lastAction);
    $('diceResult').textContent = actions[lastAction];
    $('diceFace').textContent = ['⚀','⚁','⚂','⚃','⚄','⚅'][Math.floor(Math.random()*6)];
    $('diceFace').classList.remove('rolling');
    void $('diceFace').offsetWidth;
    $('diceFace').classList.add('rolling');
  });

  // Dialogs retain keyboard focus and close with Escape or the close button.
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  });

  const draftKey = 'together-wishes-draft';
  const form = $('wishesForm');
  const text = $('wishesText');
  let confirming = false, sending = false, statusKnown = false, submitted = false;
  text.value = (storage.get(draftKey) || '').slice(0,8000);
  function updateLength() { $('wishLength').textContent = SiteText.get('желания.счётчик_символов', {count:text.value.length}); }
  updateLength();
  function editMode() {
    confirming = false; $('wishConfirm').hidden = true; text.readOnly = false;
    $('submitWishes').textContent = SiteText.get('желания.кнопка_сохранить');
  }
  text.addEventListener('input', () => {
    updateLength();
    if (!storage.set(draftKey,text.value)) $('wishStatus').textContent = SiteText.get('желания.ошибка_черновика');
  });
  $('editWishes').addEventListener('click', () => { if (!sending) { editMode(); text.focus(); } });
  function refreshStatus() {
    statusKnown = false;
    $('submitWishes').disabled = true;
    $('wishStatus').textContent = SiteText.get('желания.нет_личной_ссылки');
  }
  $('openWishes').addEventListener('click', () => {
    $('wishesDialog').showModal();
    if (!sending) refreshStatus();
  });
  form.addEventListener('submit', event => event.preventDefault());

  const cities = [
    {name:SiteText.get('карта.город_лёши'),lat:59.37722,lon:28.19028},
    {name:SiteText.get('карта.город_ани'),lat:45.34278,lon:34.92833}
  ];
  function haversine(a,b) {
    const rad = d => d*Math.PI/180;
    const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  $('distanceKm').textContent = SiteText.get('карта.километры', {km:Math.round(haversine(...cities)).toLocaleString('ru-RU')});
  let zoomed = window.matchMedia('(max-width:700px)').matches;
  const svgNS = 'http://www.w3.org/2000/svg';
  function drawMap() {
    const [a,b] = cities.map(c => ({x:(c.lon+180)*2,y:(90-c.lat)*2}));
    $('distanceMap').setAttribute('viewBox', zoomed ? '370 30 115 80' : '0 0 720 360');
    $('connectionLine').setAttribute('d',`M ${a.x} ${a.y} Q ${a.x+25} ${(a.y+b.y)/2} ${b.x} ${b.y}`);
    $('connectionLine').setAttribute('stroke-width',zoomed ? '.6' : '2');
    $('connectionLine').setAttribute('stroke-dasharray',zoomed ? '1.5 1.2' : '4 3');
    $('cityMarkers').replaceChildren();
    cities.forEach((city,i) => {
      const p = [a,b][i];
      const dot = document.createElementNS(svgNS,'circle');
      for (const [k,v] of Object.entries({cx:p.x,cy:p.y,r:zoomed?1.4:3.4,fill:'#a23867',stroke:'#fff','stroke-width':zoomed?.6:1.5})) dot.setAttribute(k,v);
      const label = document.createElementNS(svgNS,'text');
      for (const [k,v] of Object.entries({x:p.x+(zoomed?3:7),y:p.y+(zoomed?1:3),fill:'#64334b','font-size':zoomed?(window.innerWidth <= 700 ? 6 : 3.8):11,'font-family':'Segoe UI, sans-serif','font-weight':'600'})) label.setAttribute(k,v);
      label.textContent = city.name; $('cityMarkers').append(dot,label);
    });
    $('mapZoom').textContent = zoomed ? SiteText.get('карта.весь_мир') : SiteText.get('карта.приблизить');
  }
  drawMap();
  $('openMap').addEventListener('click', () => $('mapDialog').showModal());
  $('mapZoom').addEventListener('click', () => { zoomed = !zoomed; drawMap(); });

  let caught = 0, playing = false;
  let rounds = Math.max(0, Number(storage.get('together-rounds')) || 0);
  function updateRounds() { if (rounds) $('gameBest').textContent = SiteText.get('игра.собрано_букетов', {rounds}); }
  updateRounds();
  $('startGame').addEventListener('click', () => {
    caught = 0; playing = true;
    document.body.classList.add('playing'); $('home').inert = true;
    $('gameHud').hidden = false; $('catchHeart').hidden = false;
    $('gameProgress').textContent = SiteText.get('игра.счётчик', {count:0});
    $('gameHint').textContent = SiteText.get('игра.подсказка');
    window.heartGame.next(); $('stopGame').focus();
  });
  function stopGame() {
    playing = false; window.heartGame.stop();
    document.body.classList.remove('playing'); $('home').inert = false;
    $('gameHud').hidden = true; $('catchHeart').hidden = true; $('startGame').focus();
  }
  $('stopGame').addEventListener('click',stopGame);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && playing) stopGame(); });
  $('catchHeart').addEventListener('click', () => {
    if (!playing || caught >= 5) return;
    caught++; $('gameProgress').textContent = SiteText.get('игра.счётчик', {count:caught});
    if (caught === 5) {
      rounds++; storage.set('together-rounds',String(rounds)); updateRounds();
      $('gameProgress').textContent = SiteText.get('игра.победа');
      $('gameHint').textContent = SiteText.get('игра.подпись_победы');
      $('catchHeart').hidden = true; window.heartGame.stop(); $('stopGame').focus();
    } else window.heartGame.next();
  });
})();
