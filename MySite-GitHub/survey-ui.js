'use strict';
(async()=>{
  const button=document.getElementById('openSurvey'), dialog=document.getElementById('surveyDialog');
  const form=document.getElementById('surveyForm'), area=document.getElementById('surveyFields'), status=document.getElementById('surveyStatus'), send=document.getElementById('sendSurvey');
  let config,copy,busy=false,requestId='',lastPayload='';
  const draftKey='together-survey-draft';
  const say=key=>{status.textContent=copy[key];};
  const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
  const answers=()=>config.вопросы.map(q=>{
    const field=document.getElementById('survey-'+q.id);
    return {id:q.id,options:[...field.querySelectorAll('input[data-option]:checked')].map(el=>el.value),text:field.querySelector('textarea')?.value||''};
  });
  function draft(){try{localStorage.setItem(draftKey,JSON.stringify({version:config.version,answers:answers()}));}catch{say('нет_черновика');}}
  function render(){
    let saved;try{saved=JSON.parse(localStorage.getItem(draftKey));}catch{}
    area.replaceChildren();
    for(const [index,q] of config.вопросы.entries()){
      const field=element('fieldset',null,'survey-question');field.id='survey-'+q.id;
      field.append(element('legend',(index+1)+'. '+q.текст));
      if(q.обязательный)field.append(element('p',copy.обязательно,'small-note'));
      const previous=saved?.version===config.version?saved.answers?.find(a=>a.id===q.id):null;
      if(q.тип!=='text'){
        field.append(element('p',copy[q.тип==='multiple'?'несколько':'один'],'small-note'));
        const choices=element('div',null,'survey-choices');
        for(const option of q.варианты){
          const label=element('label',null,'survey-choice'),input=element('input');input.type=q.тип==='multiple'?'checkbox':'radio';input.name=q.id;input.value=option;input.dataset.option='true';input.checked=previous?.options?.includes(option)||false;
          label.append(input,element('span',option));choices.append(label);
        }
        field.append(choices);
      }
      if(q.тип==='text'||q.свой_вариант){
        const label=element('label',q.тип==='text'?copy.текст:copy.свой_вариант);label.htmlFor=field.id+'-text';
        const input=element('textarea');input.id=label.htmlFor;input.rows=3;input.maxLength=1000;input.value=previous?.text||'';input.placeholder=copy.текст;
        if(q.тип==='text'&&q.обязательный)input.required=true;
        if(q.тип==='single'){
          input.addEventListener('input',()=>{if(input.value.trim())field.querySelectorAll('input:checked').forEach(el=>el.checked=false);});
          field.addEventListener('change',e=>{if(e.target.matches('input[data-option]')){input.value='';draft();}});
        }
        field.append(label,input);
      }
      area.append(field);
    }
  }
  try{
    const response=await fetch('/api/survey/config');if(!response.ok)throw Error();config=await response.json();copy=config.тексты;
    document.querySelectorAll('[data-survey-copy]').forEach(el=>el.textContent=copy[el.dataset.surveyCopy]);
    dialog.querySelector('[data-close]').setAttribute('aria-label',copy.закрыть);
    render();button.disabled=false;
  }catch{status.textContent='Не удалось загрузить опросник. Попробуй позже.';button.disabled=false;}
  button.addEventListener('click',async()=>{
    dialog.showModal();
    if(!config){form.hidden=true;return;}
    form.hidden=false;say('загрузка');send.disabled=true;
    try{
      const r=await fetch('/api/survey/config');if(!r.ok)throw Error();const latest=await r.json();
      if(latest.version!==config.version){config=latest;copy=latest.тексты;render();say('обновилось');}
      else status.textContent='';
      const key=window.getSiteInviteKey?.()||'';
      if(!key){say('нет_ссылки');return;}
      const auth=await fetch('/api/status',{headers:{'X-Invite-Key':key},signal:AbortSignal.timeout(90000)});
      if(!auth.ok){say(auth.status===403?'нет_ссылки':'ошибка');return;}
      send.disabled=false;
    }catch{say('ошибка');}
  });
  form.addEventListener('input',draft);form.addEventListener('change',draft);
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!config)return;
    const list=answers();
    const missing=config.вопросы.find((q,i)=>q.обязательный&&!list[i].text.trim()&&!list[i].options.length);
    if(missing){say('заполни');document.getElementById('survey-'+missing.id).querySelector('input,textarea')?.focus();return;}
    if(list.reduce((n,a)=>n+a.text.length+a.options.join('').length,0)>8000){say('слишком_много');return;}
    const payload=JSON.stringify(list);
    if(payload!==lastPayload){requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');lastPayload=payload;}
    busy=true;send.disabled=true;area.disabled=true;say('отправляется');
    try{
      const r=await fetch('/api/survey',{method:'POST',headers:{'Content-Type':'application/json','X-Invite-Key':window.getSiteInviteKey?.()||''},body:JSON.stringify({version:config.version,requestId,answers:list}),signal:AbortSignal.timeout(90000)});
      const data=await r.json();
      if(!r.ok){say(data.error==='changed'?'обновилось':r.status===403?'нет_ссылки':'ошибка');return;}
      if(!data.saved)throw Error();say('успех');form.hidden=true;
      try{localStorage.removeItem(draftKey);}catch{}
    }catch{say('ошибка');}finally{busy=false;send.disabled=false;area.disabled=false;}
  });
})();
