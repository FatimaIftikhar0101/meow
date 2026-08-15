/**
 * Precomputes the world map as flat SVG path data for the mobile app.
 *
 * Run from the REPO ROOT, which is where d3-geo and topojson-client are
 * installed (they belong to the Next.js client; the mobile app deliberately
 * does not depend on them):
 *
 *   node mobile/scripts/build-worldmap.js . mobile/components/worldLand.data.ts
 *
 * Only needs re-running if public/world-110m.json changes or a new corridor
 * country is added to ISO below.
 *
 * Source is public/world-110m.json — Natural Earth 110m via world-atlas, public
 * domain — which the Next.js client already ships. Doing the projection here
 * rather than at runtime means the app carries no map library at all, and the
 * phone pays nothing to draw it: one static string per path.
 *
 * Projection is plain equirectangular over a 1000x500 box, chosen because it is
 * LINEAR: lon/lat maps to x/y with arithmetic the component can redo in two
 * lines, so a pin and the coastline underneath it cannot drift apart. Anything
 * fancier (Natural Earth 1, Robinson) would force the app to carry d3-geo just
 * to place a dot.
 */
const fs = require('fs');
const path = require('path');
const { feature, merge } = require('topojson-client');
const { geoPath, geoEquirectangular } = require('d3-geo');

const REPO = process.argv[2];
const OUT = process.argv[3];

const W = 1000;
const H = 500;

const topo = JSON.parse(fs.readFileSync(path.join(REPO, 'public/world-110m.json'), 'utf8'));

const projection = geoEquirectangular()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, H / 2]);

/** Round to 1dp — at 110m resolution the extra digits are noise, and this
 *  roughly halves the bundled string. */
const render = geoPath(projection).pointRadius(1);
const trim = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));

/* ── The landmass, merged: no internal borders to clutter a small card ── */
const land = feature(topo, topo.objects.land);
const landPath = trim(render(land));

/* ── The corridors we actually serve, for highlighting the two endpoints ── */
const ISO = { CA: '124', US: '840', GB: '826', PK: '586', IN: '356', PH: '608' };
const countries = feature(topo, topo.objects.countries).features;
const byIso = {};
for (const [alpha2, numeric] of Object.entries(ISO)) {
  const f = countries.find((c) => String(c.id) === numeric);
  if (!f) {
    console.error(`MISSING country ${alpha2} (${numeric})`);
    continue;
  }
  byIso[alpha2] = trim(render(f));
}

const out = `/**
 * GENERATED — do not edit by hand.
 * Rebuilt with scratchpad/build-worldmap.js from public/world-110m.json
 * (Natural Earth 110m via world-atlas, public domain).
 *
 * Equirectangular projection over a ${W}x${H} viewBox. That projection is
 * linear, so a longitude/latitude converts to a point in this same space with:
 *
 *   x = (lon + 180) / 360 * ${W}
 *   y = (90 - lat) / 180 * ${H}
 *
 * which is what project() in WorldMap.tsx does. Because both the coastline and
 * the pins go through the identical transform, a pin cannot land in the sea.
 */

export const MAP_W = ${W};
export const MAP_H = ${H};

/** Every landmass, merged — one path, no internal borders. */
export const LAND_PATH =
  '${landPath}';

/** Individual outlines for the countries we serve, to pick out the endpoints. */
export const COUNTRY_PATH: Record<string, string> = {
${Object.entries(byIso)
  .map(([k, v]) => `  ${k}:\n    '${v}',`)
  .join('\n')}
};
`;

fs.writeFileSync(OUT, out);
const kb = (s) => `${(s.length / 1024).toFixed(1)}KB`;
console.log(`land path      ${kb(landPath)}`);
for (const [k, v] of Object.entries(byIso)) console.log(`  ${k.padEnd(3)}          ${kb(v)}`);
console.log(`total written  ${kb(out)}  ->  ${OUT}`);

/* Sanity: the two default endpoints must land on their own country's outline. */
const check = [
  ['Toronto', -79.3832, 43.6532],
  ['Karachi', 67.0099, 24.8607],
  ['Mumbai', 72.8777, 19.076],
];
for (const [name, lon, lat] of check) {
  const [px, py] = projection([lon, lat]);
  const lx = ((lon + 180) / 360) * W;
  const ly = ((90 - lat) / 180) * H;
  const drift = Math.hypot(px - lx, py - ly);
  console.log(
    `${name.padEnd(8)} d3=(${px.toFixed(1)}, ${py.toFixed(1)})  linear=(${lx.toFixed(1)}, ${ly.toFixed(1)})  drift=${drift.toFixed(4)}`,
  );
}
