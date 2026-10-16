import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSettings,startupError} from '../server.js';

test('startup diagnostics validate settings and never print supplied secrets',()=>{
  const valid={ADMIN_PASSWORD:'test-only-long-password',DATABASE_URL:'postgresql://owner:private-password@localhost/test?sslmode=require'};
  assert.equal(validateSettings(valid),null);
  assert.match(validateSettings({...valid,ADMIN_PASSWORD:'short'}),/too short/);
  assert.match(validateSettings({...valid,DATABASE_URL:''}),/missing/);
  for(const value of ['psql '+valid.DATABASE_URL,'"'+valid.DATABASE_URL+'"','https://example.org',' '+valid.DATABASE_URL])assert.match(validateSettings({...valid,DATABASE_URL:value}),/invalid format/);
  assert.match(startupError({code:'28P01'},'connect'),/authentication failed/);
  assert.match(startupError({code:'42501'},'schema'),/cannot create/);
  for(const stage of ['connect','schema','server']){
    const result=startupError({code:'secret-code',message:valid.DATABASE_URL,stack:valid.ADMIN_PASSWORD},stage);
    assert.ok(!result.includes('private-password')&&!result.includes(valid.ADMIN_PASSWORD)&&!result.includes('secret-code'));
  }
});
