/* Protein Structure Visualizer dataset & copy — src/components/protein/proteinData.js
 *
 * Everything text-based lives here: the demo sequence, the amino acid
 * lookup table, secondary-structure regions, tertiary interaction call-outs,
 * quaternary subunit labels, and the four "What's happening / Why it
 * matters / Key concept" panels. Nothing else in this feature needs to
 * change to reword copy or swap the example sequence.
 *
 * Kept separate from src/data/themes.js on purpose (same reasoning as
 * periodicTable.js) -- this is fixed reference content, not theme data.
 */

// Full 20 standard amino acids, keyed by 1-letter code. `cat` drives both the
// legend and the bead color mapping in PrimaryStructure.
export const AMINO_ACIDS = {
  A: { name: "Alanine", code3: "Ala", cat: "nonpolar" },
  R: { name: "Arginine", code3: "Arg", cat: "basic" },
  N: { name: "Asparagine", code3: "Asn", cat: "polar" },
  D: { name: "Aspartic acid", code3: "Asp", cat: "acidic" },
  C: { name: "Cysteine", code3: "Cys", cat: "special" },
  E: { name: "Glutamic acid", code3: "Glu", cat: "acidic" },
  Q: { name: "Glutamine", code3: "Gln", cat: "polar" },
  G: { name: "Glycine", code3: "Gly", cat: "special" },
  H: { name: "Histidine", code3: "His", cat: "basic" },
  I: { name: "Isoleucine", code3: "Ile", cat: "nonpolar" },
  L: { name: "Leucine", code3: "Leu", cat: "nonpolar" },
  K: { name: "Lysine", code3: "Lys", cat: "basic" },
  M: { name: "Methionine", code3: "Met", cat: "nonpolar" },
  F: { name: "Phenylalanine", code3: "Phe", cat: "nonpolar" },
  P: { name: "Proline", code3: "Pro", cat: "special" },
  S: { name: "Serine", code3: "Ser", cat: "polar" },
  T: { name: "Threonine", code3: "Thr", cat: "polar" },
  W: { name: "Tryptophan", code3: "Trp", cat: "nonpolar" },
  Y: { name: "Tyrosine", code3: "Tyr", cat: "polar" },
  V: { name: "Valine", code3: "Val", cat: "nonpolar" },
};

export const CATEGORY_META = {
  nonpolar: { label: "Nonpolar", swatch: "var(--p1)" },
  polar: { label: "Polar", swatch: "var(--p2)" },
  acidic: { label: "Acidic (–)", swatch: "var(--p3)" },
  basic: { label: "Basic (+)", swatch: "var(--p4)" },
  special: { label: "Special", swatch: "var(--p5)" },
};

// A short illustrative sequence -- not a real protein fragment, just chosen
// so every category above appears at least once for the legend to make sense.
export const SEQUENCE = "MVLKSAERTCGWHYPQNID".split("");

// Secondary structure: which stretch of the demo sequence (by index, inclusive)
// folds into which motif. Purely illustrative positions for the diagram.
export const SECONDARY_REGIONS = [
  { kind: "helix", from: 0, to: 6, label: "α-Helix region" },
  { kind: "coil", from: 7, to: 8, label: "Loop" },
  { kind: "sheet", from: 9, to: 13, label: "β-Sheet region" },
  { kind: "coil", from: 14, to: 18, label: "Loop" },
];

// Tertiary structure: clickable interaction call-outs on the folded backbone.
// `t` is the position along the tube (0-1) used to place the marker.
export const INTERACTIONS = [
  {
    id: "hbond",
    label: "Hydrogen bond",
    t: 0.14,
    color: "var(--p2)",
    explanation: "A weak attraction between an N–H and a C=O group elsewhere in the chain. Hydrogen bonds are individually weak but there are many of them, so together they hold the backbone's folded shape in place.",
  },
  {
    id: "disulfide",
    label: "Disulfide bridge",
    t: 0.38,
    color: "var(--p5)",
    explanation: "A covalent S–S bond that forms between two Cysteine residues once the chain folds close enough. Unlike most tertiary interactions this one is a real chemical bond, so it locks the fold together strongly.",
  },
  {
    id: "ionic",
    label: "Ionic interaction",
    t: 0.62,
    color: "var(--p4)",
    explanation: "An attraction between an oppositely charged pair of side chains -- an acidic (–) residue sitting near a basic (+) one. Strong in a dry environment, weaker once water gets involved.",
  },
  {
    id: "hydrophobic",
    label: "Hydrophobic interaction",
    t: 0.86,
    color: "var(--p1)",
    explanation: "Water-avoiding nonpolar side chains cluster together in the protein's interior, away from the watery surroundings. This clustering is actually the single biggest driver of how a protein folds in the first place.",
  },
];

// Quaternary structure: four subunits, each a differently-colored copy of the
// folded backbone, positioned around a shared center.
export const SUBUNITS = [
  { id: "a", label: "Subunit A", color: "var(--p1)", offset: [-1.1, 0.9, 0] },
  { id: "b", label: "Subunit B", color: "var(--p2)", offset: [1.1, 0.9, 0] },
  { id: "c", label: "Subunit C", color: "var(--p4)", offset: [-1.1, -0.9, 0] },
  { id: "d", label: "Subunit D", color: "var(--p5)", offset: [1.1, -0.9, 0] },
];

export const STEPS = [
  {
    id: "primary",
    label: "Primary",
    title: "Primary Structure",
    what: "A protein starts as one long chain of amino acids, linked head-to-tail by peptide bonds in a specific order.",
    why: "That order is set entirely by the gene that codes for it -- get one amino acid wrong and everything the protein folds into downstream can change.",
    key: "Sequence = identity. The order of amino acids is the one piece of information every higher level of structure is built from.",
  },
  {
    id: "secondary",
    label: "Secondary",
    title: "Secondary Structure",
    what: "Short local stretches of the chain settle into regular repeating shapes -- mainly the coiled α-helix and the flat, pleated β-sheet.",
    why: "Both shapes are held together by hydrogen bonds running along the backbone itself, not by the side chains -- so they form early, before the protein's final 3D shape is decided.",
    key: "Same rule, two shapes. Backbone N–H⋯O=C hydrogen bonding is what creates both the helix and the sheet -- only the pattern of bonding differs.",
  },
  {
    id: "tertiary",
    title: "Tertiary Structure",
    label: "Tertiary",
    what: "The whole chain, helices and sheets included, folds up into one compact 3D shape held together by side-chain interactions.",
    why: "This exact 3D shape is what gives a protein its function -- an enzyme's active site, an antibody's binding pocket, all of it depends on this fold.",
    key: "Four forces do the folding: hydrogen bonds, disulfide bridges, ionic interactions, and hydrophobic clustering. Tap a marker on the model to see each one.",
  },
  {
    id: "quaternary",
    label: "Quaternary",
    title: "Quaternary Structure",
    what: "Some proteins aren't finished at one folded chain -- several separately-folded subunits assemble together into one functional complex.",
    why: "Not every protein has this level (many work fine as a single chain), but for the ones that do, the complex often only works when every subunit is present and correctly assembled.",
    key: "Quaternary structure is optional. It's the only one of the four levels a protein can simply not have.",
  },
];
