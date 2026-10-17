// Disposable integration records only. No emails, payments or outside requests.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../apps/api/.env'), quiet: true });
process.env.RESEND_API_KEY = '';
process.env.NODE_ENV = 'test';
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const cookie = require('@fastify/cookie');
const { Pool } = require('pg');
const { AppModule } = require('../apps/api/dist/app.module.js');
const { PG_POOL, REDIS } = require('../apps/api/dist/database/database.module.js');
const { TERMS_VERSION } = require('../apps/api/dist/common/legal-policy.js');
async function main() {
 const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
 const ids = [randomUUID(), randomUUID(), randomUUID()];
 const product = randomUUID(); let app;
 try {
  await pool.query("INSERT INTO users(id,email,password_hash,first_name,last_name,role) VALUES ($1,$2,'test-only','Legal','Customer','customer'),($3,$4,'test-only','Legal','Admin','admin'),($5,$6,'test-only','Legal','Other','customer')", [ids[0],`legal-${ids[0]}@example.invalid`,ids[1],`legal-${ids[1]}@example.invalid`,ids[2],`legal-${ids[2]}@example.invalid`]);
  await pool.query("INSERT INTO products(id,legacy_id,title,slug,price) VALUES ($1::uuid,$1::text,'Legal Test Product',$1::text,1000)", [product]);
  app = await NestFactory.create(AppModule,new FastifyAdapter(),{logger:false});
  await app.register(cookie);
  app.setGlobalPrefix('v1'); app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  await app.init(); const server=app.getHttpAdapter().getInstance(); await server.ready();
  const jwt=new JwtService();
  const headers = index => ({authorization:`Bearer ${jwt.sign({sub:ids[index]},{secret:process.env.JWT_SECRET,expiresIn:'5m'})}`});
  const send=(method,path,payload,auth=headers(0))=>server.inject({method,url:'/v1'+path,payload,headers:auth});
  const register={email:`legal-register-${product}@example.invalid`,password:randomUUID(),firstName:'Test',lastName:'Only'};
  for(const legal of [{},{termsAccepted:false,termsVersion:TERMS_VERSION},{termsAccepted:true,termsVersion:'old'}]) assert.equal((await send('POST','/auth/register',{...register,...legal},{})).statusCode,400);
  const registered=await send('POST','/auth/register',{...register,termsAccepted:true,termsVersion:TERMS_VERSION},{});
  assert.equal(registered.statusCode,201,registered.body);ids.push(registered.json().user.id);
  const evidence=(await pool.query('SELECT legacy_data FROM users WHERE id=$1',[ids.at(-1)])).rows[0].legacy_data.policyAcceptance;
  assert.equal(evidence.termsVersion,TERMS_VERSION);assert.equal(evidence.source,'registration');assert.ok(Date.parse(evidence.acceptedAt));
  const order={items:[{id:product,quantity:1}],customer:{firstName:'Test',lastName:'Only',email:register.email,phone:'test'},delivery:{district:'Kampala',policyAcceptance:{termsVersion:'forged'}},deliveryFee:0};
  assert.equal((await send('POST','/orders/legacy',order)).statusCode,400);
  assert.equal((await send('POST','/orders',{quoteId:randomUUID(),firstName:'Test',lastName:'Only',email:register.email,phone:'test'})).statusCode,400);
  const savedOrder=await send('POST','/orders/legacy',{...order,termsAccepted:true,termsVersion:TERMS_VERSION});
  assert.equal(savedOrder.statusCode,201,savedOrder.body);assert.equal(savedOrder.json().delivery.policyAcceptance.termsVersion,TERMS_VERSION);assert.equal(savedOrder.json().delivery.policyAcceptance.source,'checkout');
  assert.equal((await send('POST','/privacy-requests',{kind:'access'},{})).statusCode,401);
  assert.equal((await send('POST','/privacy-requests',{kind:'invalid'})).statusCode,400);
  assert.equal((await send('POST','/privacy-requests',{kind:'correction',details:'x'.repeat(2001)})).statusCode,400);
  const receipt=await send('POST','/privacy-requests',{kind:'access',details:'Test access request'});assert.equal(receipt.statusCode,201,receipt.body);
  const row=receipt.json();
  const duplicate=await send('POST','/privacy-requests',{kind:'access'});assert.equal(duplicate.json().reference,row.reference);
  assert.equal((await send('GET','/privacy-requests',undefined,headers(2))).json().length,0);
  assert.equal((await send('GET','/admin/privacy-requests')).statusCode,401);
  assert.equal((await send('PATCH',`/admin/privacy-requests/${row.id}`,{status:'closed',response:'Completed'},headers(2))).statusCode,401);
  assert.equal((await send('PATCH',`/admin/privacy-requests/${row.id}`,{status:'closed',response:' '},headers(1))).statusCode,400);
  assert.equal((await send('PATCH',`/admin/privacy-requests/${row.id}`,{status:'closed',response:'Test completed; no external action taken.'},headers(1))).statusCode,200);
  assert.equal((await send('GET','/privacy-requests')).json()[0].response,'Test completed; no external action taken.');
  // Account with a real FK-linked order gets a receipt, not an FK error or silent erasure.
  const deletion=await send('DELETE','/auth/account');assert.equal(deletion.statusCode,200,deletion.body);assert.equal(deletion.json().kind,'deletion');
  assert.equal((await pool.query('SELECT count(*) FROM orders WHERE user_id=$1',[ids[0]])).rows[0].count,'1');
  assert.equal((await send('GET','/auth/me')).statusCode,200);
  const profile=await send('PATCH','/profile',{firstName:'Updated'});assert.equal(profile.statusCode,200,profile.body);
  assert.equal(profile.json().passwordHash,undefined);assert.equal(profile.json().legacyData,undefined);
  assert.equal((await pool.query('SELECT count(*) FROM privacy_requests WHERE user_id=$1',[ids[0]])).rows[0].count,'2');
  console.log('Legal readiness API checks passed: enforced/versioned acceptance, persisted receipts, privacy authorization/idempotency/outcomes, deletion with orders, and no password hash in profile responses.');
 } finally {
  await pool.query('DELETE FROM orders WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM products WHERE id=$1',[product]);
  await pool.end();
  if(app){await app.get(PG_POOL).end();app.get(REDIS).disconnect();await app.close();}
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
