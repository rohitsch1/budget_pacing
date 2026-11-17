// Parser test runner. Usage (Node 22.6+):
//   node --experimental-strip-types src/features/capture/parser.run.mjs
import { parseReceipt } from './parser.ts';
import { CASES, NOW } from './parser.test-cases.ts';

let pass = 0;
let fail = 0;
for (const c of CASES) {
  const r = parseReceipt(c.lines, { homeCurrency: c.homeCurrency ?? 'INR', now: NOW });
  const errs = [];
  for (const [k, v] of Object.entries(c.expect)) {
    if (k === 'minConfidence') {
      if (r.confidence < v) errs.push(`confidence ${r.confidence} < ${v}`);
    } else if (k === 'maxConfidence') {
      if (r.confidence > v) errs.push(`confidence ${r.confidence} > ${v}`);
    } else if (JSON.stringify(r[k]) !== JSON.stringify(v)) {
      errs.push(`${k}: got ${JSON.stringify(r[k])}, want ${JSON.stringify(v)}`);
    }
  }
  if (errs.length) {
    fail++;
    console.log(`FAIL ${c.name}\n  - ${errs.join('\n  - ')}\n  result: ${JSON.stringify(r)}`);
  } else {
    pass++;
    console.log(`ok   ${c.name}  (conf ${r.confidence})`);
  }
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
