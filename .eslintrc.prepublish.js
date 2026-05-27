/**
 * Strengere ESLint-konfigurasjon for npm-publish.
 *
 * Trigges av `prepublishOnly` i package.json (kjører `pnpm lint -c
 * .eslintrc.prepublish.js`). Forskjellen fra `.eslintrc.js`:
 *
 *   - Ingen i18n-overstyringer fjernes — vi vil ikke title-case
 *     norske display-navn ved publisering heller.
 *   - Vi bumper noen mindre regler til `error` for å sørge for at
 *     publish-løypen fanger feil tidlig (de er allerede `error` i
 *     dev-konfigen, men presetnavnet er bevart for kompatibilitet
 *     med n8n-prepublish-konvensjonen).
 *
 * Merk: `community-strict` / `nodes-strict` / `credentials-strict`
 * eksisterer ikke i `eslint-plugin-n8n-nodes-base@^1.16` (vi sjekket
 * 2026-05-27). Vi bruker basis-konfigene fra `.eslintrc.js` og
 * stoler på at de allerede er `error`-nivå.
 */
module.exports = {
    extends: './.eslintrc.js',
};
