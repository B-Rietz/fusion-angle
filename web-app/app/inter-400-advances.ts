// Inter's design grid: this many font units to the em.
export const INTER_400_UNITS_PER_EM = 2048;

// Inter 400's advance, in font units, for each character an
// edge label is sized by: printable ASCII, and the ellipsis
// truncation appends. Each is what Chrome sets the character
// at alone, which a browser test repeats; kerning is not
// modelled.
export const INTER_400_ADVANCES: ReadonlyMap<string, number> =
    new Map([
        [' ', 576],
        ['!', 589],
        ['"', 954],
        ['#', 1297],
        ['$', 1314],
        ['%', 2011],
        ['&', 1319],
        ['\'', 614],
        ['(', 747],
        [')', 747],
        ['*', 1026],
        ['+', 1355],
        [',', 590],
        ['-', 942],
        ['.', 590],
        ['/', 738],
        ['0', 1292],
        ['1', 833],
        ['2', 1249],
        ['3', 1265],
        ['4', 1323],
        ['5', 1215],
        ['6', 1270],
        ['7', 1159],
        ['8', 1267],
        ['9', 1270],
        [':', 590],
        [';', 618],
        ['<', 1355],
        ['=', 1355],
        ['>', 1355],
        ['?', 1047],
        ['@', 1978],
        ['A', 1413],
        ['B', 1340],
        ['C', 1496],
        ['D', 1478],
        ['E', 1231],
        ['F', 1209],
        ['G', 1528],
        ['H', 1522],
        ['I', 550],
        ['J', 1169],
        ['K', 1376],
        ['L', 1158],
        ['M', 1850],
        ['N', 1543],
        ['O', 1566],
        ['P', 1308],
        ['Q', 1566],
        ['R', 1318],
        ['S', 1314],
        ['T', 1322],
        ['U', 1524],
        ['V', 1413],
        ['W', 2018],
        ['X', 1397],
        ['Y', 1390],
        ['Z', 1288],
        ['[', 747],
        ['\\', 738],
        [']', 747],
        ['^', 965],
        ['_', 934],
        ['`', 661],
        ['a', 1150],
        ['b', 1254],
        ['c', 1170],
        ['d', 1254],
        ['e', 1194],
        ['f', 758],
        ['g', 1256],
        ['h', 1211],
        ['i', 496],
        ['j', 496],
        ['k', 1124],
        ['l', 496],
        ['m', 1794],
        ['n', 1210],
        ['o', 1228],
        ['p', 1254],
        ['q', 1254],
        ['r', 771],
        ['s', 1081],
        ['t', 670],
        ['u', 1211],
        ['v', 1151],
        ['w', 1676],
        ['x', 1118],
        ['y', 1151],
        ['z', 1131],
        ['{', 873],
        ['|', 681],
        ['}', 873],
        ['~', 1355],
        ['…', 1770],
    ]);

// Nothing here knows the width of a character outside the
// table, so it takes the widest one in it: a loose box
// over a tight one.
export const INTER_400_FALLBACK_ADVANCE = Math.max(
    ...INTER_400_ADVANCES.values(),
);

export function computeInter400TextWidth(
    text: string,
    fontSize: number,
): number {
    let units = 0;
    for (const character of text) {
        units += INTER_400_ADVANCES.get(character)
            ?? INTER_400_FALLBACK_ADVANCE;
    }
    return units * (fontSize / INTER_400_UNITS_PER_EM);
}
