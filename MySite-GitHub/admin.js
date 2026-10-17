'use strict';
(async()=>{
  const $=id=>document.getElementById(id);
  let texts;
  try {const r=await fetch('/ADMIN_TEXTS.json');if(!r.ok)throw Error();texts=await r.json();}
  catch {$('status').textContent='Не удалось загрузить тексты кабинета. Обнови страницу.';return;}
  document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=texts[el.dataset.copy]);
  const status=key=>{$('status').textContent=texts[key]||'';};
  function locked(){ $('panel').hidden=true;$('login').hidden=false;$('invite').value='';$('wishes').textContent='';$('date').textContent='';$('download').hidden=true;$('surveyResults').replaceChildren();$('surveyDownload').hidden=true; }
  async function refreshSurvey(){
    const [configResponse,answerResponse]=await Promise.all([fetch('/api/survey/config'),fetch('/api/admin/surveys')]);
    if(answerResponse.status===401){locked();status('вход_нужен');return;}
    if(!configResponse.ok||!answerResponse.ok)throw Error();
    const copy=(await configResponse.json()).тексты, {surveys}=await answerResponse.json();
    $('surveyAdminTitle').textContent=copy.кабинет_заголовок;
    $('surveyDownload').textContent=copy.кабинет_скачать;$('surveyDownload').hidden=!surveys.length;
    $('surveyResults').replaceChildren();
    if(!surveys.length){$('surveyResults').textContent=copy.кабинет_пусто;return;}
    for(const survey of surveys){
      const group=document.createElement('section'),date=document.createElement('p');date.textContent=copy.кабинет_дата+new Date(survey.created_at).toLocaleString('ru-RU');group.append(date);
      for(const answer of survey.answers){const heading=document.createElement('strong'),value=document.createElement('pre');heading.textContent=answer.question;value.textContent=answer.answer||copy.кабинет_пропуск;group.append(heading,value);}
      group.append(document.createElement('hr'));$('surveyResults').append(group);
    }
  }
  async function refresh(){
    try {
      const r=await fetch('/api/admin/status');
      if(r.status===401){locked();status('вход_нужен');return;}
      if(!r.ok)throw Error();const data=await r.json();
      $('login').hidden=true;$('panel').hidden=false;
      $('invite').value=location.origin+'/#key='+encodeURIComponent(data.invite);
      $('wishes').textContent=data.wishes ? data.wishes.body : texts.ожидание;
      $('date').textContent=data.wishes ? texts.дата+new Date(data.wishes.created_at).toLocaleString('ru-RU') : '';
      $('download').hidden=!data.wishes;status(data.wishes?'сохранено':'');
      await refreshSurvey();
    } catch {status('нет_связи');}
  }
  $('login').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try {
      const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'site'},body:JSON.stringify({password:$('password').value})});
      $('password').value='';
      if(!r.ok){status(r.status===429?'лимит':r.status===401?'пароль_неверный':'нет_связи');return;}
      await refresh();
    }catch{status('нет_связи');}finally{button.disabled=false;}
  });
  $('refresh').addEventListener('click',refresh);
  $('copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('invite').value);status('скопировано');}
    catch{$('invite').select();status('копировать_вручную');}
  });
  $('logout').addEventListener('click',async()=>{
    try{const r=await fetch('/api/admin/logout',{method:'POST',headers:{'X-Requested-With':'site'}});if(!r.ok)throw Error();locked();status('вход_нужен');}catch{status('нет_связи');}
  });
  await refresh();
})();
