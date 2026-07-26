import {
    IDataObject,
    IHookFunctions,
    INodeType,
    INodeTypeDescription,
    IWebhookFunctions,
    IWebhookResponseData,
    JsonObject,
    NodeApiError,
} from 'n8n-workflow';

import { hasValidSignature, isAuthenticDelivery } from './webhookVerification';

/**
 * Firmaradar — Hendelses-trigger (instant / webhook)
 *
 * Starter en arbeidsflyt når Firmaradar registrerer en hendelse:
 *   - watchCompany: ett orgnr under firmaovervåkning (kunngjøring, status-,
 *     eier- eller tilskuddsendring) via POST /api/v1/monitoring/webhooks.
 *   - watchNace: alle selskaper i en NACE-bransjekode (m/ geo- og
 *     terskel-filtre) via POST /api/v1/nace/subscriptions.
 *
 * Noden registrerer sin egen n8n-webhook-URL som callback hos Firmaradar når
 * arbeidsflyten aktiveres, og avbestiller (DELETE) når den deaktiveres.
 * Abonnement-id lagres i workflow-static-data for opprydding.
 *
 * Mottaksverifisering (webhookVerification.ts): leverings-hemmeligheten
 * sjekkes mot innkommende `Authorization: Bearer`, og for NACE valideres
 * `X-Firmaradar-Signature` (HMAC-SHA256 over rå body) når en
 * signerings-hemmelighet er konfigurert. Mismatch → leveransen droppes.
 */
export class FirmaradarTrigger implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar Trigger',
        name: 'firmaradarTrigger',
        icon: 'file:firmaradar.svg',
        group: ['trigger'],
        version: 1,
        subtitle: '={{$parameter["event"]}}',
        description:
            'Start en flyt når et selskap eller en hel bransje endrer seg ' +
            '(kunngjøring, status, eierskap, regnskap, risiko, IP)',
        defaults: { name: 'Firmaradar Trigger' },
        inputs: [],
        outputs: ['main'],
        credentials: [{ name: 'firmaradarApi', required: true }],
        webhooks: [
            {
                name: 'default',
                httpMethod: 'POST',
                responseMode: 'onReceived',
                path: 'firmaradar',
            },
        ],
        properties: [
            {
                displayName: 'Hendelseskilde',
                name: 'event',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Overvåk et selskap (orgnr)',
                        value: 'watchCompany',
                        description:
                            'Varsel når det overvåkede selskapet får en kunngjøring, ' +
                            'status-, eier- eller tilskuddsendring',
                    },
                    {
                        name: 'Overvåk en bransje (NACE)',
                        value: 'watchNace',
                        description:
                            'Varsel når et selskap i NACE-koden endrer seg (m/ geo- og ' +
                            'størrelsesfiltre)',
                    },
                ],
                default: 'watchCompany',
            },

            // --- watchCompany ---
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                placeholder: '923609016',
                displayOptions: { show: { event: ['watchCompany'] } },
                description: '9-sifret organisasjonsnummer å overvåke',
            },

            // --- watchNace ---
            {
                displayName: 'NACE-kode',
                name: 'naceCode',
                type: 'string',
                default: '',
                required: true,
                placeholder: '47.110',
                displayOptions: { show: { event: ['watchNace'] } },
                description: 'Seksjon (A), hovedgruppe (47) eller spesifikk kode (47.110)',
            },
            {
                displayName: 'Hendelsestyper',
                name: 'events',
                type: 'multiOptions',
                options: [
                    { name: 'Opprettet', value: 'created' },
                    { name: 'Oppdatert', value: 'updated' },
                    { name: 'Slettet', value: 'deleted' },
                    { name: 'Statusendring', value: 'status_changed' },
                ],
                default: [],
                displayOptions: { show: { event: ['watchNace'] } },
                description: 'Hvilke hendelsestyper som skal leveres. Tomt = alle.',
            },
            {
                displayName: 'Aggregering',
                name: 'aggregationMode',
                type: 'options',
                options: [
                    { name: 'Sanntid', value: 'real_time' },
                    { name: 'Times-digest', value: 'hourly_digest' },
                    { name: 'Daglig digest', value: 'daily_digest' },
                ],
                default: 'real_time',
                displayOptions: { show: { event: ['watchNace'] } },
            },
            {
                displayName: 'Tilleggsfiltre',
                name: 'naceFilters',
                type: 'collection',
                placeholder: 'Legg til filter',
                default: {},
                displayOptions: { show: { event: ['watchNace'] } },
                options: [
                    {
                        displayName: 'Fylke-koder (kommaseparert)',
                        name: 'fylke_filter',
                        type: 'string',
                        default: '',
                        placeholder: '03, 11',
                    },
                    {
                        displayName: 'Kommune-koder (kommaseparert)',
                        name: 'kommune_filter',
                        type: 'string',
                        default: '',
                        placeholder: '0301, 1103',
                    },
                    {
                        displayName: 'Landsdel-filter (kommaseparert)',
                        name: 'landsdel_filter',
                        type: 'string',
                        default: '',
                        placeholder: 'Østlandet',
                    },
                    {
                        displayName: 'Minimum antall ansatte',
                        name: 'min_ansatte',
                        type: 'number',
                        default: 0,
                    },
                    {
                        displayName: 'Minimum omsetning (NOK)',
                        name: 'min_omsetning_nok',
                        type: 'number',
                        default: 0,
                    },
                ],
            },

            // --- shared: delivery secret ---
            {
                displayName: 'Leverings-hemmelighet (valgfritt)',
                name: 'deliverySecret',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                description:
                    'Firmaradar sender hemmeligheten tilbake som Authorization: Bearer ' +
                    'på hver leveranse. Når satt, dropper noden innkommende kall som ' +
                    'mangler eller har feil hemmelighet.',
            },

            // --- watchNace: HMAC signing secret ---
            {
                displayName: 'Signerings-hemmelighet (valgfritt)',
                name: 'signingSecret',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                displayOptions: { show: { event: ['watchNace'] } },
                description:
                    'HMAC-nøkkel som registreres på abonnementet (lagres kryptert hos ' +
                    'Firmaradar). Når satt, signeres hver leveranse med ' +
                    'X-Firmaradar-Signature (HMAC-SHA256 over rå request-body), og ' +
                    'noden dropper leveranser med manglende eller ugyldig signatur.',
            },
        ],
    };

    webhookMethods = {
        default: {
            /**
             * n8n kaller denne før create. Vi lar create alltid kjøre
             * (backend upserter), så vi returnerer alltid false.
             */
            async checkExists(this: IHookFunctions): Promise<boolean> {
                return false;
            },

            /**
             * Registrer n8n-webhook-URL-en som callback hos Firmaradar og
             * lagre abonnement-id-en i static data for senere opprydding.
             */
            async create(this: IHookFunctions): Promise<boolean> {
                const credentials = await this.getCredentials('firmaradarApi');
                const baseUrl = (credentials.baseUrl as string) || 'https://firmaradar.no';
                const webhookUrl = this.getNodeWebhookUrl('default') as string;
                const event = this.getNodeParameter('event') as string;
                const deliverySecret = (this.getNodeParameter('deliverySecret', '') as string) || undefined;
                const staticData = this.getWorkflowStaticData('node');

                let path: string;
                let body: IDataObject;

                if (event === 'watchCompany') {
                    path = '/api/v1/monitoring/webhooks';
                    body = {
                        orgnr: this.getNodeParameter('orgnr'),
                        url: webhookUrl,
                        delivery_key: deliverySecret,
                    };
                } else {
                    path = '/api/v1/nace/subscriptions';
                    const filters = this.getNodeParameter('naceFilters', {}) as IDataObject;
                    const events = this.getNodeParameter('events', []) as string[];
                    const signingSecret =
                        (this.getNodeParameter('signingSecret', '') as string) || undefined;
                    body = {
                        nace_code: this.getNodeParameter('naceCode'),
                        url: webhookUrl,
                        bearer_token: deliverySecret,
                        signing_secret: signingSecret,
                        aggregation_mode: this.getNodeParameter('aggregationMode'),
                    };
                    if (events.length > 0) {
                        body.events = events;
                    }
                    body.fylke_filter = splitList(filters.fylke_filter as string);
                    body.kommune_filter = splitList(filters.kommune_filter as string);
                    body.landsdel_filter = splitList(filters.landsdel_filter as string);
                    if (filters.min_ansatte) {
                        body.min_ansatte = filters.min_ansatte;
                    }
                    if (filters.min_omsetning_nok) {
                        body.min_omsetning_nok = filters.min_omsetning_nok;
                    }
                }

                const response = (await this.helpers.requestWithAuthentication.call(
                    this,
                    'firmaradarApi',
                    {
                        method: 'POST',
                        url: `${baseUrl}${path}`,
                        body,
                        json: true,
                    },
                )) as IDataObject;

                const subscriptionId = extractSubscriptionId(response);
                if (subscriptionId === undefined) {
                    throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
                        message: 'Firmaradar returnerte ingen abonnement-id ved oppretting.',
                    });
                }
                staticData.subscriptionId = subscriptionId;
                staticData.event = event;
                return true;
            },

            /**
             * Avbestill abonnementet hos Firmaradar når arbeidsflyten
             * deaktiveres eller webhooken fjernes.
             */
            async delete(this: IHookFunctions): Promise<boolean> {
                const staticData = this.getWorkflowStaticData('node');
                const subscriptionId = staticData.subscriptionId;
                if (subscriptionId === undefined) {
                    return true;
                }
                const credentials = await this.getCredentials('firmaradarApi');
                const baseUrl = (credentials.baseUrl as string) || 'https://firmaradar.no';
                const event = (staticData.event as string) || this.getNodeParameter('event');
                const base =
                    event === 'watchNace'
                        ? '/api/v1/nace/subscriptions'
                        : '/api/v1/monitoring/webhooks';
                try {
                    await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'DELETE',
                        url: `${baseUrl}${base}/${subscriptionId}`,
                        json: true,
                    });
                } catch (error) {
                    // 404 = allerede borte; behandle som suksess.
                    const statusCode = (error as IDataObject)?.httpCode;
                    if (statusCode !== '404' && statusCode !== 404) {
                        throw error;
                    }
                }
                delete staticData.subscriptionId;
                delete staticData.event;
                return true;
            },
        },
    };

    /**
     * Kalles når Firmaradar POST-er en hendelse til n8n-webhook-URL-en.
     * Verifiserer leveransen mot konfigurerte hemmeligheter (Bearer +
     * NACE-HMAC) og sender payloaden videre som ett item. Leveranser som
     * feiler verifisering droppes stille (200-svar uten workflow-start,
     * samme mønster som n8n-kjernens WooCommerce-trigger) — et 4xx-svar
     * ville avslørt for en angriper at en hemmelighet er konfigurert.
     */
    async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
        const headers = this.getHeaderData() as Record<string, unknown>;

        // Leverings-hemmelighet satt → krev korrekt `Authorization: Bearer`.
        const deliverySecret = (this.getNodeParameter('deliverySecret', '') as string) || '';
        if (!isAuthenticDelivery(deliverySecret || undefined, headers)) {
            return {};
        }

        // Signerings-hemmelighet satt (kun watchNace) → krev gyldig
        // HMAC-signatur over den rå request-bodyen.
        const signingSecret = (this.getNodeParameter('signingSecret', '') as string) || '';
        if (signingSecret) {
            const request = this.getRequestObject() as unknown as {
                rawBody?: Buffer | string;
            };
            if (!hasValidSignature(signingSecret, request.rawBody, headers)) {
                return {};
            }
        }

        const bodyData = this.getBodyData();
        return {
            workflowData: [this.helpers.returnJsonArray(bodyData as IDataObject)],
        };
    }
}

/**
 * Del en kommaseparert streng til en trimmet liste; tom streng → tom liste.
 */
function splitList(value: string | undefined): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

/**
 * Hent abonnement-id fra Firmaradars svar. Per-orgnr-svaret har `id` på
 * toppnivå; NACE-svaret har den under `subscription.id`.
 */
function extractSubscriptionId(response: IDataObject): number | string | undefined {
    if (response.id !== undefined && response.id !== null) {
        return response.id as number | string;
    }
    const subscription = response.subscription as IDataObject | undefined;
    if (subscription && subscription.id !== undefined && subscription.id !== null) {
        return subscription.id as number | string;
    }
    return undefined;
}
