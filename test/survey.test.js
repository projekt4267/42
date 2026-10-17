import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {initialize,createServer} from '../server.js';
import {loadSurvey,validateSurvey} from '../survey.js';

test('survey validates configured choices and stores private immutable question snapshots',async()=>{
  const pool=new PGlite();await initialize(pool);
  const server=createServer({pool,password:'test-survey-password-123',secure:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  try{
    const config=await (await fetch(base+'/api/survey/config')).json();assert.equal(config.вопросы.length,5);
    const data={version:config.version,requestId:'1'.repeat(32),answers:config.вопросы.map(q=>({id:q.id,options:q.тип==='text'?[]:[q.варианты[0]],text:q.тип==='text'?'Пример ♡ <script>': ''}))};
    assert.equal((await post('/api/survey',data)).status,403);
    assert.equal((await fetch(base+'/api/admin/surveys')).status,401);
    assert.equal((await fetch(base+'/api/admin/surveys.txt')).status,401);
    const key=(await pool.query('SELECT invite FROM site_config WHERE id=1')).rows[0].invite, headers={'X-Invite-Key':key};
    assert.equal((await post('/api/survey',{...data,version:'old'},headers)).status,409);
    const bad=structuredClone(data);bad.answers[0].options=['not a configured flower'];assert.equal((await post('/api/survey',bad,headers)).status,400);
    const empty=structuredClone(data);empty.answers[1].text='';assert.equal(validateSurvey(empty,loadSurvey()).status,400);
    assert.equal((await post('/api/survey',data,headers)).status,200);
    assert.equal((await post('/api/survey',data,headers)).status,200);
    assert.equal((await pool.query('SELECT * FROM survey_responses')).rows.length,1);
    const updated=structuredClone(data);updated.answers[1].text='Новая мечта';assert.equal((await post('/api/survey',updated,headers)).status,409);
    updated.requestId='2'.repeat(32);assert.equal((await post('/api/survey',updated,headers)).status,200);
    assert.equal((await (await fetch(base+'/api/status',{headers})).json()).submitted,false);
    const login=await post('/api/admin/login',{password:'test-survey-password-123'},{'X-Requested-With':'site'});const cookie=login.headers.get('set-cookie').split(';')[0];
    const response=await fetch(base+'/api/admin/surveys',{headers:{cookie}});const saved=await response.json();assert.equal(saved.surveys.length,2);assert.equal(saved.surveys[0].answers[0].question,config.вопросы[0].текст);
    const download=await fetch(base+'/api/admin/surveys.txt',{headers:{cookie}});assert.match(download.headers.get('content-type'),/text\/plain/);assert.ok((await download.text()).includes('Новая мечта'));
    await initialize(pool);assert.equal((await pool.query('SELECT * FROM survey_responses')).rows.length,2);
  }finally{await new Promise(r=>server.close(r));await pool.close();}
});
