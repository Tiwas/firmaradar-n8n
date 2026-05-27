const { src, dest } = require('gulp');
const path = require('path');

/**
 * Kopier node + credential-ikoner fra /nodes/**\/*.svg og /credentials/**\/*.svg
 * til dist/-mappen, slik at n8n kan referere dem via "file:firmaradar.svg".
 *
 * n8n-konvensjon: ikoner skal være SVG, helst kvadratisk, < 20 KB. Vi peker
 * direkte til firmaradar.no/static/img/logo_nobg.png i node-deklarasjonene
 * via "file:firmaradar.svg" — krever at filen ligger ved siden av .node-fila.
 */
function buildIcons() {
    return src(['nodes/**/*.svg', 'credentials/**/*.svg'], { base: '.' })
        .pipe(dest('dist/'));
}

exports['build:icons'] = buildIcons;
exports.default = buildIcons;
