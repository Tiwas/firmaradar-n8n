import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionType,
} from 'n8n-workflow';

/**
 * Firmaradar — KYC og AML
 *
 * Operasjoner: checkAmlPep, getAmlScore, getRiskScore, checkFiv.
 * Brukes typisk i KYC-onboarding-arbeidsflyter med varsling ved høy risiko.
 */
export class FirmaradarKyc implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Firmaradar — KYC og AML',
        name: 'firmaradarKyc',
        icon: 'file:firmaradar.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'AML/PEP-screening, risikoscoring og foretak-i-vanskeligheter-sjekk',
        defaults: { name: 'Firmaradar KYC' },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        credentials: [{ name: 'firmaradarApi', required: true }],
        properties: [
            {
                displayName: 'Operasjon',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Sjekk AML/PEP', value: 'checkAmlPep', action: 'Sanksjonslister og PEP-screening' },
                    { name: 'Hent AML-score', value: 'getAmlScore', action: 'Strukturert risikoscore 0-100' },
                    { name: 'Hent risikoscore', value: 'getRiskScore', action: 'Generell risiko-vurdering' },
                    { name: 'Sjekk foretak i vanskeligheter', value: 'checkFiv', action: 'FIV-status (a-e-regler)' },
                ],
                default: 'checkAmlPep',
            },
            {
                displayName: 'Organisasjonsnummer',
                name: 'orgnr',
                type: 'string',
                default: '',
                required: true,
                placeholder: '999999999',
                description: '9-sifret norsk organisasjonsnummer',
            },
            {
                displayName: 'Formål med oppslaget',
                name: 'purpose',
                type: 'options',
                options: [
                    { name: 'KYC-onboarding (ny kunde)', value: 'kyc_onboarding' },
                    { name: 'KYC-revurdering (eksisterende)', value: 'kyc_review' },
                    { name: 'Risikoovervåkning', value: 'risk_monitoring' },
                    { name: 'Manuell forespørsel', value: 'manual' },
                ],
                default: 'kyc_onboarding',
                displayOptions: { show: { operation: ['checkAmlPep', 'getAmlScore'] } },
                description: 'Brukes til revisjonsspor og rate-limiting',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const credentials = await this.getCredentials('firmaradarApi');
        const baseUrl = (credentials.baseUrl as string) || 'https://firmaradar.no';

        for (let i = 0; i < items.length; i++) {
            const operation = this.getNodeParameter('operation', i) as string;
            const orgnr = this.getNodeParameter('orgnr', i) as string;
            let path: string;
            let method: 'GET' | 'POST' = 'GET';
            let body: Record<string, unknown> | undefined;
            let response: unknown;

            switch (operation) {
                case 'checkAmlPep':
                    path = '/api/v1/aml/check';
                    method = 'POST';
                    body = {
                        orgnr,
                        purpose: this.getNodeParameter('purpose', i),
                    };
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method,
                        url: `${baseUrl}${path}`,
                        body,
                        json: true,
                    });
                    break;

                case 'getAmlScore': {
                    // Alternativ A (to-kall): generer rapport, deretter hent score
                    const generated = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'POST',
                        url: `${baseUrl}/ext/aml_rapport/generer`,
                        body: {
                            orgnr,
                            purpose: this.getNodeParameter('purpose', i),
                        },
                        json: true,
                    });
                    const rapportId = (generated as { rapport_id: string }).rapport_id;
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/ext/aml_rapport/rapport/${rapportId}`,
                        json: true,
                    });
                    break;
                }

                case 'getRiskScore':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/ext/risikoscoring/score/${orgnr}`,
                        json: true,
                    });
                    break;

                case 'checkFiv':
                    response = await this.helpers.requestWithAuthentication.call(this, 'firmaradarApi', {
                        method: 'GET',
                        url: `${baseUrl}/ext/foretak_i_vanskeligheter/assess/${orgnr}`,
                        json: true,
                    });
                    break;

                default:
                    throw new Error(`Ukjent operasjon: ${operation}`);
            }

            returnData.push({ json: response as Record<string, unknown> });
        }
        return [returnData];
    }
}
