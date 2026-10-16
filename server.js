import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, scryptSync, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(String(value)).digest();
const equal = (a,b) => timingSafeEqual(digest(a),digest(b));
export async function initialize(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS site_config (id INTEGER PRIMARY KEY CHECK(id=1), invite TEXT NOT NULL)`);
  await pool.query(`INSERT INTO site_config(id,invite) VALUES(1,$1) ON CONFLICT(id) DO NOTHING`,[randomBytes(32).toString('hex')]);
  await pool.query(`CREATE TABLE IF NOT EXISTS wishes (id INTEGER PRIMARY KEY CHECK(id=1), request_id TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
}

export function createServer({pool,password,secure=true}) {
  if (typeof password !== 'string' || password.length < 16) throw Error('ADMIN_PASSWORD must contain at least 16 characters');
  const salt=randomBytes(32), passwordHash=scryptSync(password,salt,64);
  const sessions=new Map(), attempts=new Map();
  const files = {'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/together.js':'together.js','/text-loader.js':'text-loader.js','/world.svg':'world.svg','/TEXTS.json':'TEXTS.json','/admin':'admin.html','/admin.js':'admin.js','/admin.css':'admin.css','/ADMIN_TEXTS.json':'ADMIN_TEXTS.json'};
  const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml'};
  function reply(res,status,data,type='application/json; charset=utf-8') {
    res.writeHead(status,{'Content-Type':type}); res.end(type.startsWith('application/json') && !Buffer.isBuffer(data) ? JSON.stringify(data) : data);
  }
  async function body(req) {
    if (!(req.headers['content-type']||'').startsWith('application/json')) throw {status:415};
    const chunks=[]; let size=0;
    for await (const chunk of req) { size+=chunk.length; if(size>40000) throw {status:413}; chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw {status:400}; }
  }
  function session(req) {
    const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('owner='))?.slice(6);
    if (!token || (sessions.get(token)||0)<Date.now()) return null;
    return token;
  }
  function cookie(res,token,maxAge) {
    res.setHeader('Set-Cookie',`owner=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`);
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const url=new URL(req.url,'http://localhost'), route=url.pathname;
      if(req.method==='POST' && req.headers['sec-fetch-site']==='cross-site') return reply(res,403,{error:'forbidden'});
      if(route==='/healthz' && req.method==='GET') {await pool.query('SELECT 1');return reply(res,200,{ok:true});}
      if(route==='/api/admin/login' && req.method==='POST') {
        if(req.headers['x-requested-with']!=='site') return reply(res,403,{error:'forbidden'});
        const now=Date.now();
        for(const [key,value] of attempts) if(value.until<now) attempts.delete(key);
        const ip=secure ? (req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim() : req.socket.remoteAddress;
        const bucket=attempts.get(ip)||{count:0,until:now+900000};
        if(bucket.count>=8 || attempts.size>10000) {res.setHeader('Retry-After','900');return reply(res,429,{error:'rate_limit'});}
        bucket.count++;attempts.set(ip,bucket);
        const data=await body(req);
        if(typeof data?.password!=='string'||data.password.length>1024) return reply(res,401,{error:'login'});
        const check=await derive(data.password,salt,64);
        if(!timingSafeEqual(check,passwordHash)) return reply(res,401,{error:'login'});
        attempts.delete(ip);
        for(const [key,expiry] of sessions) if(expiry<now) sessions.delete(key);
        if(sessions.size>=100) sessions.delete(sessions.keys().next().value);
        const token=randomBytes(32).toString('hex'); sessions.set(token,now+7200000);cookie(res,token,7200);
        return reply(res,200,{ok:true});
      }
      if(route.startsWith('/api/admin/')) {
        const token=session(req); if(!token) return reply(res,401,{error:'login'});
        if(route==='/api/admin/logout' && req.method==='POST') {
          if(req.headers['x-requested-with']!=='site') return reply(res,403,{error:'forbidden'});
          sessions.delete(token);cookie(res,'',0);return reply(res,200,{ok:true});
        }
        if(req.method!=='GET') return reply(res,405,{error:'method'});
        const {rows}=await pool.query('SELECT body,created_at FROM wishes WHERE id=1');
        if(route==='/api/admin/wishes.txt') {
          if(!rows.length)return reply(res,404,{error:'empty'});
          res.setHeader('Content-Disposition','attachment; filename="wishes.txt"');
          return reply(res,200,'\uFEFF'+new Date(rows[0].created_at).toISOString()+'\r\n\r\n'+rows[0].body,'text/plain; charset=utf-8');
        }
        if(route==='/api/admin/status') {
          const config=await pool.query('SELECT invite FROM site_config WHERE id=1');
          return reply(res,200,{invite:config.rows[0].invite,wishes:rows[0]||null});
        }
        return reply(res,404,{error:'not_found'});
      }
      if(route==='/api/status'||route==='/api/wishes') {
        const config=await pool.query('SELECT invite FROM site_config WHERE id=1');
        if(!equal(req.headers['x-invite-key']||'',config.rows[0].invite))return reply(res,403,{error:'invite'});
        if(route==='/api/status'&&req.method==='GET') {
          const result=await pool.query('SELECT id FROM wishes WHERE id=1');return reply(res,200,{submitted:!!result.rows.length});
        }
        if(route==='/api/wishes'&&req.method==='POST') {
          const data=await body(req);
          if(typeof data?.wishes!=='string'||!data.wishes.trim()||data.wishes.length>8000||typeof data.requestId!=='string'||!/^[a-f0-9-]{32,36}$/.test(data.requestId))return reply(res,400,{error:'invalid'});
          await pool.query('INSERT INTO wishes(id,request_id,body) VALUES(1,$1,$2) ON CONFLICT(id) DO NOTHING',[data.requestId,data.wishes.trim()]);
          const existing=await pool.query('SELECT request_id,body FROM wishes WHERE id=1');
          if(existing.rows[0].request_id===data.requestId && existing.rows[0].body===data.wishes.trim())return reply(res,200,{saved:true});
          return reply(res,409,{error:'submitted'});
        }
        return reply(res,405,{error:'method'});
      }
      if(req.method==='GET' && files[route]) {
        const name=files[route];const content=await readFile(new URL('./MySite-GitHub/'+name,import.meta.url));
        return reply(res,200,content,mime[name.split('.').at(-1)]);
      }
      return reply(res,404,{error:'not_found'});
    } catch(error) {
      if(!res.headersSent) reply(res,error.status||503,{error:error.status?'invalid_request':'temporarily_unavailable'});
      else res.end();
    }
  });
  server.requestTimeout=20000;server.headersTimeout=15000;
  return server;
}

export function validateSettings(env) {
  if(!env.ADMIN_PASSWORD) return 'CONFIG: ADMIN_PASSWORD is missing. Add it in Render Environment.';
  if(env.ADMIN_PASSWORD.length<16) return 'CONFIG: ADMIN_PASSWORD is too short. Use at least 16 characters, save and redeploy.';
  if(!env.DATABASE_URL) return 'CONFIG: DATABASE_URL is missing. Paste the Neon connection string in Render Environment.';
  try {
    const url=new URL(env.DATABASE_URL);
    if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||url.pathname.length<2||env.DATABASE_URL!==env.DATABASE_URL.trim())throw Error();
  } catch {return 'CONFIG: DATABASE_URL has an invalid format. Copy only the full postgresql:// connection string, without psql, quotes or spaces.';}
  return null;
}

export function startupError(error,stage) {
  const known={
    '28P01':'DATABASE: Password authentication failed. Copy a fresh connection string from Neon into DATABASE_URL.',
    '28000':'DATABASE: Authentication rejected. Check the Neon connection string and database role.',
    '3D000':'DATABASE: Database does not exist. Copy the connection string for the correct Neon database.',
    '42501':'DATABASE: This database role cannot create or access the tables. Use the database owner connection string.',
    'ENOTFOUND':'DATABASE: Hostname not found. Check the Neon hostname in DATABASE_URL.',
    'ECONNREFUSED':'DATABASE: Connection refused. Check that the Neon project is available.',
    'ETIMEDOUT':'DATABASE: Connection timed out. Check that the Neon project is available and retry.',
    'ECONNRESET':'DATABASE: Connection was interrupted. Retry the deploy.',
    'CERT_HAS_EXPIRED':'DATABASE: TLS certificate expired. Check the database endpoint; do not disable TLS verification.',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE':'DATABASE: TLS certificate verification failed. Check the database endpoint; do not disable verification.'
  };
  return known[error?.code] || (stage==='schema'
    ? 'DATABASE: Connected, but preparing the tables failed. Check database role permissions and existing site_config/wishes tables.'
    : stage==='connect' ? 'DATABASE: Could not establish a connection. Check Neon project status and copy a fresh connection string; retry after the database wakes up.'
    : 'SERVER: Startup failed after database initialization. Check the Render runtime settings.');
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const settingsError=validateSettings(process.env);
  if(settingsError){console.error(settingsError);process.exit(1);}
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:30000,idleTimeoutMillis:30000,statement_timeout:10000});
  pool.on('error',()=>console.error('Database connection interrupted.'));
  let stage='connect';
  try {
    console.log('Configuration validated. Connecting to database...');
    await pool.query('SELECT 1');
    stage='schema';console.log('Database connected. Preparing tables...');
    await initialize(pool);
    stage='server';
    const server=createServer({pool,password:process.env.ADMIN_PASSWORD,secure:process.env.NODE_ENV!=='development'});
    server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Website ready. Owner page: /admin'));
    process.on('SIGTERM',()=>server.close(()=>pool.end().finally(()=>process.exit(0))));
  } catch(error) {console.error(startupError(error,stage));await pool.end();process.exit(1);}
}
