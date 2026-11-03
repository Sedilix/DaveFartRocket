/** Block ids and their look. Colours are baked into vertex colours, so there are no textures to load. */
export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  SNOW: 8,
  PLANKS: 9,
  BRICK: 10,
  GLASS: 11,
  HULL: 12,
  CUSHION: 13,
  GLOW: 14,
  PANEL: 15,
  JGRASS: 16,
  JLEAF: 17,
  BARK: 18,
  THATCH: 19,
  TORCH: 20,
  BEAN: 21,
  SHROOM: 22,
  ICE: 23
} as const;

export interface BlockInfo {
  name: string;
  top: number;
  side: number;
  bottom: number;
}

export const BLOCKS: BlockInfo[] = [
  { name: 'Air', top: 0, side: 0, bottom: 0 },
  { name: 'Grass', top: 0x5fa83c, side: 0x7a5c3a, bottom: 0x6b4a2c },
  { name: 'Dirt', top: 0x7a5434, side: 0x7a5434, bottom: 0x6b4a2c },
  { name: 'Stone', top: 0x8c9096, side: 0x8c9096, bottom: 0x80848a },
  { name: 'Sand', top: 0xe3d49b, side: 0xe3d49b, bottom: 0xd6c78c },
  { name: 'Water', top: 0x3b78c9, side: 0x3b78c9, bottom: 0x3b78c9 },
  { name: 'Wood', top: 0x9c7a4b, side: 0x6e4f2e, bottom: 0x9c7a4b },
  { name: 'Leaves', top: 0x3f8a34, side: 0x3f8a34, bottom: 0x3f8a34 },
  { name: 'Snow', top: 0xf4f8ff, side: 0xe2ecf5, bottom: 0xcfd9e3 },
  { name: 'Planks', top: 0xc59a5b, side: 0xc59a5b, bottom: 0xc59a5b },
  { name: 'Brick', top: 0xb5533c, side: 0xb5533c, bottom: 0xa24a35 },
  { name: 'Glass', top: 0xbfe6f2, side: 0xbfe6f2, bottom: 0xbfe6f2 },
  { name: 'Hull', top: 0xe9edf3, side: 0xdde3ec, bottom: 0xcfd6e0 },
  { name: 'Cushion', top: 0xf2a6c4, side: 0xe48db0, bottom: 0xd67aa0 },
  { name: 'Glow', top: 0xb9f4ff, side: 0xb9f4ff, bottom: 0xb9f4ff },
  { name: 'Panel', top: 0x5b6b8c, side: 0x4d5c7c, bottom: 0x44516e },
  { name: 'Jungle Grass', top: 0x2f8a2c, side: 0x6b4a2c, bottom: 0x5e3f25 },
  { name: 'Jungle Leaf', top: 0x23762b, side: 0x1f6b27, bottom: 0x1a5a22 },
  { name: 'Bark', top: 0x6a4526, side: 0x4e3320, bottom: 0x6a4526 },
  { name: 'Thatch', top: 0xd2ae4e, side: 0xc29a3e, bottom: 0xa88130 },
  { name: 'Torch', top: 0xffe27a, side: 0xffc24a, bottom: 0xffc24a },
  { name: 'Bean', top: 0xc99556, side: 0xb8864b, bottom: 0xa5763d },
  { name: 'Glowshroom', top: 0xff8de0, side: 0xe36fc6, bottom: 0xc95aae },
  { name: 'Ice', top: 0xcdeaf7, side: 0xa9d6ec, bottom: 0x93c4de }
];

/** Blocks the player can place, in hotbar order. */
export const HOTBAR: number[] = [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WOOD, B.PLANKS, B.BRICK, B.LEAVES, B.SNOW];

/** Solid for collision and picking: everything except air and water. */
export function isSolid(id: number): boolean {
  return id !== B.AIR && id !== B.WATER;
}

/** Should a face of block `a` be drawn when its neighbour is `n`? */
export function shouldDrawFace(a: number, n: number): boolean {
  if (n === B.AIR) return true;
  if (a === B.WATER) return false; // water only shows against air
  if (n === B.WATER) return true;
  if (n === B.LEAVES) return a !== B.LEAVES;
  if (n === B.GLASS) return a !== B.GLASS;
  return false;
}
