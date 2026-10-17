import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function loadSurvey(){
  const config=JSON.parse(readFileSync(new URL('./MySite-GitHub/QUESTIONS.json',import.meta.url),'utf8'));
  const questions=config.вопросы;
  if(!Array.isArray(questions)||!questions.length||questions.length>20)throw Error('Invalid survey questions');
  const ids=new Set();
  for(const q of questions){
    if(!/^[a-z0-9_-]{1,40}$/.test(q.id)||ids.has(q.id)||typeof q.текст!=='string'||!q.текст.trim()||!['text','single','multiple'].includes(q.тип))throw Error('Invalid survey question');
    ids.add(q.id);
    if(q.тип!=='text'&&(!Array.isArray(q.варианты)||!q.варианты.length||q.варианты.length>50||new Set(q.варианты).size!==q.варианты.length||q.варианты.some(x=>typeof x!=='string'||!x.trim())))throw Error('Invalid survey options');
  }
  return {...config,version:createHash('sha256').update(JSON.stringify(questions)).digest('hex')};
}
export function validateSurvey(data,config){
  if(data?.version!==config.version)return {error:'changed',status:409};
  if(!/^[a-f0-9]{32}$/.test(data?.requestId)||!Array.isArray(data.answers)||data.answers.length!==config.вопросы.length)return {error:'invalid',status:400};
  const result=[];let size=0;
  for(const q of config.вопросы){
    const a=data.answers.find(x=>x?.id===q.id);
    if(!a||typeof a.text!=='string'||a.text.length>1000||!Array.isArray(a.options))return {error:'invalid',status:400};
    const text=a.text.trim(), options=a.options;
    if(new Set(options).size!==options.length||options.some(x=>typeof x!=='string'||!q.варианты?.includes(x)))return {error:'invalid',status:400};
    if(q.тип==='text'&&options.length || q.тип==='single'&&options.length+(text?1:0)>1 || q.тип!=='text'&&text&&!q.свой_вариант)return {error:'invalid',status:400};
    if(q.обязательный&&!text&&!options.length)return {error:'invalid',status:400};
    size+=text.length+options.join('').length;
    result.push({question:q.текст,answer:[...options,...(text?[text]:[])].join(', ')});
  }
  if(size>8000)return {error:'invalid',status:400};
  return {body:JSON.stringify(result)};
}
