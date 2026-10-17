import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const consentSource = await readFile(new URL('../js/cookie-consent.js', import.meta.url), 'utf8');
const discoverySource = await readFile(new URL('../js/discovery-engine.js', import.meta.url), 'utf8');
const searchSource = await readFile(new URL('../js/search-results.js', import.meta.url), 'utf8');
const key = 'mpwrCookieConsentV1';
function storage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function environment(initial = {}) {
    const localStorage = storage(initial), sessionStorage = storage();
    const listeners = new Map();
    const window = { location: { hostname: 'localhost' }, addEventListener(type, fn) { const handlers = listeners.get(type) || []; handlers.push(fn); listeners.set(type, handlers); }, dispatchEvent(event) { (listeners.get(event.type) || []).forEach(fn => fn(event)); } };
    const context = vm.createContext({ window, localStorage, sessionStorage, document: { readyState: 'loading', addEventListener() {} }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, location: { pathname: '/index.html', search: '' }, URLSearchParams, crypto: globalThis.crypto, setTimeout, clearTimeout });
    vm.runInContext(consentSource, context);
    return { context, window, localStorage, sessionStorage, consent: window.MPWRCookieConsent };
}
const storedChoice = overrides => JSON.stringify({ version: 1, noticeVersion: "2026-10-17.1", performance: false, functional: false, targeting: false, expiresAt: Date.now() + 60_000, updatedAt: new Date().toISOString(), ...overrides });
const plain = value => JSON.parse(JSON.stringify(value));

test('optional defaults, persistence, expiration and cross-tab revocation', () => {
    const env = environment();
    assert.equal(env.consent.allows('necessary'), true);
    for (const category of ['functional', 'performance', 'targeting', 'unknown']) assert.equal(env.consent.allows(category), false);
    env.consent.save({ functional: true });
    assert.equal(env.consent.allows('functional'), true);
    assert.equal(env.consent.allows('performance'), false);
    assert.equal(environment({ [key]: env.localStorage.getItem(key) }).consent.allows('functional'), true);
    env.localStorage.setItem(key, storedChoice({}));
    env.window.dispatchEvent({ type: 'storage', key });
    assert.equal(env.consent.allows('functional'), false);
    env.localStorage.removeItem(key);
    env.window.dispatchEvent({ type: 'storage', key: null });
    assert.equal(env.consent.allows('functional'), false);
    for (const value of ['invalid-json', storedChoice({ expiresAt: Date.now() - 1, performance: true }), storedChoice({ version: 99, targeting: true }), storedChoice({ performance: 'true' })]) {
        const consent = environment({ [key]: value }).consent;
        assert.equal(consent.allows('performance'), false);
        assert.equal(consent.allows('targeting'), false);
    }
});

test('revoking clears optional browser data while retaining shopping information', () => {
    const item = { id: '10', quantity: 2, selectedOptions: { length: 'Shoulder' }, searchAttribution: { query: 'wig' } };
    const env = environment({ [key]: storedChoice({ performance: true, functional: true, targeting: true }), cart: JSON.stringify([item]), favorites: '[{"id":"10"}]', mpwrProductHistory: '[{"id":"10"}]', mpwrRecentSearches: '["wig"]', mpwrDiscoverySignalsV1: '[{"id":"10"}]', mpwrSearchVisitor: 'visitor-id' });
    env.sessionStorage.setItem('mpwrSearchAttribution', '{"query":"wig"}');
    env.sessionStorage.setItem('mpwrPendingPaymentOrder', 'existing-order');
    env.consent.save({});
    for (const key of ['mpwrProductHistory', 'mpwrRecentSearches', 'mpwrDiscoverySignalsV1', 'mpwrSearchVisitor']) assert.equal(env.localStorage.getItem(key), null);
    assert.equal(env.sessionStorage.getItem('mpwrSearchAttribution'), null);
    assert.equal(env.sessionStorage.getItem('mpwrPendingPaymentOrder'), 'existing-order');
    assert.equal(env.localStorage.getItem('favorites'), '[{"id":"10"}]');
    assert.deepEqual(JSON.parse(env.localStorage.getItem('cart')), [{ id: '10', quantity: 2, selectedOptions: { length: 'Shoulder' } }]);
    assert.equal(item.searchAttribution.query, 'wig');
});

test('failed storage does not report newly granted consent', () => {
    const env = environment();
    env.localStorage.setItem = () => { throw new Error('Storage blocked'); };
    assert.throws(() => env.consent.save({ performance: true }));
    assert.equal(env.consent.allows('performance'), false);
});

test('obsolete notices fail closed and expiry removes optional data in an open page', () => {
    for (const noticeVersion of [undefined, 'old-notice']) {
        const env = environment({ [key]: storedChoice({ noticeVersion, performance: true, functional: true }) });
        assert.equal(env.consent.allows('performance'), false);
        assert.equal(env.consent.allows('functional'), false);
    }
    const env = environment();
    env.consent.save({ functional: true, targeting: true });
    env.localStorage.setItem('mpwrProductHistory', '[{"id":"10"}]');
    env.localStorage.setItem('mpwrDiscoverySignalsV1', '[{"id":"10"}]');
    const future = Date.now() + 200 * 24 * 60 * 60 * 1000;
    vm.runInContext(`Date.now = () => ${future}`, env.context);
    assert.equal(env.consent.allows('functional'), false);
    assert.equal(env.localStorage.getItem('mpwrProductHistory'), null);
    assert.equal(env.localStorage.getItem('mpwrDiscoverySignalsV1'), null);
});

test('recommendation signals require targeting consent', () => {
    const env = environment();
    vm.runInContext(discoverySource, env.context);
    env.window.MPWRDiscovery.record('10', 'wigs', 'view');
    assert.equal(env.localStorage.getItem('mpwrDiscoverySignalsV1'), null);
    assert.equal(env.sessionStorage.getItem('mpwrDiscoverySessionSeed'), null);
    env.consent.save({ targeting: true });
    env.window.MPWRDiscovery.record('10', 'wigs', 'view');
    assert.equal(JSON.parse(env.localStorage.getItem('mpwrDiscoverySignalsV1')).length, 1);
    env.consent.save({});
    env.window.MPWRDiscovery.record('11', 'lashes', 'view');
    assert.equal(env.localStorage.getItem('mpwrDiscoverySignalsV1'), null);
    assert.equal(env.window.MPWRDiscovery.rank([{ id: '10' }, { id: '11' }]).length, 2);
});

test('search events and attribution require performance consent', () => {
    const env = environment();
    const sent = [];
    Object.assign(env.context, { query: 'wigs', correctedQuery: '', searchApiRoot: '/v1', fetch: (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return Promise.resolve({}); } });
    vm.runInContext(searchSource.slice(searchSource.indexOf('function searchVisitorId()'), searchSource.indexOf('function closeProductModal()')), env.context);
    vm.runInContext('recordSearchEvent("search"); rememberSearchAttribution("10");', env.context);
    assert.equal(sent.length, 0);
    assert.equal(env.localStorage.getItem('mpwrSearchVisitor'), null);
    assert.equal(env.sessionStorage.getItem('mpwrSearchAttribution'), null);
    env.consent.save({ performance: true });
    vm.runInContext('recordSearchEvent("search"); rememberSearchAttribution("10");', env.context);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].body.query, 'wigs');
    assert.ok(env.localStorage.getItem('mpwrSearchVisitor'));
    env.consent.save({});
    vm.runInContext('recordSearchEvent("click");', env.context);
    assert.equal(sent.length, 1);
    assert.equal(vm.runInContext('searchAttributionForCart("10")', env.context), null);
});

test('outbound cart/order payloads drop attribution after consent is withdrawn during authentication', async () => {
    const env = environment();
    globalThis.window = env.window;
    const sent = [];
    globalThis.fetch = async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true, status: 200, json: async () => ({ id: 'order-1' }) }; };
    const api = await import('../js/firestore-api.js?cookie-consent-test');
    let releaseAuth;
    const db = { kind: 'customer', auth: { ready: new Promise(resolve => { releaseAuth = resolve; }), currentUser: { uid: 'cookie-test' } } };
    const items = [{ id: '10', quantity: 1, selectedOptions: { length: 'Shoulder' }, searchAttribution: { query: 'wig' } }];
    env.consent.save({ performance: true });
    const pending = api.setDoc(api.doc(db, 'carts', 'cookie-test'), { items });
    env.consent.save({});
    releaseAuth();
    await pending;
    assert.equal(sent[0].body.items[0].searchAttribution, undefined);
    assert.equal(sent[0].body.items[0].selectedOptions.length, 'Shoulder');
    await api.addDoc(api.collection(db, 'orders'), { items });
    assert.equal(sent[1].body.items[0].searchAttribution, undefined);
    env.consent.save({ performance: true });
    await api.setDoc(api.doc(db, 'carts', 'cookie-test'), { items });
    assert.equal(sent[2].body.items[0].searchAttribution.query, 'wig');
    assert.equal(items[0].searchAttribution.query, 'wig');
    delete globalThis.window; delete globalThis.fetch;
});
