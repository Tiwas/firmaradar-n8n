import {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

/**
 * Firmaradar API-legitimasjon for alle n8n-noder i denne pakken.
 *
 * Brukeren henter API-nøkkelen fra https://firmaradar.no/min-side/api-keys
 * og limer inn her. Samme legitimasjon gjenbrukes på tvers av alle
 * Firmaradar-noder i alle arbeidsflyter.
 *
 * Base-URL er konfigurerbar for å støtte selvhostet Firmaradar (default
 * peker til prod-instansen på firmaradar.no).
 */
export class FirmaradarApi implements ICredentialType {
    name = 'firmaradarApi';
    displayName = 'Firmaradar API';
    documentationUrl = 'https://firmaradar.no/dokumentasjon';
    icon = 'file:firmaradar.svg' as const;

    properties: INodeProperties[] = [
        {
            displayName: 'API-nøkkel',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            required: true,
            description: 'API-nøkkel fra firmaradar.no/min-side/api-keys',
        },
        {
            displayName: 'Base-URL',
            name: 'baseUrl',
            type: 'string',
            default: 'https://firmaradar.no',
            description: 'Endre kun hvis du kjører selvhostet Firmaradar-instans',
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.apiKey}}',
                // n8n er ikke en MCP-agent — bruk dedikert klient-header
                // slik at rate-limit-tier og audit-trail på backend skiller
                // n8n-trafikk fra MCP-agent-trafikk (#131, v0.3.0).
                'X-FR-Client': 'n8n',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.baseUrl}}',
            // Autentisert lett-oppslag — /api/v1/health/ping finnes ikke i
            // backend, og et uautentisert endepunkt ville uansett ikke
            // validert nøkkelen.
            url: '/api/v1/companies/search?q=firmaradar&limit=1',
            method: 'GET',
        },
    };
}
