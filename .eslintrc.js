/**
 * ESLint-konfigurasjon for n8n-nodes-firmaradar (dev/CI).
 *
 * Brukes for vanlig `pnpm lint`. For en strengere kjøring rett før
 * npm-publisering, se `.eslintrc.prepublish.js` som påtvinger
 * `plugin:n8n-nodes-base/community-strict` i tillegg.
 *
 * Norske display-navn:
 *   `eslint-plugin-n8n-nodes-base` håndhever amerikansk title-case +
 *   sentence-case-regler for `displayName`, operation actions og
 *   boolean descriptions. Pakken er bevisst på *norsk*, så vi slår av
 *   reglene som mangler i18n-støtte. Resultatet er at vi beholder
 *   skikkelig norsk «Hent eierskap» framfor maskinelt-mangle:t «Hent
 *   Eierskap», og full setninger som «Inntekt, formue, skatt — krever
 *   full tilgang» får stå med stor forbokstav slik norsk skriftspråk
 *   krever.
 *
 *   `n8n-nodes-base/community-package-json-license-not-default` slås
 *   av: pakken er bevisst Apache-2.0, ikke MIT.
 *
 *   `n8n-nodes-base/node-execute-block-wrong-error-thrown` slås av
 *   for `throw new Error(...)` i `default:`-grenen — utelukkende
 *   intern programmerings-feil, kommer aldri til brukeren.
 */
module.exports = {
    root: true,
    env: {
        browser: false,
        es2022: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
    },
    ignorePatterns: [
        'dist/**',
        'node_modules/**',
        'gulpfile.js',
        '.eslintrc.js',
        '.eslintrc.prepublish.js',
    ],
    overrides: [
        {
            files: ['package.json'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/community'],
            rules: {
                'n8n-nodes-base/community-package-json-name-still-default': 'off',
                'n8n-nodes-base/community-package-json-license-not-default': 'off',
            },
        },
        {
            files: ['./credentials/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/credentials'],
            rules: {
                // Norske dokumentasjons-URL-er er tillatt.
                'n8n-nodes-base/cred-class-field-documentation-url-not-http-url': 'off',
                // Regel-bug: URL-strenger (https://...) trigger "kebab-case"-fixer.
                'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
            },
        },
        {
            files: ['./nodes/**/*.ts'],
            plugins: ['eslint-plugin-n8n-nodes-base'],
            extends: ['plugin:n8n-nodes-base/nodes'],
            rules: {
                // i18n: håndhev IKKE amerikansk case-konvensjon på
                // norske UI-strenger.
                'n8n-nodes-base/node-param-display-name-miscased': 'off',
                'n8n-nodes-base/node-param-description-miscased': 'off',
                'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
                'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
                'n8n-nodes-base/node-param-options-type-unsorted-items': 'off',
                // Intern programmerings-feil i default:-grenen — Error er ok.
                'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
            },
        },
    ],
};
