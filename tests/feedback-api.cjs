// Integration test: exercises validation, persistence and authorization with
// disposable accounts, removing every test record when finished.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../apps/api/.env'), quiet: true });
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { Pool } = require('pg');
const { AppModule } = require('../apps/api/dist/app.module.js');
const { PG_POOL, REDIS } = require('../apps/api/dist/database/database.module.js');

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    let app;
    const ids = [randomUUID(), randomUUID()];
    try {
        console.log('Preparing disposable feedback test accounts…');
        await pool.query("INSERT INTO users(id,email,password_hash,first_name,last_name,role) VALUES ($1,$2,'test-only','Feedback','Test','customer'),($3,$4,'test-only','Feedback','Admin','admin')", [ids[0], `feedback-${ids[0]}@example.invalid`, ids[1], `feedback-${ids[1]}@example.invalid`]);
        app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
        app.setGlobalPrefix('v1');
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
        console.log('Checking feedback routes…');
        const server = app.getHttpAdapter().getInstance();
        await server.ready();
        const jwt = new JwtService();
        const token = id => jwt.sign({ sub: id }, { secret: process.env.JWT_SECRET, expiresIn: '5m' });
        const customer = { authorization: `Bearer ${token(ids[0])}` };
        const admin = { authorization: `Bearer ${token(ids[1])}` };
        const valid = { category: 'finding', problem: 'Search results are not relevant', description: 'Please improve the search filters.', rating: 4, images: [] };
        const send = (method, url, payload, headers = customer) => server.inject({ method, url: '/v1' + url, headers, payload });
        assert.equal((await send('POST', '/feedback', valid, {})).statusCode, 401);
        assert.equal((await send('GET', '/admin/feedback')).statusCode, 401);
        for (const invalid of [
            { ...valid, category: 'unknown' },
            { ...valid, category: 'bug' },
            { ...valid, description: '   ' },
            { ...valid, description: 'x'.repeat(501) },
            { ...valid, rating: 6 },
            { ...valid, images: Array(6).fill({}) },
            { ...valid, images: [{ key: 'feedback/another-user/x.png', url: 'https://example.invalid/x.png', contentType: 'image/png', size: 10 }] },
            { ...valid, status: 'resolved' }
        ]) assert.equal((await send('POST', '/feedback', invalid)).statusCode, 400, JSON.stringify(invalid));
        const saved = await send('POST', '/feedback', valid);
        assert.equal(saved.statusCode, 201, saved.body);
        const reference = saved.json().reference;
        const list = await send('GET', '/admin/feedback', undefined, admin);
        assert.equal(list.statusCode, 200);
        const row = list.json().find(item => item.reference === reference);
        assert.ok(row);
        assert.equal(row.description, valid.description);
        assert.equal(row.rating, 4);
        assert.equal(row.status, 'new');
        assert.equal((await send('PATCH', `/admin/feedback/${row.id}`, { status: 'resolved' })).statusCode, 401);
        const updated = await send('PATCH', `/admin/feedback/${row.id}`, { status: 'resolved' }, admin);
        assert.equal(updated.statusCode, 200);
        assert.equal(updated.json().status, 'resolved');
        assert.equal((await send('PATCH', `/admin/feedback/${row.id}`, { status: 'invalid' }, admin)).statusCode, 400);
        const withoutRating = await send('POST', '/feedback', { category: 'other', problem: 'Accessibility', description: 'Keyboard navigation suggestion' });
        assert.equal(withoutRating.statusCode, 201);
        const [{ count }] = (await pool.query('SELECT count(*) FROM site_feedback WHERE user_id = $1', [ids[0]])).rows;
        assert.equal(Number(count), 2);
        console.log('Feedback integration checks passed: validation, optional rating, persistence, admin listing/status, and access controls.');
    } finally {
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
        await pool.end();
        if (app) { await app.get(PG_POOL).end(); app.get(REDIS).disconnect(); await app.close(); }
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
