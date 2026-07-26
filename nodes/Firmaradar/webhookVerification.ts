import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Rene verifiserings-helpers for innkommende webhook-leveranser fra
 * Firmaradar. Holdes fri for n8n-imports så de er trivielt testbare
 * (samme mønster som Activepieces-piecens `common/parse.ts`).
 */

/**
 * Konstant-tid-sammenligning av to strenger (unngår timing-lekkasje av
 * hemmeligheten). Ulik lengde → false uten videre sammenligning.
 */
function constantTimeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        return false;
    }
    return timingSafeEqual(bufA, bufB);
}

/**
 * Slå opp en header case-ufølsomt (n8n/express leverer lowercase, men
 * vi antar det ikke). Array-verdier reduseres til første element.
 */
function headerValue(
    headers: Record<string, unknown> | undefined,
    name: string,
): string | undefined {
    for (const [key, value] of Object.entries(headers ?? {})) {
        if (key.toLowerCase() === name) {
            const single = Array.isArray(value) ? value[0] : value;
            return typeof single === 'string' ? single : undefined;
        }
    }
    return undefined;
}

/**
 * Verifiser leveransens `Authorization: Bearer` mot konfigurert
 * leverings-hemmelighet. Firmaradar sender hemmeligheten tilbake som
 * `Authorization: Bearer <secret>` på hver leveranse — mismatch betyr
 * at kallet ikke kommer fra Firmaradar. Ingen hemmelighet konfigurert
 * → aksepter (verifisering er opt-in).
 */
export function isAuthenticDelivery(
    deliverySecret: string | undefined,
    headers: Record<string, unknown> | undefined,
): boolean {
    if (!deliverySecret) {
        return true;
    }
    const auth = headerValue(headers, 'authorization');
    return auth !== undefined && constantTimeEquals(auth.trim(), `Bearer ${deliverySecret}`);
}

/**
 * Verifiser `X-Firmaradar-Signature: sha256=<hex>` — HMAC-SHA256 med
 * signerings-hemmeligheten over den RÅ request-bodyen. Serveren signerer
 * de eksakte bytene den sender (JSON med sorterte nøkler), så bodyen må
 * ikke re-serialiseres før verifisering. Ingen hemmelighet konfigurert
 * → aksepter. Hemmelighet konfigurert men header eller rå body mangler
 * → avvis (fail closed — ellers kunne en angriper bare utelate headeren).
 */
export function hasValidSignature(
    signingSecret: string | undefined,
    rawBody: Buffer | string | undefined,
    headers: Record<string, unknown> | undefined,
): boolean {
    if (!signingSecret) {
        return true;
    }
    if (rawBody === undefined || rawBody === null) {
        return false;
    }
    const header = headerValue(headers, 'x-firmaradar-signature');
    if (header === undefined) {
        return false;
    }
    const match = /^sha256=([0-9a-fA-F]+)$/.exec(header.trim());
    if (match === null) {
        return false;
    }
    const expected = createHmac('sha256', signingSecret)
        .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
        .digest('hex');
    return constantTimeEquals(match[1].toLowerCase(), expected);
}
