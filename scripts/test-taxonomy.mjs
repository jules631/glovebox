// Classifier smoke test against real receipt language. No API key required.
// Run with: node --experimental-strip-types scripts/test-taxonomy.mjs

import { classifyLineItem, serviceIdentity } from "../src/lib/taxonomy.ts";

let pass = 0, fail = 0;
function expect(desc, wantKey, wantAxle) {
  const got = classifyLineItem(desc);
  const ok = got.key === wantKey && (wantAxle === undefined || got.axle === wantAxle);
  if (ok) { pass++; console.log(`  ok  ${desc}  ->  ${serviceIdentity(got.key, got.axle)}`); }
  else { fail++; console.log(`  FAIL ${desc}  ->  got ${got.key}/${got.axle}, want ${wantKey}/${wantAxle}`); }
}

console.log("\nThe same work, said many ways");
expect("Repl brake pads front", "brake_pads", "front");
expect("FRONT BRAKE PAD REPLACEMENT", "brake_pads", "front");
expect("BRK PD FR", "brake_pads", "front");
expect("Brake job (front)", "brake_pads", "front");
expect("Semi-metallic brake pad set, rear", "brake_pads", "rear");

console.log("\nSpecificity: the broad word must not swallow the narrow one");
expect("Brake fluid flush", "brake_fluid", null);
expect("Brake caliper, front left", "brake_caliper");
expect("Resurface front rotors", "brake_rotors", "front");
expect("Rotate tires", "tire_rotation");
expect("Mount and balance 4 tires", "tire_replacement");
expect("Tire repair / patch", "tire_repair");
expect("Radiator replacement", "radiator");
expect("Coolant flush service", "coolant_flush");
expect("Engine air filter", "engine_air_filter");
expect("Cabin air filter replacement", "cabin_air_filter");
expect("Transmission fluid service", "transmission_fluid");

console.log("\nAbbreviations and shop shorthand");
expect("LOF", "oil_change");
expect("Lube, oil, filter", "oil_change");
expect("Full synthetic 5W-30", "oil_change");
expect("P225/65R17 TIRE", "tire_replacement");
expect("4 WHEEL ALIGNMENT", "wheel_alignment");
expect("Multi-point inspection", "multi_point_inspection");
expect("Courtesy check", "multi_point_inspection");
expect("SHOP SUPPLIES", "shop_fee");
expect("Hazardous waste disposal fee", "shop_fee");

console.log("\nUnknown work degrades to other rather than guessing");
expect("Customer states noise when turning", "other");
expect("", "other");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
