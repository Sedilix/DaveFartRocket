export interface FartMilestone {
  fartNumber: number;
  multiplier: number;
  multiplierFormatted: string;
  decibels: number;
  statusLabel: string;
  dotColor: 'green' | 'yellow' | 'orange' | 'red';
  onomatopoeia: string;
  centerPopup: string | null;
  narrativeSubtitle: string | null;
  targetAltitude: number; // approximate meters
  shakeIntensity: number;
}

export const MILESTONES: FartMilestone[] = [
  {
    fartNumber: 1,
    multiplier: 1,
    multiplierFormatted: '×1',
    decibels: 54,
    statusLabel: 'PERFECTLY DISCREET',
    dotColor: 'green',
    onomatopoeia: 'poot',
    centerPopup: 'What if every fart DOUBLED in strength?',
    narrativeSubtitle: "Meet Dave. He's having a perfectly normal Tuesday.",
    targetAltitude: 0,
    shakeIntensity: 0.05
  },
  {
    fartNumber: 2,
    multiplier: 2,
    multiplierFormatted: '×2',
    decibels: 60,
    statusLabel: 'SLIGHT BREEZE',
    dotColor: 'green',
    onomatopoeia: 'pfft',
    centerPopup: null,
    narrativeSubtitle: 'Wait. That felt twice as strong.',
    targetAltitude: 0,
    shakeIntensity: 0.1
  },
  {
    fartNumber: 3,
    multiplier: 4,
    multiplierFormatted: '×4',
    decibels: 66,
    statusLabel: 'SOMEONE NOTICED',
    dotColor: 'green',
    onomatopoeia: 'pfrrt',
    centerPopup: null,
    narrativeSubtitle: 'The dog heard that. Heads are turning.',
    targetAltitude: 0,
    shakeIntensity: 0.15
  },
  {
    fartNumber: 4,
    multiplier: 8,
    multiplierFormatted: '×8',
    decibels: 72,
    statusLabel: 'DOG IS CONCERNED',
    dotColor: 'yellow',
    onomatopoeia: 'pfrrrt',
    centerPopup: null,
    narrativeSubtitle: 'Pigeons are evacuating the sidewalk.',
    targetAltitude: 0,
    shakeIntensity: 0.25
  },
  {
    fartNumber: 5,
    multiplier: 16,
    multiplierFormatted: '×16',
    decibels: 78,
    statusLabel: 'AWKWARD COUGHS',
    dotColor: 'yellow',
    onomatopoeia: 'PBRRRT',
    centerPopup: null,
    narrativeSubtitle: 'Dave feigns innocence.',
    targetAltitude: 0,
    shakeIntensity: 0.35
  },
  {
    fartNumber: 6,
    multiplier: 32,
    multiplierFormatted: '×32',
    decibels: 84,
    statusLabel: 'SHAME BEGINS',
    dotColor: 'yellow',
    onomatopoeia: 'BRRRP',
    centerPopup: null,
    narrativeSubtitle: 'Everyone on the block is holding their nose.',
    targetAltitude: 0,
    shakeIntensity: 0.5
  },
  {
    fartNumber: 7,
    multiplier: 64,
    multiplierFormatted: '×64',
    decibels: 90,
    statusLabel: 'LOUDER THAN A MOWER',
    dotColor: 'orange',
    onomatopoeia: 'BRRRAP!',
    centerPopup: '90 dB\n(Louder than a lawn mower)',
    narrativeSubtitle: 'The café has noticed.',
    targetAltitude: 0,
    shakeIntensity: 0.7
  },
  {
    fartNumber: 8,
    multiplier: 128,
    multiplierFormatted: '×128',
    decibels: 96,
    statusLabel: 'BRUNCH CANCELLED',
    dotColor: 'orange',
    onomatopoeia: 'BRAAP!',
    centerPopup: null,
    narrativeSubtitle: 'Outdoor dining was a mistake.',
    targetAltitude: 0,
    shakeIntensity: 0.9
  },
  {
    fartNumber: 9,
    multiplier: 256,
    multiplierFormatted: '×256',
    decibels: 102,
    statusLabel: 'CAR ALARMS TRIGGERED',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAP!',
    centerPopup: null,
    narrativeSubtitle: "Dave's feet have left the pavement.",
    targetAltitude: 12,
    shakeIntensity: 1.2
  },
  {
    fartNumber: 10,
    multiplier: 512,
    multiplierFormatted: '×512',
    decibels: 108,
    statusLabel: 'ASCENDING THE ALLEY',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAP!!',
    centerPopup: null,
    narrativeSubtitle: 'Rooftop pigeons scatter in pure panic.',
    targetAltitude: 32,
    shakeIntensity: 1.4
  },
  {
    fartNumber: 11,
    multiplier: 1024,
    multiplierFormatted: '×1,024',
    decibels: 114,
    statusLabel: 'PASSING THE 20TH FLOOR',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAAP!',
    centerPopup: null,
    narrativeSubtitle: 'The street is getting very small.',
    targetAltitude: 65,
    shakeIntensity: 1.7
  },
  {
    fartNumber: 12,
    multiplier: 2048,
    multiplierFormatted: '×2,048',
    decibels: 120,
    statusLabel: 'THRESHOLD OF PAIN',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAAP!!',
    centerPopup: '120 dB\n(Threshold of human pain)',
    narrativeSubtitle: 'Dave is airborne and steadily climbing.',
    targetAltitude: 110,
    shakeIntensity: 2.0
  },
  {
    fartNumber: 13,
    multiplier: 4096,
    multiplierFormatted: '×4,096',
    decibels: 126,
    statusLabel: 'CITY BLOCK VIBRATING',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAAP!!',
    centerPopup: null,
    narrativeSubtitle: 'Car horns and sirens echo across three boroughs.',
    targetAltitude: 160,
    shakeIntensity: 2.3
  },
  {
    fartNumber: 14,
    multiplier: 8192,
    multiplierFormatted: '×8,192',
    decibels: 132,
    statusLabel: 'JET ENGINE AT TAKEOFF',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAAAAP!',
    centerPopup: null,
    narrativeSubtitle: 'Air traffic control reports an unlogged radar target.',
    targetAltitude: 220,
    shakeIntensity: 2.7
  },
  {
    fartNumber: 15,
    multiplier: 16384,
    multiplierFormatted: '×16,384',
    decibels: 138,
    statusLabel: 'SONIC CRACK DETECTED',
    dotColor: 'orange',
    onomatopoeia: 'BRAAAAAAP!!',
    centerPopup: null,
    narrativeSubtitle: 'Local barometers drop 40 millibars in half a second.',
    targetAltitude: 300,
    shakeIntensity: 3.1
  },
  {
    fartNumber: 16,
    multiplier: 32768,
    multiplierFormatted: '×32,768',
    decibels: 144,
    statusLabel: 'INTO THE CLOUDS',
    dotColor: 'orange',
    onomatopoeia: 'WHOOOOSH!',
    centerPopup: null,
    narrativeSubtitle: 'Cruising altitude achieved.',
    targetAltitude: 550,
    shakeIntensity: 3.6
  },
  {
    fartNumber: 17,
    multiplier: 65536,
    multiplierFormatted: '×65,536',
    decibels: 150,
    statusLabel: 'EARDRUMS RUPTURING',
    dotColor: 'red',
    onomatopoeia: 'SKRRR-BOOM!',
    centerPopup: '150 dB\n(Eardrums rupture)',
    narrativeSubtitle: "Dave's eardrums are fine. Everyone else's are not.",
    targetAltitude: 950,
    shakeIntensity: 4.2
  },
  {
    fartNumber: 18,
    multiplier: 131072,
    multiplierFormatted: '×131,072',
    decibels: 156,
    statusLabel: 'STRATOSPHERE PENETRATION',
    dotColor: 'red',
    onomatopoeia: 'THUUUNDER!',
    centerPopup: null,
    narrativeSubtitle: 'The midday sky fades from azure into deep abyss navy.',
    targetAltitude: 1500,
    shakeIntensity: 4.8
  },
  {
    fartNumber: 19,
    multiplier: 262144,
    multiplierFormatted: '×262,144',
    decibels: 162,
    statusLabel: 'THE SKY IS GOING BLACK',
    dotColor: 'red',
    onomatopoeia: 'KZZT-ROAR!',
    centerPopup: null,
    narrativeSubtitle: 'Birds, planes and weather are all far below.',
    targetAltitude: 2400,
    shakeIntensity: 5.5
  },
  {
    fartNumber: 20,
    multiplier: 524288,
    multiplierFormatted: '×524,288',
    decibels: 168,
    statusLabel: 'SATELLITES: DISTURBED',
    dotColor: 'red',
    onomatopoeia: 'SONIC CRACK!',
    centerPopup: null,
    narrativeSubtitle: 'GPS is recalculating.',
    targetAltitude: 4200,
    shakeIntensity: 6.3
  },
  {
    fartNumber: 21,
    multiplier: 1048576,
    multiplierFormatted: '×1,048,576',
    decibels: 174,
    statusLabel: 'THE MOON FELT THAT',
    dotColor: 'red',
    onomatopoeia: 'LUNAR BOOM!',
    centerPopup: null,
    narrativeSubtitle: 'Gravity has lost interest. Houston has several questions.',
    targetAltitude: 7200,
    shakeIntensity: 7.2
  },
  {
    fartNumber: 22,
    multiplier: 2097152,
    multiplierFormatted: '×2,097,152',
    decibels: 180,
    statusLabel: 'EARTH: RIPPLING',
    dotColor: 'red',
    onomatopoeia: 'SEISMIC GUST!',
    centerPopup: null,
    narrativeSubtitle: 'Tsunami warnings: all of them.',
    targetAltitude: 11000,
    shakeIntensity: 8.4
  },
  {
    fartNumber: 23,
    multiplier: 4194304,
    multiplierFormatted: '×4,194,304',
    decibels: 186,
    statusLabel: 'APPROACHING SOUND LIMIT',
    dotColor: 'red',
    onomatopoeia: 'MEGA-TECTONIC!',
    centerPopup: null,
    narrativeSubtitle: 'Dave remains optimistic.',
    targetAltitude: 16000,
    shakeIntensity: 9.8
  },
  {
    fartNumber: 24,
    multiplier: 8388608,
    multiplierFormatted: '×8,388,608',
    decibels: 192,
    statusLabel: 'TWO DECIBELS FROM THE LIMIT',
    dotColor: 'red',
    onomatopoeia: 'HYPER-SHOCKWAVE!',
    centerPopup: '194 dB\n(The loudest sound air can carry)',
    narrativeSubtitle: 'Dave has seen the chart.',
    targetAltitude: 22000,
    shakeIntensity: 11.5
  },
  {
    fartNumber: 25,
    multiplier: 16777216,
    multiplierFormatted: '×16,777,216',
    decibels: 198,
    statusLabel: 'NOT SOUND ANYMORE',
    dotColor: 'red',
    onomatopoeia: 'WORLD BREAKER!',
    centerPopup: null,
    narrativeSubtitle: 'Dave is fine.',
    targetAltitude: 30000,
    shakeIntensity: 15.0
  }
];

export function getMilestone(fartNumber: number): FartMilestone {
  const index = Math.max(1, Math.min(25, fartNumber)) - 1;
  return MILESTONES[index];
}
