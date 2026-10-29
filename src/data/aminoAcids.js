/* NCERT Chemistry Part II, Unit 10 (Biomolecules), Table 10.2 — Natural
 * Amino Acids. Kept as plain data (no JSX) so it can be reused anywhere
 * (table row, mobile card, future search/filter) without re-typing the
 * chemistry. `essential: true` marks the ten amino acids the book flags
 * with an asterisk (cannot be made by the body, must come from diet).
 * `wholeStructure: true` is just Proline — the book's footnote "a = entire
 * structure" means its R column is the whole molecule, not a side chain
 * hanging off the usual R-CH(NH2)-COOH pattern.
 */
export const AMINO_ACIDS = [
  { name: "Glycine", r: "H", three: "Gly", one: "G", essential: false },
  { name: "Alanine", r: "–CH₃", three: "Ala", one: "A", essential: false },
  { name: "Valine", r: "(H₃C)₂CH–", three: "Val", one: "V", essential: true },
  { name: "Leucine", r: "(H₃C)₂CH–CH₂–", three: "Leu", one: "L", essential: true },
  { name: "Isoleucine", r: "H₃C–CH₂–CH(CH₃)–", three: "Ile", one: "I", essential: true },
  { name: "Arginine", r: "HN=C(NH₂)–NH–(CH₂)₃–", three: "Arg", one: "R", essential: true },
  { name: "Lysine", r: "H₂N–(CH₂)₄–", three: "Lys", one: "K", essential: true },
  { name: "Glutamic acid", r: "HOOC–CH₂–CH₂–", three: "Glu", one: "E", essential: false },
  { name: "Aspartic acid", r: "HOOC–CH₂–", three: "Asp", one: "D", essential: false },
  { name: "Glutamine", r: "H₂N–CO–CH₂–CH₂–", three: "Gln", one: "Q", essential: false },
  { name: "Asparagine", r: "H₂N–CO–CH₂–", three: "Asn", one: "N", essential: false },
  { name: "Threonine", r: "H₃C–CH(OH)–", three: "Thr", one: "T", essential: true },
  { name: "Serine", r: "HO–CH₂–", three: "Ser", one: "S", essential: false },
  { name: "Cysteine", r: "HS–CH₂–", three: "Cys", one: "C", essential: false },
  { name: "Methionine", r: "H₃C–S–CH₂–CH₂–", three: "Met", one: "M", essential: true },
  { name: "Phenylalanine", r: "C₆H₅–CH₂–", three: "Phe", one: "F", essential: true },
  { name: "Tyrosine", r: "(p)HO–C₆H₄–CH₂–", three: "Tyr", one: "Y", essential: false },
  { name: "Tryptophan", r: "Indole ring–CH₂–", three: "Trp", one: "W", essential: true },
  { name: "Histidine", r: "Imidazole ring–CH₂–", three: "His", one: "H", essential: true },
  { name: "Proline", r: "Cyclic — whole molecule is the ring", three: "Pro", one: "P", essential: false, wholeStructure: true },
];

export const ESSENTIAL_COUNT = AMINO_ACIDS.filter((a) => a.essential).length;
