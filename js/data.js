// All sizes in inches, weights in pounds.
// Truck interiors are U-Haul's published figures: the main cargo deck plus the over-cab
// "Mom's Attic" (15', 20' and 26' only). Wheel wells are not modeled.
export const TRUCKS = [
  {
    id: '10', name: '10 ft', label: '10 ft truck', cuft: 402,
    deck: { l: 119, w: 75, h: 73 },           // 9'11" × 6'3" × 6'1"
    attic: null,
  },
  {
    id: '15', name: '15 ft', label: '15 ft truck', cuft: 764,
    deck: { l: 149, w: 92, h: 86 },           // 12'5" deck × 7'8" × 7'2"
    attic: { l: 30, w: 92, h: 31 },           // 2'6" × 7'8" × 2'7"
  },
  {
    id: '20', name: '20 ft', label: '20 ft truck', cuft: 1016,
    deck: { l: 202, w: 92, h: 86 },           // 16'10" deck × 7'8" × 7'2"
    attic: { l: 30, w: 92, h: 31 },
  },
  {
    id: '26', name: '26 ft', label: '26 ft truck', cuft: 1682,
    deck: { l: 281, w: 98, h: 99 },           // 23'5" deck × 8'2" × 8'3"
    attic: { l: 32, w: 98, h: 39 },           // 2'8" × 8'2" × 3'3"
  },
];

// orient: 'upright' keeps the item's height vertical (it may still turn on the floor);
//         'any' lets the packer stand it on end or lay it down, the way movers do with sofas.
// stack:  whether other things may be set on top of it.
// attic:  small and light enough for the over-cab space.
export const CATEGORIES = [
  { id: 'living', name: 'Living room' },
  { id: 'bedroom', name: 'Bedroom' },
  { id: 'kitchen', name: 'Kitchen & laundry' },
  { id: 'office', name: 'Office' },
  { id: 'boxes', name: 'Boxes & bins' },
  { id: 'misc', name: 'Everything else' },
];

export const PRESETS = [
  { id: 'sofa', cat: 'living', name: 'Sofa (3-seat)', l: 84, w: 38, h: 34, lbs: 120, orient: 'any', stack: true },
  { id: 'loveseat', cat: 'living', name: 'Loveseat', l: 64, w: 36, h: 34, lbs: 90, orient: 'any', stack: true },
  { id: 'armchair', cat: 'living', name: 'Armchair', l: 36, w: 34, h: 34, lbs: 60, orient: 'upright', stack: true },
  { id: 'coffee', cat: 'living', name: 'Coffee table', l: 48, w: 24, h: 18, lbs: 40, orient: 'any', stack: true },
  { id: 'tvstand', cat: 'living', name: 'TV stand', l: 60, w: 18, h: 24, lbs: 60, orient: 'upright', stack: true },
  { id: 'tv', cat: 'living', name: 'TV 65" (boxed)', l: 62, w: 8, h: 38, lbs: 60, orient: 'upright', stack: false },
  { id: 'bookshelf', cat: 'living', name: 'Bookshelf', l: 32, w: 12, h: 72, lbs: 60, orient: 'any', stack: true },
  { id: 'lamp', cat: 'living', name: 'Floor lamp', l: 12, w: 12, h: 60, lbs: 10, orient: 'any', stack: false },
  { id: 'rug', cat: 'living', name: 'Rug (rolled)', l: 96, w: 12, h: 12, lbs: 30, orient: 'any', stack: true },

  { id: 'queen', cat: 'bedroom', name: 'Queen mattress', l: 80, w: 60, h: 12, lbs: 80, orient: 'any', stack: false },
  { id: 'king', cat: 'bedroom', name: 'King mattress', l: 80, w: 76, h: 12, lbs: 100, orient: 'any', stack: false },
  { id: 'twin', cat: 'bedroom', name: 'Twin mattress', l: 75, w: 38, h: 10, lbs: 45, orient: 'any', stack: false },
  { id: 'boxspring', cat: 'bedroom', name: 'Queen box spring', l: 80, w: 60, h: 9, lbs: 50, orient: 'any', stack: false },
  { id: 'frame', cat: 'bedroom', name: 'Bed frame (flat)', l: 82, w: 20, h: 12, lbs: 70, orient: 'any', stack: true },
  { id: 'dresser', cat: 'bedroom', name: 'Dresser', l: 60, w: 20, h: 34, lbs: 150, orient: 'upright', stack: true },
  { id: 'nightstand', cat: 'bedroom', name: 'Nightstand', l: 24, w: 18, h: 26, lbs: 35, orient: 'upright', stack: true },
  { id: 'mirror', cat: 'bedroom', name: 'Mirror (boxed)', l: 40, w: 6, h: 30, lbs: 25, orient: 'upright', stack: false },

  { id: 'fridge', cat: 'kitchen', name: 'Refrigerator', l: 30, w: 34, h: 70, lbs: 250, orient: 'upright', stack: false },
  { id: 'washer', cat: 'kitchen', name: 'Washer', l: 27, w: 28, h: 38, lbs: 170, orient: 'upright', stack: true },
  { id: 'dryer', cat: 'kitchen', name: 'Dryer', l: 27, w: 28, h: 38, lbs: 120, orient: 'upright', stack: true },
  { id: 'table', cat: 'kitchen', name: 'Dining table', l: 72, w: 40, h: 30, lbs: 100, orient: 'any', stack: true },
  { id: 'chair', cat: 'kitchen', name: 'Dining chair', l: 18, w: 20, h: 38, lbs: 15, orient: 'upright', stack: false },
  { id: 'microwave', cat: 'kitchen', name: 'Microwave', l: 22, w: 16, h: 13, lbs: 35, orient: 'upright', stack: true, attic: true },

  { id: 'desk', cat: 'office', name: 'Desk', l: 48, w: 24, h: 30, lbs: 70, orient: 'any', stack: true },
  { id: 'officechair', cat: 'office', name: 'Office chair', l: 26, w: 26, h: 40, lbs: 35, orient: 'upright', stack: false },
  { id: 'filing', cat: 'office', name: 'Filing cabinet', l: 15, w: 25, h: 28, lbs: 60, orient: 'upright', stack: true },
  { id: 'monitor', cat: 'office', name: 'Monitor (boxed)', l: 30, w: 8, h: 20, lbs: 15, orient: 'upright', stack: false, attic: true },

  { id: 'box-s', cat: 'boxes', name: 'Small box', l: 16, w: 12, h: 12, lbs: 25, orient: 'any', stack: true, attic: true, box: true },
  { id: 'box-m', cat: 'boxes', name: 'Medium box', l: 18, w: 18, h: 16, lbs: 35, orient: 'any', stack: true, attic: true, box: true },
  { id: 'box-l', cat: 'boxes', name: 'Large box', l: 18, w: 18, h: 24, lbs: 40, orient: 'any', stack: true, attic: true, box: true },
  { id: 'dishpack', cat: 'boxes', name: 'Dish pack', l: 18, w: 18, h: 28, lbs: 60, orient: 'upright', stack: true, box: true },
  { id: 'wardrobe', cat: 'boxes', name: 'Wardrobe box', l: 24, w: 21, h: 46, lbs: 50, orient: 'upright', stack: false, box: true },
  { id: 'tote', cat: 'boxes', name: 'Plastic tote', l: 27, w: 17, h: 12, lbs: 30, orient: 'upright', stack: true, attic: true, box: true },

  { id: 'bike', cat: 'misc', name: 'Bicycle', l: 68, w: 24, h: 42, lbs: 30, orient: 'upright', stack: false },
  { id: 'grill', cat: 'misc', name: 'Grill', l: 48, w: 24, h: 44, lbs: 60, orient: 'upright', stack: false },
  { id: 'suitcase', cat: 'misc', name: 'Suitcase', l: 28, w: 18, h: 12, lbs: 40, orient: 'any', stack: true, attic: true },
  { id: 'vacuum', cat: 'misc', name: 'Vacuum', l: 14, w: 12, h: 44, lbs: 15, orient: 'any', stack: false, attic: true },
];

export const HOMES = [
  {
    id: 'studio', name: 'Studio',
    counts: { loveseat: 1, coffee: 1, tvstand: 1, tv: 1, queen: 1, frame: 1, dresser: 1, nightstand: 1,
      desk: 1, officechair: 1, 'box-s': 8, 'box-m': 8, 'box-l': 4, wardrobe: 1, suitcase: 2, vacuum: 1 },
  },
  {
    id: 'one', name: '1 bedroom',
    counts: { sofa: 1, armchair: 1, coffee: 1, tvstand: 1, tv: 1, bookshelf: 1, lamp: 1, rug: 1,
      queen: 1, boxspring: 1, frame: 1, dresser: 1, nightstand: 2, mirror: 1,
      table: 1, chair: 4, microwave: 1, desk: 1, officechair: 1,
      'box-s': 15, 'box-m': 15, 'box-l': 6, dishpack: 2, wardrobe: 2, tote: 4, bike: 1, suitcase: 2, vacuum: 1 },
  },
  {
    id: 'two', name: '2 bedroom',
    counts: { sofa: 1, loveseat: 1, armchair: 1, coffee: 1, tvstand: 1, tv: 1, bookshelf: 2, lamp: 2, rug: 2,
      queen: 1, twin: 1, boxspring: 1, frame: 2, dresser: 2, nightstand: 3, mirror: 1,
      table: 1, chair: 4, microwave: 1, washer: 1, dryer: 1, desk: 1, officechair: 1, filing: 1, monitor: 1,
      'box-s': 25, 'box-m': 25, 'box-l': 10, dishpack: 3, wardrobe: 3, tote: 6, bike: 2, grill: 1, suitcase: 3, vacuum: 1 },
  },
];

export const presetById = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
