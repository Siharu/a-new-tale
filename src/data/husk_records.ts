/**
 * THREAT RECORDS — INITIAL TAXONOMY
 * 
 * File holds ALL threat types discovered in the Another Sky outbreak:
 * - 9 Husk variants (humans who rejected reality completely)
 * - 5 Infected variants (humans in partial rejection, can think/plan)
 * - 1 Ghuul type (apex threat: accepted truth without rejecting, retains agency)
 * 
 * All entries are written from a **scared survivor's perspective** — 
 * what a Drifter observes through behavior/senses ONLY.
 * 
 * ⚠️ CRITICAL SPOILER RULE:
 * Real mechanism (psychological rejection of breaking reality) is end-game revelation.
 * NEVER reference it in these entries. Write only behavioral observations.
 * 
 * What Drifters know: Unknown pathogen, bite transmission observed, 
 * in-world theories (signal rewiring, prions, virus, fungus, hallucinations).
 * What NEVER appears: "rejected reality", "the veil", "dimensional exposure", 
 * "psychological response to truth".
 */

import { HuskType, InfectedType, GhuulType, DetectionMethod } from '../types.js';

export interface HuskRecord {
  id: string;
  type: HuskType;
  
  // Discovery: starts null, player fills in through gameplay
  discoveredName: string | null;
  
  // Observable traits (survivor POV — NOT why it happens)
  physicalTraits: string;
  detectionMethods: DetectionMethod[];
  behavior: string;
  
  // Threat assessment
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  
  // Survival observations
  weakness: string;
  preventionTip: string;
  
  // Encounter tracking (filled during gameplay)
  encounterCount: number;
  firstSightedTime?: number; // World time
  notes: string; // Player-discoverable lore/descriptions accumulate here
}

export interface InfectedRecord {
  id: string;
  type: InfectedType;
  
  discoveredName: string | null;
  
  physicalTraits: string;
  detectionMethods: DetectionMethod[];
  behavior: string;
  
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  
  weakness: string;
  preventionTip: string;
  
  encounterCount: number;
  firstSightedTime?: number;
  notes: string;
}

export interface GhuulRecord {
  id: string;
  type: GhuulType;
  
  discoveredName: string | null;
  
  physicalTraits: string;
  detectionMethods: DetectionMethod[];
  behavior: string;
  
  threatLevel: 'EXTREME'; // Always
  
  weakness: string;
  preventionTip: string;
  
  encounterCount: number;
  firstSightedTime?: number;
  notes: string;
}

// ─── INITIAL HUSK TAXONOMY (9 types) ───

export const INITIAL_HUSK_RECORDS: HuskRecord[] = [
  {
    id: 'husk-skoth',
    type: HuskType.SKOTH,
    discoveredName: null,
    physicalTraits: 'Early-stage decomposition, unstable gait, body falling apart.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.SOUND],
    behavior: 'Wanders aimlessly. Increasingly fragile over time (months). By 9 months, mostly disintegrated.',
    threatLevel: 'LOW',
    weakness: 'Fragile frame. Falls apart naturally over time. Can be knocked down easily.',
    preventionTip: 'If encountered early in outbreak, avoid direct engagement. They become less dangerous as time passes.',
    encounterCount: 0,
    notes: 'First type documented. Survival rate after encounter: high if you avoid contact.',
  },
  {
    id: 'husk-glowbubs',
    type: HuskType.GLOWBUBS,
    discoveredName: null,
    physicalTraits: 'Humanoid, intact but hyperfocused. Drawn to light sources. Eyes fixated.',
    detectionMethods: [DetectionMethod.BEHAVIOR, DetectionMethod.SIGHT],
    behavior: 'Obsessively seeks light. Will flee toward nearest light source regardless of danger. Cannot function without fixation. Predictable movement pattern.',
    threatLevel: 'MEDIUM',
    weakness: 'Extremely predictable. Will always move toward light. Use darkness and light sources to redirect or trap.',
    preventionTip: 'Turn off lights. Let them flee. Do not engage in lit areas.',
    encounterCount: 0,
    notes: 'Predictable hunting pattern makes evasion straightforward. Fire a useful tool against these.',
  },
  {
    id: 'husk-jawies',
    type: HuskType.JAWIES,
    discoveredName: null,
    physicalTraits: 'Muscular frame. Strong jaw and bite. Aggressive posture.',
    detectionMethods: [DetectionMethod.SOUND, DetectionMethod.SIGHT],
    behavior: 'Attacks barriers and obstacles directly. Rams through walls, doors, barricades. Relentless in physical aggression. Does not stop to think.',
    threatLevel: 'HIGH',
    weakness: 'Predictable attack pattern. Cannot be deterred from ramming. Heavy and slow to pivot. Avoid head-on confrontation.',
    preventionTip: 'Barricades will NOT hold. Use vertical obstacles, walls, or distance. Do not attempt to block with your body.',
    encounterCount: 0,
    notes: 'Responsible for most structural breaches in fortified sites. Plan escapes before, not during, encounter.',
  },
  {
    id: 'husk-whites',
    type: HuskType.WHITES,
    discoveredName: null,
    physicalTraits: 'White/bleached hair. Calcified fingers. Pale skin. Eyes hyperalert.',
    detectionMethods: [DetectionMethod.VIBRATION, DetectionMethod.SOUND],
    behavior: 'Detects vibrations from kilometers away. Hypersensitive to any disturbance. Will hunt source of vibration relentlessly. Must be approached in complete silence.',
    threatLevel: 'EXTREME',
    weakness: 'NONE if moving. Can only be avoided via absolute stillness. Movement = death. Stealth only.',
    preventionTip: 'If sighted: freeze immediately. Do not run. Do not make sound. Wait until it leaves. Silence is survival.',
    encounterCount: 0,
    notes: 'Deadliest in areas with exposed ground. Indoor stone floors are deathtraps around these. Survival: do not breathe audibly.',
  },
  {
    id: 'husk-oldbones',
    type: HuskType.OLDBONES,
    discoveredName: null,
    physicalTraits: 'Elderly hosts. Restructured skeleton. Extrusions along spine. Hardened skull. Reinforced bone structure.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.SOUND],
    behavior: 'Slow but relentless. Not affected by standard stopping methods. High pain tolerance. Can walk through damage.',
    threatLevel: 'HIGH',
    weakness: 'Slow movement allows distance escape. Head shots less effective; aim lower body/joints. Avoid prolonged contact.',
    preventionTip: 'If cornered: do not attempt to fight. Create distance. They cannot catch what they cannot reach.',
    encounterCount: 0,
    notes: 'Most difficult to stop once engaged. Prevention >> confrontation.',
  },
  {
    id: 'husk-disabled',
    type: HuskType.DISABLED,
    discoveredName: null,
    physicalTraits: 'Varied. Compensatory mutations: exaggerated limbs, sensory overdevelopment, unnatural joint angles.',
    detectionMethods: [
      DetectionMethod.VIBRATION,
      DetectionMethod.SIGHT,
      DetectionMethod.SOUND,
      DetectionMethod.UNKNOWN, // varies per host
    ],
    behavior: 'Detection method depends on original disability: blind → hypersensitive hearing; deaf → extreme distance sight; crippled → mutated compensatory limbs. Unpredictable.',
    threatLevel: 'MEDIUM',
    weakness: 'Varies. Identify compensation method, then exploit the opposite sense.',
    preventionTip: 'Observe first. Identify which sense is enhanced. Plan avoidance accordingly.',
    encounterCount: 0,
    notes: 'Each encounter is unique. No two are identical. Treat every one as fresh threat.',
  },
  {
    id: 'husk-noire',
    type: HuskType.NOIRE,
    discoveredName: null,
    physicalTraits: 'Humanoid, intact. Most dangerous at night. Completely motionless until movement detected.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.SOUND],
    behavior: 'Nocturnal ONLY. Travel in groups of 2-3. Remain completely still (statue-like) until prey moves, then attack instantly. Slight coordinated behavior (communication via unknown method).',
    threatLevel: 'EXTREME',
    weakness: 'Daytime: dormant/inactive. Night time: most dangerous pack hunters. Light does not deter them. Silence and stillness critical.',
    preventionTip: 'Avoid outdoors at night. If caught outside: find shelter immediately. Do not move in darkness if Noire are present.',
    encounterCount: 0,
    notes: 'Night gameplay is fundamentally different. NEVER go outside during night hours without preparation.',
  },
  {
    id: 'husk-bloaters',
    type: HuskType.BLOATERS,
    discoveredName: null,
    physicalTraits: 'Enlarged mouth, muscle tissue fills jaw. Capable of extreme vocalization. Large lung capacity.',
    detectionMethods: [DetectionMethod.SOUND],
    behavior: 'Produces extremely loud screams. Screams trigger nearby Husk migration and alertness. One bloater can turn manageable situation into catastrophic one. Scream acts as herd call.',
    threatLevel: 'EXTREME',
    weakness: 'Silence is survival. If bloater screams: ALL nearby threats activate. Plan escape BEFORE it vocalizes.',
    preventionTip: 'Silence-critical. The moment you hear a bloater: assume all threats in 10km radius are now active. Escape or die.',
    encounterCount: 0,
    notes: 'Escalation factor. One bloater = group threat. Never worth engagement.',
  },
  {
    id: 'husk-aquatic',
    type: HuskType.AQUATIC,
    discoveredName: null,
    physicalTraits: 'Humanoid but adapted for underwater environment. Gills or equivalent. Pale, scaled or slick skin.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.VIBRATION],
    behavior: 'Walks underwater. Hunts aquatic life and anything that enters water. Slow but persistent. Can breathe underwater indefinitely. Months into outbreak.',
    threatLevel: 'HIGH',
    weakness: 'Slow land movement. Avoid water zones entirely. Cannot follow onto dry land easily.',
    preventionTip: 'Water zones become inaccessible as outbreak progresses. Mark zones as "flooded" once Aquatic sighted.',
    encounterCount: 0,
    notes: 'Evidence that rejection adapts. No environment is truly safe. Water crossings require planning.',
  },
];

// ─── INITIAL INFECTED TAXONOMY (5 types) ───

export const INITIAL_INFECTED_RECORDS: InfectedRecord[] = [
  {
    id: 'infected-they-think',
    type: InfectedType.THEY_THINK,
    discoveredName: null,
    physicalTraits: 'Humanoid, mostly intact. Eyes reflect light (cat-like). Partial intelligence visible in movement.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.BEHAVIOR],
    behavior: 'Acts with strategy. Can plan multi-step attacks. Infiltrates bases. Watches and learns. Can use tools (simple). Avoid familiar faces.',
    threatLevel: 'HIGH',
    weakness: 'Distraction. Complex environments confuse strategy. Unpredictable chaos disrupts planning.',
    preventionTip: 'Never establish patterns. Change routes daily. Do not let them learn your habits.',
    encounterCount: 0,
    notes: 'Most dangerous type for infiltration. Harder to predict than Husks. Requires active defense, not just hiding.',
  },
  {
    id: 'infected-they-talk',
    type: InfectedType.THEY_TALK,
    discoveredName: null,
    physicalTraits: 'Appear almost fully human. Speech is natural. Movement is human-like. Can blend into survivor groups.',
    detectionMethods: [DetectionMethod.BEHAVIOR, DetectionMethod.SIGHT],
    behavior: 'Speaks naturally. Can mimic human behavior perfectly. Infiltrate bases by blending in. Bite can turn humans into Husk or Infected. Visibly enjoy killing (sadistic behavior). Will betray at opportune moment.',
    threatLevel: 'EXTREME',
    weakness: 'Only identifiable through behavior observation over time. Bite marks heal with black bloated tissue (post-infection).',
    preventionTip: 'Quarantine new arrivals. Observe for inconsistencies. If bitten: mark bite immediately for observation.',
    encounterCount: 0,
    notes: 'Indistinguishable from humans in initial contact. Trust no newcomers without observation period.',
  },
  {
    id: 'infected-they-trick',
    type: InfectedType.THEY_TRICK,
    discoveredName: null,
    physicalTraits: 'Humanoid but uncanny. Wrong proportions. Skinwalker-like appearance. Body did not fully commit to transformation.',
    detectionMethods: [DetectionMethod.SOUND, DetectionMethod.SIGHT],
    behavior: 'Mimics voices of loved ones perfectly. Uses emotional manipulation to lure prey. Active evening-to-dawn only. Causes psychological break in targets.',
    threatLevel: 'HIGH',
    weakness: 'Only mimics voices, not faces. Does not appear as loved ones. Sight verification saves lives.',
    preventionTip: 'If you hear a loved one: verify visually before approaching. Do not trust audio alone.',
    encounterCount: 0,
    notes: 'Most psychologically cruel threat type. Causes greatest psychological damage.',
  },
  {
    id: 'infected-they-take',
    type: InfectedType.THEY_TAKE,
    discoveredName: null,
    physicalTraits: 'Humanoid, strong frame. Predatory posture. Claws or reinforced hands.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.BEHAVIOR],
    behavior: 'Kidnaps during sleep hours. Tears apart prey while alive. Prolongs death (not quick kills). Specifically targets children/young. Not driven by hunger — driven by cruelty.',
    threatLevel: 'EXTREME',
    weakness: 'Only hunts sleeping targets. Staying awake = safety. Requires vigilance at night. Cannot be reasoned with.',
    preventionTip: 'Rotation watches. Barricade sleeping areas. Never sleep alone. Children must be guarded 24/7 in infested zones.',
    encounterCount: 0,
    notes: 'Worst threat to child survival. Prioritize child security above all.',
  },
  {
    id: 'infected-glitch',
    type: InfectedType.GLITCH,
    discoveredName: null,
    physicalTraits: 'Unknown. Body twitches rapidly. Appears to move without biological constraints. Visual distortion.',
    detectionMethods: [DetectionMethod.SIGHT, DetectionMethod.UNKNOWN],
    behavior: 'Moves through barriers as if they do not exist. Appears to flicker between locations. Acts without logical pattern. Moves faster than should be possible. Nature and origin unclassified.',
    threatLevel: 'EXTREME',
    weakness: 'UNKNOWN. No confirmed successful evasion or engagement. Possibly exists in altered reality state.',
    preventionTip: 'Do not attempt engagement. If sighted: flee immediate area. Possible containment through isolation (unknown methods).',
    encounterCount: 0,
    notes: 'UNCLASSIFIED THREAT. Do not approach. Report all sightings to WNCORE immediately. Behavior research ongoing.',
  },
];

// ─── GHUUL TAXONOMY (1 type: apex threat) ───

export const INITIAL_GHUUL_RECORD: GhuulRecord = {
  id: 'ghuul-apex',
  type: GhuulType.APEX,
  discoveredName: null,
  physicalTraits:
    'Pure white skin and hair (normally). Eyes flicker between brown and black. Visible internal conflict: backs cracked open, flesh held by string-like tissue. Movement glitches between realities.',
  detectionMethods: [
    DetectionMethod.SIGHT,
    DetectionMethod.VIBRATION,
    DetectionMethod.BEHAVIOR,
  ],
  behavior:
    'Acts with PURPOSE and AGENCY. Makes deliberate choices. Retains EMOTION (love, recognition, protection of loved ones observed). Does not mindlessly consume. Operates with unknown goals. ~173 known worldwide.',
  threatLevel: 'EXTREME',
  weakness:
    'NONE KNOWN. Shooting brain does not stop them. Physical damage does not stop them. Rain of Obsedia briefly turns skin brown (moment of restored humanity) — unclear if vulnerability exists during this state.',
  preventionTip:
    'Avoid. Do not engage. If encountered: observe behavior and report to WNCORE. Some ghuuls protect rather than attack (unknown criteria). Contact WNCORE leadership immediately with location/behavior data.',
  encounterCount: 0,
  notes:
    'Most dangerous and least understood. Some show protection behavior toward humans (mother protecting child reported). Others destroy survivor camps (reasons unknown). WNCORE tracks all 173 known individuals. This is apex threat AND potential unknown ally.',
};
