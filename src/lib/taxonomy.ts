// The canonical service catalog.
//
// Receipts describe the same work a dozen ways: "Repl brake pads front",
// "FRONT BRAKE PAD REPLACEMENT", "BRK PD FR", "Brake job (front)". Until those
// collapse to one key, nothing downstream is possible: you cannot tell that a
// service repeated, cannot say what is due, cannot compare what two shops
// charged. This file is the least glamorous part of the product and the part
// everything else stands on.

export type VehicleSystem =
  | "engine"
  | "brakes"
  | "tires"
  | "electrical"
  | "drivetrain"
  | "suspension"
  | "hvac"
  | "exhaust"
  | "fluids"
  | "general";

export type ServiceKind = "maintenance" | "repair" | "inspection" | "fee";

export type ServiceKey =
  | "oil_change"
  | "tire_rotation"
  | "tire_replacement"
  | "tire_repair"
  | "wheel_alignment"
  | "wheel_balance"
  | "brake_pads"
  | "brake_rotors"
  | "brake_fluid"
  | "brake_caliper"
  | "battery"
  | "alternator"
  | "starter"
  | "spark_plugs"
  | "ignition_coil"
  | "engine_air_filter"
  | "cabin_air_filter"
  | "fuel_filter"
  | "serpentine_belt"
  | "timing_belt"
  | "water_pump"
  | "thermostat"
  | "radiator"
  | "coolant_flush"
  | "transmission_fluid"
  | "transmission_repair"
  | "differential_fluid"
  | "power_steering"
  | "clutch"
  | "cv_axle"
  | "wheel_bearing"
  | "shocks_struts"
  | "control_arm"
  | "exhaust_repair"
  | "catalytic_converter"
  | "oxygen_sensor"
  | "ac_service"
  | "wiper_blades"
  | "headlight"
  | "state_inspection"
  | "emissions_test"
  | "diagnostic"
  | "multi_point_inspection"
  | "shop_fee"
  | "other";

// Where these numbers come from, stated plainly because they drive real
// behavior and none of them is sourced from a manufacturer.
//
// intervalMiles / intervalMonths are conventional shop guidance for a modern
// car on synthetic oil, of the kind printed on a windshield sticker. They are
// NOT a manufacturer's schedule: real per-VIN schedules are licensed data
// (ALLDATA, Motor, Epicor) and vary by engine, drivetrain, and severe-service
// duty cycle. Everywhere these surface, the UI labels them generic, because a
// confident wrong interval on someone's specific car is worse than an obvious
// approximation. Treat them as a prompt to check the owner's manual.
//
// typicalWarrantyMonths / typicalWarrantyMiles are the fallback window for
// repeat detection when the earlier receipt printed no terms of its own. They
// lean SHORT on purpose. A missed repeat costs the user a question they did
// not think to ask; a false "you paid twice" costs the product its
// credibility, and it never gets it back. Findings built on these numbers are
// additionally discounted and labeled in findRepeats.
export interface ServiceDef {
  key: ServiceKey;
  label: string;
  system: VehicleSystem;
  kind: ServiceKind;
  /** Wear items are the ones whose measurements trend toward a replacement. */
  wearItem: boolean;
  /** Generic manufacturer agnostic interval. Deliberately generic: real per VIN
   *  schedules are licensed data, and a generic interval labeled as generic is
   *  more honest than a precise one we cannot source. */
  intervalMiles: number | null;
  intervalMonths: number | null;
  /** Typical shop warranty on this work, used to size the repeat repair window
   *  when the receipt itself states no terms. */
  typicalWarrantyMonths: number | null;
  typicalWarrantyMiles: number | null;
}

export const SERVICES: Record<ServiceKey, ServiceDef> = {
  oil_change:            { key: "oil_change",            label: "Oil and filter change",   system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 5000,   intervalMonths: 6,   typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  tire_rotation:         { key: "tire_rotation",         label: "Tire rotation",           system: "tires",      kind: "maintenance", wearItem: false, intervalMiles: 6000,   intervalMonths: 6,   typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  tire_replacement:      { key: "tire_replacement",      label: "Tire replacement",        system: "tires",      kind: "repair",      wearItem: true,  intervalMiles: 45000,  intervalMonths: 72,  typicalWarrantyMonths: 72,   typicalWarrantyMiles: 45000 },
  tire_repair:           { key: "tire_repair",           label: "Tire repair",             system: "tires",      kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 12,  typicalWarrantyMiles: 12000 },
  wheel_alignment:       { key: "wheel_alignment",       label: "Wheel alignment",         system: "suspension", kind: "maintenance", wearItem: false, intervalMiles: 30000,  intervalMonths: 24,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  wheel_balance:         { key: "wheel_balance",         label: "Wheel balance",           system: "tires",      kind: "maintenance", wearItem: false, intervalMiles: 15000,  intervalMonths: 12,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  brake_pads:            { key: "brake_pads",            label: "Brake pads",              system: "brakes",     kind: "repair",      wearItem: true,  intervalMiles: 40000,  intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  brake_rotors:          { key: "brake_rotors",          label: "Brake rotors",            system: "brakes",     kind: "repair",      wearItem: true,  intervalMiles: 60000,  intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  brake_fluid:           { key: "brake_fluid",           label: "Brake fluid service",     system: "fluids",     kind: "maintenance", wearItem: false, intervalMiles: 45000,  intervalMonths: 36,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  brake_caliper:         { key: "brake_caliper",         label: "Brake caliper",           system: "brakes",     kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  battery:               { key: "battery",               label: "Battery",                 system: "electrical", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: 48,  typicalWarrantyMonths: 36,   typicalWarrantyMiles: null },
  alternator:            { key: "alternator",            label: "Alternator",              system: "electrical", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  starter:               { key: "starter",               label: "Starter",                 system: "electrical", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  spark_plugs:           { key: "spark_plugs",           label: "Spark plugs",             system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 60000,  intervalMonths: null, typicalWarrantyMonths: 12,  typicalWarrantyMiles: 12000 },
  ignition_coil:         { key: "ignition_coil",         label: "Ignition coil",           system: "engine",     kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  engine_air_filter:     { key: "engine_air_filter",     label: "Engine air filter",       system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 20000,  intervalMonths: 24,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  cabin_air_filter:      { key: "cabin_air_filter",      label: "Cabin air filter",        system: "hvac",       kind: "maintenance", wearItem: false, intervalMiles: 20000,  intervalMonths: 12,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  fuel_filter:           { key: "fuel_filter",           label: "Fuel filter",             system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 30000,  intervalMonths: null, typicalWarrantyMonths: 12,  typicalWarrantyMiles: 12000 },
  serpentine_belt:       { key: "serpentine_belt",       label: "Serpentine belt",         system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 70000,  intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  timing_belt:           { key: "timing_belt",           label: "Timing belt",             system: "engine",     kind: "maintenance", wearItem: false, intervalMiles: 90000,  intervalMonths: 84,  typicalWarrantyMonths: 24,   typicalWarrantyMiles: 24000 },
  water_pump:            { key: "water_pump",            label: "Water pump",              system: "engine",     kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  thermostat:            { key: "thermostat",            label: "Thermostat",              system: "engine",     kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  radiator:              { key: "radiator",              label: "Radiator",                system: "engine",     kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  coolant_flush:         { key: "coolant_flush",         label: "Coolant service",         system: "fluids",     kind: "maintenance", wearItem: false, intervalMiles: 50000,  intervalMonths: 60,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  transmission_fluid:    { key: "transmission_fluid",    label: "Transmission fluid",      system: "fluids",     kind: "maintenance", wearItem: false, intervalMiles: 60000,  intervalMonths: 72,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  transmission_repair:   { key: "transmission_repair",   label: "Transmission repair",     system: "drivetrain", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 36,  typicalWarrantyMiles: 36000 },
  differential_fluid:    { key: "differential_fluid",    label: "Differential fluid",      system: "fluids",     kind: "maintenance", wearItem: false, intervalMiles: 50000,  intervalMonths: 48,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  power_steering:        { key: "power_steering",        label: "Power steering service",  system: "fluids",     kind: "maintenance", wearItem: false, intervalMiles: 60000,  intervalMonths: 60,  typicalWarrantyMonths: 12,   typicalWarrantyMiles: 12000 },
  clutch:                { key: "clutch",                label: "Clutch",                  system: "drivetrain", kind: "repair",      wearItem: true,  intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  cv_axle:               { key: "cv_axle",               label: "CV axle",                 system: "drivetrain", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  wheel_bearing:         { key: "wheel_bearing",         label: "Wheel bearing",           system: "suspension", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  shocks_struts:         { key: "shocks_struts",         label: "Shocks and struts",       system: "suspension", kind: "repair",      wearItem: true,  intervalMiles: 75000,  intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  control_arm:           { key: "control_arm",           label: "Control arm",             system: "suspension", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  exhaust_repair:        { key: "exhaust_repair",        label: "Exhaust repair",          system: "exhaust",    kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  catalytic_converter:   { key: "catalytic_converter",   label: "Catalytic converter",     system: "exhaust",    kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 60,  typicalWarrantyMiles: 50000 },
  oxygen_sensor:         { key: "oxygen_sensor",         label: "Oxygen sensor",           system: "exhaust",    kind: "repair",      wearItem: false, intervalMiles: 90000,  intervalMonths: null, typicalWarrantyMonths: 24,  typicalWarrantyMiles: 24000 },
  ac_service:            { key: "ac_service",            label: "Air conditioning service", system: "hvac",      kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 12,  typicalWarrantyMiles: 12000 },
  wiper_blades:          { key: "wiper_blades",          label: "Wiper blades",            system: "general",    kind: "maintenance", wearItem: false, intervalMiles: null,   intervalMonths: 12,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  headlight:             { key: "headlight",             label: "Headlight or bulb",       system: "electrical", kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: 12,  typicalWarrantyMiles: 12000 },
  state_inspection:      { key: "state_inspection",      label: "State safety inspection", system: "general",    kind: "inspection",  wearItem: false, intervalMiles: null,   intervalMonths: 12,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  emissions_test:        { key: "emissions_test",        label: "Emissions test",          system: "exhaust",    kind: "inspection",  wearItem: false, intervalMiles: null,   intervalMonths: 24,  typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  diagnostic:            { key: "diagnostic",            label: "Diagnostic",              system: "general",    kind: "inspection",  wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  multi_point_inspection:{ key: "multi_point_inspection", label: "Multi point inspection", system: "general",    kind: "inspection",  wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  shop_fee:              { key: "shop_fee",              label: "Shop fee",                system: "general",    kind: "fee",         wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: null, typicalWarrantyMiles: null },
  other:                 { key: "other",                 label: "Other work",              system: "general",    kind: "repair",      wearItem: false, intervalMiles: null,   intervalMonths: null, typicalWarrantyMonths: null, typicalWarrantyMiles: null },
};

export const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

export type Axle = "front" | "rear" | "all" | null;

export interface Classification {
  key: ServiceKey;
  axle: Axle;
  /** How the match was made. Pattern matches are deterministic and replayable;
   *  this is not a model confidence score. */
  matchedOn: string | null;
  confidence: "high" | "medium" | "low";
}

interface Rule {
  key: ServiceKey;
  /** Ordered most specific first. First hit wins. */
  patterns: RegExp[];
  /** If any of these also match, reject the rule. Guards against a broad
   *  pattern swallowing a more specific one. */
  exclude?: RegExp[];
}

// Order matters. Specific repairs before the generic system words that appear
// inside them: "brake fluid flush" must not land on brake_pads, and "brake
// caliper" must not land on brake_rotors.
const RULES: Rule[] = [
  { key: "brake_fluid", patterns: [/\bbrake\s*fluid\b/i, /\bbrk\s*fl(ui)?d\b/i] },
  { key: "brake_caliper", patterns: [/\bcalip/i] },
  { key: "brake_rotors", patterns: [/\brotor/i, /\bdisc\s*(brake)?\s*resurf/i, /\bmachine\s*(drum|rotor)/i] },
  { key: "brake_pads", patterns: [/\bbrake\s*(pad|shoe)/i, /\bpad\s*(and|&|\+)\s*rotor/i, /\bbrk\s*pd\b/i, /\bbrake\s*(job|service|replace)/i, /\bsemi[\s-]?met.*pad/i], exclude: [/\bfluid\b/i, /\binspect(ion)?\s*only\b/i] },

  { key: "tire_rotation", patterns: [/\b(tire|tyre|wheel)s?\s*rotat/i, /\brotate\s*(and|&|\+)?\s*(balance|tires?)/i, /\brotation\b/i] },
  // "Mount and balance" is a tire installation, not a standalone balance. The
  // balance is included in the job; treating it as its own service would hide
  // the tire purchase and break both repeat detection and tire warranty math.
  { key: "wheel_balance", patterns: [/\bbalanc/i, /\bwheel\s*weight/i], exclude: [/\bmount/i, /\d{3}\/\d{2}\s*r?\s*\d{2}/i] },
  { key: "wheel_alignment", patterns: [/\balign/i, /\btoe\s*(and|&)\s*(camber|thrust)/i] },
  { key: "tire_repair", patterns: [/\b(tire|tyre)\s*(repair|patch|plug)/i, /\bflat\s*repair/i, /\bpuncture/i] },
  { key: "tire_replacement", patterns: [/\b(tire|tyre)s?\b.*\b(replace|new|install|mount)/i, /\bmount\s*(and|&|\+)?\s*balance/i, /\b\d{3}\/\d{2}\s*r?\s*\d{2}\b/i, /\bp?\d{3}\/\d{2}r\d{2}\b/i], exclude: [/\brotat/i, /\brepair|patch|plug\b/i] },

  { key: "oil_change", patterns: [/\boil\s*(and|&|\+)?\s*(filter)?\s*change/i, /\blube[\s,]*oil/i, /\blof\b/i, /\bfull\s*synth.*oil/i, /\boil\s*chg\b/i, /\bmotor\s*oil\b/i, /\boil\s*filter\b/i, /\b\d+w[\s-]?\d+\b/i] },
  { key: "engine_air_filter", patterns: [/\b(engine\s*)?air\s*filter/i, /\bair\s*cleaner\s*element/i], exclude: [/\bcabin\b/i] },
  { key: "cabin_air_filter", patterns: [/\bcabin\s*(air\s*)?filter/i, /\bpollen\s*filter/i, /\bmicron\s*air\s*filter/i] },
  { key: "fuel_filter", patterns: [/\bfuel\s*filter/i] },
  { key: "spark_plugs", patterns: [/\bspark\s*plug/i, /\bplug\s*(replace|set)/i, /\biridium\s*plug/i] },
  { key: "ignition_coil", patterns: [/\bignition\s*coil/i, /\bcoil\s*pack/i] },
  { key: "timing_belt", patterns: [/\btiming\s*(belt|chain)/i] },
  { key: "serpentine_belt", patterns: [/\bserpentine/i, /\bdrive\s*belt/i, /\bacc(essory)?\s*belt/i, /\bv[\s-]?belt/i] },
  { key: "water_pump", patterns: [/\bwater\s*pump/i] },
  { key: "thermostat", patterns: [/\bthermostat/i] },
  { key: "radiator", patterns: [/\bradiator/i], exclude: [/\bflush|coolant\b/i] },
  { key: "coolant_flush", patterns: [/\bcoolant/i, /\bantifreeze/i, /\bcooling\s*system\s*(flush|service)/i] },

  { key: "transmission_fluid", patterns: [/\btrans(mission)?\s*(fluid|flush|service)/i, /\batf\b/i, /\bcvt\s*fluid/i] },
  { key: "transmission_repair", patterns: [/\btransmission\b/i, /\bvalve\s*body/i, /\btorque\s*converter/i] },
  { key: "differential_fluid", patterns: [/\b(diff(erential)?|gear)\s*(oil|fluid|lube|service)/i, /\btransfer\s*case\s*(fluid|service)/i] },
  { key: "power_steering", patterns: [/\bpower\s*steering/i, /\bp\/s\s*(fluid|flush)/i] },
  { key: "clutch", patterns: [/\bclutch/i, /\bflywheel/i] },
  { key: "cv_axle", patterns: [/\bcv\s*(axle|joint|boot)/i, /\bhalf\s*shaft/i, /\baxle\s*shaft/i] },
  { key: "wheel_bearing", patterns: [/\b(wheel\s*)?(hub\s*)?bearing/i, /\bhub\s*assembly/i] },
  { key: "shocks_struts", patterns: [/\bshock/i, /\bstrut/i, /\bcoil\s*spring/i] },
  { key: "control_arm", patterns: [/\bcontrol\s*arm/i, /\bball\s*joint/i, /\bsway\s*bar/i, /\btie\s*rod/i, /\bbushing/i] },

  { key: "battery", patterns: [/\bbatter/i, /\bagm\b/i, /\bcca\b/i], exclude: [/\bhybrid\s*battery\s*cooling/i] },
  { key: "alternator", patterns: [/\balternator/i] },
  { key: "starter", patterns: [/\bstarter/i] },
  { key: "headlight", patterns: [/\bhead\s*l(ight|amp)/i, /\btail\s*l(ight|amp)/i, /\bbulb/i, /\bmini\s*lamp/i] },

  { key: "catalytic_converter", patterns: [/\bcatalytic/i, /\bcat\s*converter/i] },
  { key: "oxygen_sensor", patterns: [/\b(o2|oxygen)\s*sensor/i, /\bair\s*fuel\s*ratio\s*sensor/i] },
  { key: "exhaust_repair", patterns: [/\bexhaust/i, /\bmuffler/i, /\bresonator/i, /\btail\s*pipe/i] },
  { key: "ac_service", patterns: [/\ba\/?c\s*(recharge|service|repair|evac)/i, /\bair\s*cond/i, /\brefrigerant/i, /\br[\s-]?134a\b/i, /\bcompressor\b/i] },

  { key: "wiper_blades", patterns: [/\bwiper/i, /\bblade\s*(refill|set)/i] },
  { key: "emissions_test", patterns: [/\bemission/i, /\bsmog/i] },
  { key: "state_inspection", patterns: [/\bstate\s*inspect/i, /\bsafety\s*inspect/i, /\bannual\s*inspect/i] },
  { key: "multi_point_inspection", patterns: [/\bmulti[\s-]?point/i, /\b\d{2,3}\s*point\s*inspect/i, /\bcourtesy\s*(check|inspect)/i, /\bvehicle\s*(health|condition)\s*(check|report)/i, /\bdvi\b/i] },
  { key: "diagnostic", patterns: [/\bdiagnos/i, /\bscan\s*tool/i, /\btrouble\s*code/i, /\bcheck\s*engine/i, /\bp0\d{3}\b/i] },

  { key: "shop_fee", patterns: [/\bshop\s*(supply|supplies|fee)/i, /\bhazmat/i, /\bhazardous\s*waste/i, /\bdisposal\s*fee/i, /\benviron(mental)?\s*(fee|charge)/i, /\bsublet/i, /\bsupply\s*charge/i] },
];

const AXLE_PATTERNS: Array<{ axle: Axle; re: RegExp }> = [
  { axle: "all", re: /\b(all\s*4|all\s*four|4\s*wheel|front\s*(and|&|\+)\s*rear)\b/i },
  { axle: "front", re: /\b(front|frt|fr\b|f\/)/i },
  { axle: "rear", re: /\b(rear|rr\b|back)\b/i },
];

function detectAxle(text: string): Axle {
  for (const { axle, re } of AXLE_PATTERNS) if (re.test(text)) return axle;
  return null;
}

/**
 * Map one free text line item to a canonical service.
 *
 * Deliberately rules based rather than a model call. Classification runs on
 * every line of every receipt, needs to be identical every time so that repeat
 * detection is stable, and has to be auditable when it gets something wrong.
 * A wrong rule is a line of code you can point at.
 */
export function classifyLineItem(description: string, kind?: string): Classification {
  const text = description.trim();
  if (!text) return { key: "other", axle: null, matchedOn: null, confidence: "low" };

  if (kind === "fee") {
    const feeRule = RULES.find((r) => r.key === "shop_fee");
    const explicit = feeRule?.patterns.some((p) => p.test(text));
    return { key: "shop_fee", axle: null, matchedOn: explicit ? "fee pattern" : "line kind", confidence: explicit ? "high" : "medium" };
  }

  for (const rule of RULES) {
    if (rule.exclude?.some((p) => p.test(text))) continue;
    const hit = rule.patterns.find((p) => p.test(text));
    if (hit) {
      return {
        key: rule.key,
        axle: SERVICES[rule.key].system === "brakes" || SERVICES[rule.key].system === "tires" || SERVICES[rule.key].system === "suspension"
          ? detectAxle(text)
          : null,
        matchedOn: hit.source,
        confidence: "high",
      };
    }
  }

  return { key: "other", axle: null, matchedOn: null, confidence: "low" };
}

/** Stable identity for repeat detection: the same service on the same axle. */
export function serviceIdentity(key: ServiceKey, axle: Axle): string {
  return axle && axle !== "all" ? `${key}:${axle}` : key;
}

export function serviceLabel(key: ServiceKey, axle?: Axle): string {
  const base = SERVICES[key].label;
  if (!axle || axle === "all") return base;
  return `${base} (${axle})`;
}
