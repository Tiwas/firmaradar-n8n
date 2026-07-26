/**
 * Tester for mottaksverifiseringen i Firmaradar Trigger
 * (nodes/Firmaradar/webhookVerification.ts).
 *
 * Kjøres med Nodes innebygde runner mot kompilert output — `npm run build`
 * først, deretter `npm test` (`node --test tests/`). Ingen ekstra
 * test-avhengigheter, ingen live kall: all input er fixtures.
 */
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
    hasValidSignature,
    isAuthenticDelivery,
} from '../dist/nodes/Firmaradar/webhookVerification.js';

const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/nace_delivery_signed.json', import.meta.url), 'utf-8'),
);

// --- isAuthenticDelivery (Authorization: Bearer) --------------------------

test('uten konfigurert hemmelighet aksepteres alt (opt-in)', () => {
    assert.equal(isAuthenticDelivery(undefined, {}), true);
    assert.equal(isAuthenticDelivery('', { authorization: 'Bearer x' }), true);
});

test('korrekt Bearer aksepteres uavhengig av header-casing', () => {
    assert.equal(isAuthenticDelivery('s3cret', { authorization: 'Bearer s3cret' }), true);
    assert.equal(isAuthenticDelivery('s3cret', { Authorization: 'Bearer s3cret' }), true);
    assert.equal(isAuthenticDelivery('s3cret', { authorization: ' Bearer s3cret ' }), true);
});

test('manglende, malformet eller feil Bearer avvises', () => {
    assert.equal(isAuthenticDelivery('s3cret', {}), false);
    assert.equal(isAuthenticDelivery('s3cret', undefined), false);
    assert.equal(isAuthenticDelivery('s3cret', { authorization: 'Bearer feil' }), false);
    assert.equal(isAuthenticDelivery('s3cret', { authorization: 's3cret' }), false);
    assert.equal(isAuthenticDelivery('s3cret', { authorization: 42 }), false);
});

// --- hasValidSignature (X-Firmaradar-Signature) ----------------------------

test('kryss-språk-fixture: Python-generert signatur validerer i Node', () => {
    // rawBody + signatureHex er generert av Python med backendens eksakte
    // serialisering (json.dumps(..., ensure_ascii=False, sort_keys=True)).
    const headers = { 'x-firmaradar-signature': `sha256=${fixture.signatureHex}` };
    assert.equal(
        hasValidSignature(fixture.signingSecret, Buffer.from(fixture.rawBody, 'utf8'), headers),
        true,
    );
    // Samme body som streng (n8n kan levere rawBody som string)
    assert.equal(hasValidSignature(fixture.signingSecret, fixture.rawBody, headers), true);
});

test('uten konfigurert signerings-hemmelighet aksepteres alt (opt-in)', () => {
    assert.equal(hasValidSignature(undefined, 'x', {}), true);
    assert.equal(hasValidSignature('', 'x', {}), true);
});

test('header-navnet matches case-ufølsomt og prefikset kreves', () => {
    const headers = { 'X-Firmaradar-Signature': `sha256=${fixture.signatureHex}` };
    assert.equal(
        hasValidSignature(fixture.signingSecret, Buffer.from(fixture.rawBody, 'utf8'), headers),
        true,
    );
    assert.equal(
        hasValidSignature(fixture.signingSecret, Buffer.from(fixture.rawBody, 'utf8'), {
            'x-firmaradar-signature': fixture.signatureHex, // mangler "sha256="
        }),
        false,
    );
});

test('manglende signatur-header avvises når hemmelighet er satt (fail closed)', () => {
    assert.equal(hasValidSignature(fixture.signingSecret, fixture.rawBody, {}), false);
    assert.equal(hasValidSignature(fixture.signingSecret, fixture.rawBody, undefined), false);
});

test('manglende rå body avvises når hemmelighet er satt (fail closed)', () => {
    const headers = { 'x-firmaradar-signature': `sha256=${fixture.signatureHex}` };
    assert.equal(hasValidSignature(fixture.signingSecret, undefined, headers), false);
});

test('feil hemmelighet, manipulert body og manipulert signatur avvises', () => {
    const headers = { 'x-firmaradar-signature': `sha256=${fixture.signatureHex}` };
    assert.equal(hasValidSignature('feil-hemmelighet', fixture.rawBody, headers), false);
    assert.equal(
        hasValidSignature(fixture.signingSecret, fixture.rawBody.replace('923609016', '999999999'), headers),
        false,
    );
    const flipped = (fixture.signatureHex[0] === 'a' ? 'b' : 'a') + fixture.signatureHex.slice(1);
    assert.equal(
        hasValidSignature(fixture.signingSecret, fixture.rawBody, {
            'x-firmaradar-signature': `sha256=${flipped}`,
        }),
        false,
    );
});

test('re-serialisert body (JS-stil, uten mellomrom) ville IKKE validert — rå body er kontrakten', () => {
    // Dokumenterer hvorfor noden må bruke req.rawBody: JSON.stringify av
    // samme objekt gir andre bytes enn Pythons json.dumps med separatorer.
    const reserialized = JSON.stringify(JSON.parse(fixture.rawBody));
    assert.notEqual(reserialized, fixture.rawBody);
    const headers = { 'x-firmaradar-signature': `sha256=${fixture.signatureHex}` };
    assert.equal(hasValidSignature(fixture.signingSecret, reserialized, headers), false);
});

test('uppercase hex i header aksepteres (hex er case-ufølsom)', () => {
    const upper = createHmac('sha256', fixture.signingSecret)
        .update(Buffer.from(fixture.rawBody, 'utf8'))
        .digest('hex')
        .toUpperCase();
    assert.equal(
        hasValidSignature(fixture.signingSecret, fixture.rawBody, {
            'x-firmaradar-signature': `sha256=${upper}`,
        }),
        true,
    );
});
