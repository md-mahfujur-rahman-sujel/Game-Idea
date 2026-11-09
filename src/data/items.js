// Item catalogue. IDs never change; display names are for order text only.

export const ITEMS = {
  peach: {
    id: 'peach', name: 'Peach', display: 'Peach', family: 'fruit',
    tint: 0xc98e7e, tint2: 0x9e5f55, form: 'fruit',
  },
  apple: {
    id: 'apple', name: 'Apple', display: 'Apple', family: 'fruit',
    tint: 0x9e4b4f, tint2: 0x6e3438, form: 'fruit',
  },
  teaLeaf: {
    id: 'teaLeaf', name: 'Tea Leaves', display: 'Tea Leaves', family: 'teaLeaf',
    tint: 0x708549, tint2: 0x4d5a2a, form: 'leaf',
  },
  water: {
    id: 'water', name: 'Water', display: 'Water', family: 'water',
    tint: 0x6da8e1, tint2: 0x4972a3, form: 'drop',
  },
  cream: {
    id: 'cream', name: 'Cream', display: 'Cream', family: 'cream',
    tint: 0xf2e9d4, tint2: 0xcbbb9c, form: 'cream',
  },
  washedPeach: {
    id: 'washedPeach', name: 'Washed Peach', display: 'Peach Cup', family: 'washed',
    tint: 0xd9a18c, tint2: 0x9e5f55, form: 'washed',
  },
  washedApple: {
    id: 'washedApple', name: 'Washed Apple', display: 'Apple Cup', family: 'washed',
    tint: 0xb46a6c, tint2: 0x6e3438, form: 'washed',
  },
  peachBase: {
    id: 'peachBase', name: 'Peach Base', display: 'Peach Puree Cup', family: 'base',
    tint: 0xc98e7e, tint2: 0x8e4f53, form: 'jar',
  },
  appleBase: {
    id: 'appleBase', name: 'Apple Base', display: 'Apple Puree Cup', family: 'base',
    tint: 0xa85c60, tint2: 0x6e3438, form: 'jar',
  },
  brewedTea: {
    id: 'brewedTea', name: 'Brewed Tea', display: 'Brewed Tea', family: 'tea',
    tint: 0xa4ab46, tint2: 0x6e7428, form: 'cup',
  },
  peachMix: {
    id: 'peachMix', name: 'Peach Ice Cream Mix', display: 'Peach Mix', family: 'mix',
    tint: 0xddb3a0, tint2: 0xb58372, form: 'mix',
  },
  appleMix: {
    id: 'appleMix', name: 'Apple Ice Cream Mix', display: 'Apple Mix', family: 'mix',
    tint: 0xc79b95, tint2: 0x8e4f53, form: 'mix',
  },
  tub: {
    id: 'tub', name: 'Ice Cream Tub', display: 'Ice Cream Tub', family: 'tub',
    tint: 0xadc1be, tint2: 0x6f918a, form: 'tub', chilled: true,
  },
  melted: {
    id: 'melted', name: 'Melted Mix', display: 'Melted Mix', family: 'melted',
    tint: 0xd7e3e0, tint2: 0xa3bdb6, form: 'melted',
  },
};

export const FAMILIES = {
  anyFruit: { id: 'anyFruit', label: 'Any fruit', accepts: ['peach', 'apple'] },
  anyWashed: { id: 'anyWashed', label: 'Any washed fruit', accepts: ['washedPeach', 'washedApple'] },
  anyBase: { id: 'anyBase', label: 'Any fruit base', accepts: ['peachBase', 'appleBase'] },
  mixFamily: { id: 'mixFamily', label: 'Ice cream mix', accepts: ['peachMix', 'appleMix', 'melted'] },
  counter: {
    id: 'counter', label: 'Counter items',
    accepts: ['washedPeach', 'washedApple', 'peachBase', 'appleBase', 'brewedTea', 'tub'],
  },
  teaLeaf: { id: 'teaLeaf', label: 'Tea leaves', accepts: ['teaLeaf'] },
  water: { id: 'water', label: 'Water', accepts: ['water'] },
  cream: { id: 'cream', label: 'Cream', accepts: ['cream'] },
  fruit: { id: 'fruit', label: 'Any fruit', accepts: ['peach', 'apple'] },
  washed: { id: 'washed', label: 'Any washed fruit', accepts: ['washedPeach', 'washedApple'] },
  base: { id: 'base', label: 'Any fruit base', accepts: ['peachBase', 'appleBase'] },
  mix: { id: 'mix', label: 'Ice cream mix', accepts: ['peachMix', 'appleMix', 'melted'] },
  tub: { id: 'tub', label: 'Ice cream tubs', accepts: ['tub'] },
  tea: { id: 'tea', label: 'Brewed tea', accepts: ['brewedTea'] },
  melted: { id: 'melted', label: 'Melted mix', accepts: ['melted'] },
};

export function itemName(type) {
  return ITEMS[type] ? ITEMS[type].name : type;
}

export function orderDisplayName(type) {
  const it = ITEMS[type];
  return it ? it.display : type;
}

export function familyAccepts(familyId, itemType) {
  const fam = FAMILIES[familyId];
  return !!fam && fam.accepts.includes(itemType);
}

export const FAMILY_ICON_ITEMS = {
  anyFruit: ['peach', 'apple'],
  anyWashed: ['washedPeach', 'washedApple'],
  anyBase: ['peachBase', 'appleBase'],
  mixFamily: ['peachMix', 'tub', 'melted'],
  counter: ['washedPeach', 'tub'],
};
