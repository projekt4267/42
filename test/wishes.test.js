import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createServer,initialize} from '../server.js';

test('private invitation, one submission, owner login/download and persistence',async()=>{
  const pool=new PGlite();await initialize(pool);
  let server=createServer({pool,password:'test-password-only-12345',secure:false});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let base='http://127.0.0.1:'+server.address().port;
  const get=(url,headers={})=>fetch(base+url,{headers});
  const post=(url,data,headers={})=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  try {
    assert.equal((await get('/')).status,200);
    assert.ok((await (await get('/TEXTS.json')).json()).желания);
    for(const url of ['/server.js','/.env','/package.json','/api/admin/status','/api/admin/wishes.txt','/api/status'])assert.ok((await get(url)).status>=400,url);
    assert.equal((await post('/api/admin/login',{password:'wrong'},{'X-Requested-With':'site'})).status,401);
    assert.equal((await post('/api/admin/login',{password:'test-password-only-12345'})).status,403);
    const login=await post('/api/admin/login',{password:'test-password-only-12345'},{'X-Requested-With':'site'});assert.equal(login.status,200);
    assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const admin=await (await get('/api/admin/status',{cookie})).json();assert.equal(admin.wishes,null);assert.equal(admin.invite.length,64);
    const headers={'X-Invite-Key':admin.invite};
    assert.equal((await (await get('/api/status',headers)).json()).submitted,false);
    assert.equal((await post('/api/wishes',{wishes:'test',requestId:'a'.repeat(32)})).status,403);
    assert.equal((await post('/api/wishes',{wishes:' ',requestId:'a'.repeat(32)},headers)).status,400);
    assert.equal((await post('/api/wishes',{wishes:'a'.repeat(8001),requestId:'a'.repeat(32)},headers)).status,400);
    const wishes='Обняться ♡\n<script>alert(1)</script>';
    const results=await Promise.all(['a','b'].map(id=>post('/api/wishes',{wishes,requestId:id.repeat(32)},headers)));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const saved=(await pool.query('SELECT request_id FROM wishes WHERE id=1')).rows[0];
    assert.equal((await post('/api/wishes',{wishes,requestId:saved.request_id},headers)).status,200);
    assert.equal((await post('/api/wishes',{wishes:'changed',requestId:saved.request_id},headers)).status,409);
    assert.equal((await (await get('/api/status',headers)).json()).submitted,true);
    const download=await get('/api/admin/wishes.txt',{cookie});assert.equal(download.status,200);assert.match(download.headers.get('content-type'),/text\/plain/);assert.ok((await download.text()).includes(wishes));
    assert.equal((await post('/api/admin/logout',{}, {cookie,'X-Requested-With':'site','Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await post('/api/admin/logout',{}, {cookie,'X-Requested-With':'site'})).status,200);
    assert.equal((await get('/api/admin/status',{cookie})).status,401);
    await new Promise(resolve=>server.close(resolve));await initialize(pool);
    server=createServer({pool,password:'test-password-only-12345',secure:false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
    assert.equal((await (await get('/api/status',headers)).json()).submitted,true);
    for(let i=0;i<8;i++)assert.equal((await post('/api/admin/login',{password:'wrong'},{'X-Requested-With':'site'})).status,401);
    assert.equal((await post('/api/admin/login',{password:'wrong'},{'X-Requested-With':'site'})).status,429);
  }finally{await new Promise(resolve=>server.close(resolve));await pool.close();}
});
