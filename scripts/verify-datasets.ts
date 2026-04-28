/**
 * Batch-checks Socrata GeoJSON availability for a list of dataset ids.
 * Prints status per id so we can confidently expand the categories registry.
 */
const IDS = [
  // transit
  "693u-uax6", "jjja-shxy", "dimy-qyej", "ycrg-ses3", "g9jx-npbk",
  "ufzp-rrqu", "hjz2-y62k", "ptd9-4c6m",
  // nature
  "ijwa-mn2v", "y5rm-wagw", "p48c-iqtu", "48va-85tp", "p78i-pat6",
  // buildings
  "rvih-nhyn", "388s-pnvc", "92iy-9c3n", "phvi-damg", "bs8b-p36w",
  // civic
  "pri4-ifjk", "63ge-mke6", "ruf7-3wgc", "j3u5-usz2", "afns-vxeu",
  "5yfv-9hkp", "wwxk-38u4", "7jdm-inj8",
  // safety
  "h9gi-nx95", "jknp-skuy", "bqye-aqft", "5mad-ntua", "fwpa-qxaf",
  "ph7v-u5f3",
  // health
  "6ez8-za84", "jntv-ngw5", "edk2-vkjh", "r465-fr2q", "8znf-7b2c",
  "p937-wjvj",
  // education
  "cmjf-yawu", "t26j-jbq7", "ruu9-egea", "8ugf-3d8u",
  // environment
  "mrjc-v9pm", "epne-qv9x", "8n8s-np59", "ek8y-fsqz", "2juy-aj8e",
  "df32-vzax", "2w2g-fk3i",
  // commerce
  "w9zq-xm8b", "n6c5-95xh",
];

type Result = { id: string; ok: boolean; geomType?: string; count?: number; err?: string };

async function check(id: string): Promise<Result> {
  const url = `https://data.cityofnewyork.us/resource/${id}.geojson?$limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { id, ok: false, err: `${res.status}` };
    const fc = (await res.json()) as { features?: { geometry?: { type: string } }[] };
    const feats = fc.features ?? [];
    if (feats.length === 0) return { id, ok: false, err: "empty" };
    return { id, ok: true, geomType: feats[0].geometry?.type, count: feats.length };
  } catch (e) {
    return { id, ok: false, err: String(e).slice(0, 60) };
  }
}

async function main() {
  const results = await Promise.all(IDS.map(check));
  const ok = results.filter((r) => r.ok);
  const bad = results.filter((r) => !r.ok);

  console.log(`\n✓ Working (${ok.length}):`);
  for (const r of ok) console.log(`  ${r.id}  ${r.geomType}`);

  console.log(`\n✗ Broken (${bad.length}):`);
  for (const r of bad) console.log(`  ${r.id}  ${r.err}`);
}

main();
