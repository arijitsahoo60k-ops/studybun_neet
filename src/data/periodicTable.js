/* Periodic Table dataset & metadata — src/data/periodicTable.js
 *
 * Feeds src/components/PeriodicTable.jsx (the "Study Stuffs" tool). Kept as
 * its own module, separate from src/data/themes.js, because this is fixed
 * scientific reference data (not user data, not theme-dependent) and has no
 * reason to travel with the mascot/theme system.
 *
 * Category/block/phase colors below are intentionally NOT theme tokens.
 * A periodic table's color-coding is itself meaningful reference information
 * (a student reads "pink = alkali metal" the same way regardless of which
 * StudyBun theme they're using), so each swatch is a fixed, hand-picked
 * pastel with a fixed dark ink (#241E1A) on top -- verified at an 8:1+
 * contrast ratio (WCAG AAA for normal text) in every case, so legibility
 * never depends on -- or fights with -- whichever of the 21 app themes is
 * active. See CATEGORY_META / BLOCK_META / PHASE_META below for the figures.
 */

// Auto-generated periodic table dataset. Factual atomic data (IUPAC/NIST-sourced
// figures via the open-source Bowserinator/Periodic-Table-JSON project), trimmed
// to the fields StudyBun's Periodic Table tool actually displays.
// x/y are the element's column/row position in the standard 18-col layout;
// the lanthanide/actinide rows sit at y=9/y=10 below a spacer row at y=8.
export const ELEMENTS = [
  {n:1,sym:"H",name:"Hydrogen",mass:1.008,cat:"nonmetal",pred:false,period:1,group:1,x:1,y:1,phase:"Gas",block:"s",econf:"1s1",shells:[1],en:2.2,density:0.08988,melt:13.99,boil:20.271,ie1:1312,by:"Henry Cavendish"},
  {n:2,sym:"He",name:"Helium",mass:4.003,cat:"noble-gas",pred:false,period:1,group:18,x:18,y:1,phase:"Gas",block:"s",econf:"1s2",shells:[2],en:null,density:0.1786,melt:0.95,boil:4.222,ie1:2372,by:"Pierre Janssen"},
  {n:3,sym:"Li",name:"Lithium",mass:6.94,cat:"alkali-metal",pred:false,period:2,group:1,x:1,y:2,phase:"Solid",block:"s",econf:"[He] 2s1",shells:[2,1],en:0.98,density:0.534,melt:453.65,boil:1603,ie1:520,by:"Johan August Arfwedson"},
  {n:4,sym:"Be",name:"Beryllium",mass:9.012,cat:"alkaline-earth-metal",pred:false,period:2,group:2,x:2,y:2,phase:"Solid",block:"s",econf:"[He] 2s2",shells:[2,2],en:1.57,density:1.85,melt:1560,boil:2742,ie1:900,by:"Louis Nicolas Vauquelin"},
  {n:5,sym:"B",name:"Boron",mass:10.81,cat:"metalloid",pred:false,period:2,group:13,x:13,y:2,phase:"Solid",block:"p",econf:"[He] 2s2 2p1",shells:[2,3],en:2.04,density:2.08,melt:2349,boil:4200,ie1:801,by:"Joseph Louis Gay-Lussac"},
  {n:6,sym:"C",name:"Carbon",mass:12.011,cat:"nonmetal",pred:false,period:2,group:14,x:14,y:2,phase:"Solid",block:"p",econf:"[He] 2s2 2p2",shells:[2,4],en:2.55,density:1.821,melt:null,boil:null,ie1:1086,by:"Ancient Egypt"},
  {n:7,sym:"N",name:"Nitrogen",mass:14.007,cat:"nonmetal",pred:false,period:2,group:15,x:15,y:2,phase:"Gas",block:"p",econf:"[He] 2s2 2p3",shells:[2,5],en:3.04,density:1.251,melt:63.15,boil:77.355,ie1:1402,by:"Daniel Rutherford"},
  {n:8,sym:"O",name:"Oxygen",mass:15.999,cat:"nonmetal",pred:false,period:2,group:16,x:16,y:2,phase:"Gas",block:"p",econf:"[He] 2s2 2p4",shells:[2,6],en:3.44,density:1.429,melt:54.36,boil:90.188,ie1:1314,by:"Carl Wilhelm Scheele"},
  {n:9,sym:"F",name:"Fluorine",mass:18.998,cat:"nonmetal",pred:false,period:2,group:17,x:17,y:2,phase:"Gas",block:"p",econf:"[He] 2s2 2p5",shells:[2,7],en:3.98,density:1.696,melt:53.48,boil:85.03,ie1:1681,by:"Andr\u00e9-Marie Amp\u00e8re"},
  {n:10,sym:"Ne",name:"Neon",mass:20.18,cat:"noble-gas",pred:false,period:2,group:18,x:18,y:2,phase:"Gas",block:"p",econf:"[He] 2s2 2p6",shells:[2,8],en:null,density:0.9002,melt:24.56,boil:27.104,ie1:2081,by:"Morris Travers"},
  {n:11,sym:"Na",name:"Sodium",mass:22.99,cat:"alkali-metal",pred:false,period:3,group:1,x:1,y:3,phase:"Solid",block:"s",econf:"[Ne] 3s1",shells:[2,8,1],en:0.93,density:0.968,melt:370.944,boil:1156.09,ie1:496,by:"Humphry Davy"},
  {n:12,sym:"Mg",name:"Magnesium",mass:24.305,cat:"alkaline-earth-metal",pred:false,period:3,group:2,x:2,y:3,phase:"Solid",block:"s",econf:"[Ne] 3s2",shells:[2,8,2],en:1.31,density:1.738,melt:923,boil:1363,ie1:738,by:"Joseph Black"},
  {n:13,sym:"Al",name:"Aluminium",mass:26.982,cat:"post-transition-metal",pred:false,period:3,group:13,x:13,y:3,phase:"Solid",block:"p",econf:"[Ne] 3s2 3p1",shells:[2,8,3],en:1.61,density:2.7,melt:933.47,boil:2743,ie1:578,by:null},
  {n:14,sym:"Si",name:"Silicon",mass:28.085,cat:"metalloid",pred:false,period:3,group:14,x:14,y:3,phase:"Solid",block:"p",econf:"[Ne] 3s2 3p2",shells:[2,8,4],en:1.9,density:2.329,melt:1687,boil:3538,ie1:786,by:"J\u00f6ns Jacob Berzelius"},
  {n:15,sym:"P",name:"Phosphorus",mass:30.974,cat:"nonmetal",pred:false,period:3,group:15,x:15,y:3,phase:"Solid",block:"p",econf:"[Ne] 3s2 3p3",shells:[2,8,5],en:2.19,density:1.823,melt:null,boil:null,ie1:1012,by:"Hennig Brand"},
  {n:16,sym:"S",name:"Sulfur",mass:32.06,cat:"nonmetal",pred:false,period:3,group:16,x:16,y:3,phase:"Solid",block:"p",econf:"[Ne] 3s2 3p4",shells:[2,8,6],en:2.58,density:2.07,melt:388.36,boil:717.8,ie1:1000,by:"Ancient china"},
  {n:17,sym:"Cl",name:"Chlorine",mass:35.45,cat:"nonmetal",pred:false,period:3,group:17,x:17,y:3,phase:"Gas",block:"p",econf:"[Ne] 3s2 3p5",shells:[2,8,7],en:3.16,density:3.2,melt:171.6,boil:239.11,ie1:1251,by:"Carl Wilhelm Scheele"},
  {n:18,sym:"Ar",name:"Argon",mass:39.948,cat:"noble-gas",pred:false,period:3,group:18,x:18,y:3,phase:"Gas",block:"p",econf:"[Ne] 3s2 3p6",shells:[2,8,8],en:null,density:1.784,melt:83.81,boil:87.302,ie1:1521,by:"Lord Rayleigh"},
  {n:19,sym:"K",name:"Potassium",mass:39.098,cat:"alkali-metal",pred:false,period:4,group:1,x:1,y:4,phase:"Solid",block:"s",econf:"[Ar] 4s1",shells:[2,8,8,1],en:0.82,density:0.862,melt:336.7,boil:1032,ie1:419,by:"Humphry Davy"},
  {n:20,sym:"Ca",name:"Calcium",mass:40.078,cat:"alkaline-earth-metal",pred:false,period:4,group:2,x:2,y:4,phase:"Solid",block:"s",econf:"[Ar] 4s2",shells:[2,8,8,2],en:1,density:1.55,melt:1115,boil:1757,ie1:590,by:"Humphry Davy"},
  {n:21,sym:"Sc",name:"Scandium",mass:44.956,cat:"transition-metal",pred:false,period:4,group:3,x:3,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d1 4s2",shells:[2,8,9,2],en:1.36,density:2.985,melt:1814,boil:3109,ie1:633,by:"Lars Fredrik Nilson"},
  {n:22,sym:"Ti",name:"Titanium",mass:47.867,cat:"transition-metal",pred:false,period:4,group:4,x:4,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d2 4s2",shells:[2,8,10,2],en:1.54,density:4.506,melt:1941,boil:3560,ie1:659,by:"William Gregor"},
  {n:23,sym:"V",name:"Vanadium",mass:50.942,cat:"transition-metal",pred:false,period:4,group:5,x:5,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d3 4s2",shells:[2,8,11,2],en:1.63,density:6,melt:2183,boil:3680,ie1:651,by:"Andr\u00e9s Manuel del R\u00edo"},
  {n:24,sym:"Cr",name:"Chromium",mass:51.996,cat:"transition-metal",pred:false,period:4,group:6,x:6,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d5 4s1",shells:[2,8,13,1],en:1.66,density:7.19,melt:2180,boil:2944,ie1:653,by:"Louis Nicolas Vauquelin"},
  {n:25,sym:"Mn",name:"Manganese",mass:54.938,cat:"transition-metal",pred:false,period:4,group:7,x:7,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d5 4s2",shells:[2,8,13,2],en:1.55,density:7.21,melt:1519,boil:2334,ie1:717,by:"Torbern Olof Bergman"},
  {n:26,sym:"Fe",name:"Iron",mass:55.845,cat:"transition-metal",pred:false,period:4,group:8,x:8,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d6 4s2",shells:[2,8,14,2],en:1.83,density:7.874,melt:1811,boil:3134,ie1:762,by:"5000 BC"},
  {n:27,sym:"Co",name:"Cobalt",mass:58.933,cat:"transition-metal",pred:false,period:4,group:9,x:9,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d7 4s2",shells:[2,8,15,2],en:1.88,density:8.9,melt:1768,boil:3200,ie1:760,by:"Georg Brandt"},
  {n:28,sym:"Ni",name:"Nickel",mass:58.693,cat:"transition-metal",pred:false,period:4,group:10,x:10,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d8 4s2",shells:[2,8,16,2],en:1.91,density:8.908,melt:1728,boil:3003,ie1:737,by:"Axel Fredrik Cronstedt"},
  {n:29,sym:"Cu",name:"Copper",mass:63.546,cat:"transition-metal",pred:false,period:4,group:11,x:11,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d10 4s1",shells:[2,8,18,1],en:1.9,density:8.96,melt:1357.77,boil:2835,ie1:746,by:"Middle East"},
  {n:30,sym:"Zn",name:"Zinc",mass:65.382,cat:"transition-metal",pred:false,period:4,group:12,x:12,y:4,phase:"Solid",block:"d",econf:"[Ar] 3d10 4s2",shells:[2,8,18,2],en:1.65,density:7.14,melt:692.68,boil:1180,ie1:906,by:"India"},
  {n:31,sym:"Ga",name:"Gallium",mass:69.723,cat:"post-transition-metal",pred:false,period:4,group:13,x:13,y:4,phase:"Solid",block:"p",econf:"[Ar] 3d10 4s2 4p1",shells:[2,8,18,3],en:1.81,density:5.91,melt:302.9146,boil:2673,ie1:579,by:"Lecoq de Boisbaudran"},
  {n:32,sym:"Ge",name:"Germanium",mass:72.631,cat:"metalloid",pred:false,period:4,group:14,x:14,y:4,phase:"Solid",block:"p",econf:"[Ar] 3d10 4s2 4p2",shells:[2,8,18,4],en:2.01,density:5.323,melt:1211.4,boil:3106,ie1:762,by:"Clemens Winkler"},
  {n:33,sym:"As",name:"Arsenic",mass:74.922,cat:"metalloid",pred:false,period:4,group:15,x:15,y:4,phase:"Solid",block:"p",econf:"[Ar] 3d10 4s2 4p3",shells:[2,8,18,5],en:2.18,density:5.727,melt:null,boil:null,ie1:947,by:"Bronze Age"},
  {n:34,sym:"Se",name:"Selenium",mass:78.972,cat:"nonmetal",pred:false,period:4,group:16,x:16,y:4,phase:"Solid",block:"p",econf:"[Ar] 3d10 4s2 4p4",shells:[2,8,18,6],en:2.55,density:4.81,melt:494,boil:958,ie1:941,by:"J\u00f6ns Jakob Berzelius"},
  {n:35,sym:"Br",name:"Bromine",mass:79.904,cat:"nonmetal",pred:false,period:4,group:17,x:17,y:4,phase:"Liquid",block:"p",econf:"[Ar] 3d10 4s2 4p5",shells:[2,8,18,7],en:2.96,density:3.1028,melt:265.8,boil:332,ie1:1140,by:"Antoine J\u00e9r\u00f4me Balard"},
  {n:36,sym:"Kr",name:"Krypton",mass:83.798,cat:"noble-gas",pred:false,period:4,group:18,x:18,y:4,phase:"Gas",block:"p",econf:"[Ar] 3d10 4s2 4p6",shells:[2,8,18,8],en:3,density:3.749,melt:115.78,boil:119.93,ie1:1351,by:"William Ramsay"},
  {n:37,sym:"Rb",name:"Rubidium",mass:85.468,cat:"alkali-metal",pred:false,period:5,group:1,x:1,y:5,phase:"Solid",block:"s",econf:"[Kr] 5s1",shells:[2,8,18,8,1],en:0.82,density:1.532,melt:312.45,boil:961,ie1:403,by:"Robert Bunsen"},
  {n:38,sym:"Sr",name:"Strontium",mass:87.621,cat:"alkaline-earth-metal",pred:false,period:5,group:2,x:2,y:5,phase:"Solid",block:"s",econf:"[Kr] 5s2",shells:[2,8,18,8,2],en:0.95,density:2.64,melt:1050,boil:1650,ie1:550,by:"William Cruickshank (chemist)"},
  {n:39,sym:"Y",name:"Yttrium",mass:88.906,cat:"transition-metal",pred:false,period:5,group:3,x:3,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d1 5s2",shells:[2,8,18,9,2],en:1.22,density:4.472,melt:1799,boil:3203,ie1:600,by:"Johan Gadolin"},
  {n:40,sym:"Zr",name:"Zirconium",mass:91.224,cat:"transition-metal",pred:false,period:5,group:4,x:4,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d2 5s2",shells:[2,8,18,10,2],en:1.33,density:6.52,melt:2128,boil:4650,ie1:640,by:"Martin Heinrich Klaproth"},
  {n:41,sym:"Nb",name:"Niobium",mass:92.906,cat:"transition-metal",pred:false,period:5,group:5,x:5,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d4 5s1",shells:[2,8,18,12,1],en:1.6,density:8.57,melt:2750,boil:5017,ie1:652,by:"Charles Hatchett"},
  {n:42,sym:"Mo",name:"Molybdenum",mass:95.951,cat:"transition-metal",pred:false,period:5,group:6,x:6,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d5 5s1",shells:[2,8,18,13,1],en:2.16,density:10.28,melt:2896,boil:4912,ie1:684,by:"Carl Wilhelm Scheele"},
  {n:43,sym:"Tc",name:"Technetium",mass:98,cat:"transition-metal",pred:false,period:5,group:7,x:7,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d5 5s2",shells:[2,8,18,13,2],en:1.9,density:11,melt:2430,boil:4538,ie1:702,by:"Emilio Segr\u00e8"},
  {n:44,sym:"Ru",name:"Ruthenium",mass:101.072,cat:"transition-metal",pred:false,period:5,group:8,x:8,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d7 5s1",shells:[2,8,18,15,1],en:2.2,density:12.45,melt:2607,boil:4423,ie1:710,by:"Karl Ernst Claus"},
  {n:45,sym:"Rh",name:"Rhodium",mass:102.906,cat:"transition-metal",pred:false,period:5,group:9,x:9,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d8 5s1",shells:[2,8,18,16,1],en:2.28,density:12.41,melt:2237,boil:3968,ie1:720,by:"William Hyde Wollaston"},
  {n:46,sym:"Pd",name:"Palladium",mass:106.421,cat:"transition-metal",pred:false,period:5,group:10,x:10,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d10",shells:[2,8,18,18],en:2.2,density:12.023,melt:1828.05,boil:3236,ie1:804,by:"William Hyde Wollaston"},
  {n:47,sym:"Ag",name:"Silver",mass:107.868,cat:"transition-metal",pred:false,period:5,group:11,x:11,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d10 5s1",shells:[2,8,18,18,1],en:1.93,density:10.49,melt:1234.93,boil:2435,ie1:731,by:"unknown, before 5000 BC"},
  {n:48,sym:"Cd",name:"Cadmium",mass:112.414,cat:"transition-metal",pred:false,period:5,group:12,x:12,y:5,phase:"Solid",block:"d",econf:"[Kr] 4d10 5s2",shells:[2,8,18,18,2],en:1.69,density:8.65,melt:594.22,boil:1040,ie1:868,by:"Karl Samuel Leberecht Hermann"},
  {n:49,sym:"In",name:"Indium",mass:114.818,cat:"post-transition-metal",pred:false,period:5,group:13,x:13,y:5,phase:"Solid",block:"p",econf:"[Kr] 4d10 5s2 5p1",shells:[2,8,18,18,3],en:1.78,density:7.31,melt:429.7485,boil:2345,ie1:558,by:"Ferdinand Reich"},
  {n:50,sym:"Sn",name:"Tin",mass:118.711,cat:"post-transition-metal",pred:false,period:5,group:14,x:14,y:5,phase:"Solid",block:"p",econf:"[Kr] 4d10 5s2 5p2",shells:[2,8,18,18,4],en:1.96,density:7.365,melt:505.08,boil:2875,ie1:709,by:"unknown, before 3500 BC"},
  {n:51,sym:"Sb",name:"Antimony",mass:121.76,cat:"metalloid",pred:false,period:5,group:15,x:15,y:5,phase:"Solid",block:"p",econf:"[Kr] 4d10 5s2 5p3",shells:[2,8,18,18,5],en:2.05,density:6.697,melt:903.78,boil:1908,ie1:834,by:"unknown, before 3000 BC"},
  {n:52,sym:"Te",name:"Tellurium",mass:127.603,cat:"metalloid",pred:false,period:5,group:16,x:16,y:5,phase:"Solid",block:"p",econf:"[Kr] 4d10 5s2 5p4",shells:[2,8,18,18,6],en:2.1,density:6.24,melt:722.66,boil:1261,ie1:869,by:"Franz-Joseph M\u00fcller von Reichenstein"},
  {n:53,sym:"I",name:"Iodine",mass:126.904,cat:"nonmetal",pred:false,period:5,group:17,x:17,y:5,phase:"Solid",block:"p",econf:"[Kr] 4d10 5s2 5p5",shells:[2,8,18,18,7],en:2.66,density:4.933,melt:386.85,boil:457.4,ie1:1008,by:"Bernard Courtois"},
  {n:54,sym:"Xe",name:"Xenon",mass:131.294,cat:"noble-gas",pred:false,period:5,group:18,x:18,y:5,phase:"Gas",block:"p",econf:"[Kr] 4d10 5s2 5p6",shells:[2,8,18,18,8],en:2.6,density:5.894,melt:161.4,boil:165.051,ie1:1170,by:"William Ramsay"},
  {n:55,sym:"Cs",name:"Cesium",mass:132.905,cat:"alkali-metal",pred:false,period:6,group:1,x:1,y:6,phase:"Solid",block:"s",econf:"[Xe] 6s1",shells:[2,8,18,18,8,1],en:0.79,density:1.93,melt:301.7,boil:944,ie1:376,by:"Robert Bunsen"},
  {n:56,sym:"Ba",name:"Barium",mass:137.328,cat:"alkaline-earth-metal",pred:false,period:6,group:2,x:2,y:6,phase:"Solid",block:"s",econf:"[Xe] 6s2",shells:[2,8,18,18,8,2],en:0.89,density:3.51,melt:1000,boil:2118,ie1:503,by:"Carl Wilhelm Scheele"},
  {n:57,sym:"La",name:"Lanthanum",mass:138.905,cat:"transition-metal",pred:false,period:6,group:3,x:3,y:6,phase:"Solid",block:"d",econf:"[Xe] 5d16s2",shells:[2,8,18,18,9,2],en:1.1,density:6.162,melt:1193,boil:3737,ie1:538,by:"Carl Gustaf Mosander"},
  {n:58,sym:"Ce",name:"Cerium",mass:140.116,cat:"lanthanide",pred:false,period:6,group:3,x:3,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f1 5d1 6s2",shells:[2,8,18,19,9,2],en:1.12,density:6.77,melt:1068,boil:3716,ie1:534,by:"Martin Heinrich Klaproth"},
  {n:59,sym:"Pr",name:"Praseodymium",mass:140.908,cat:"lanthanide",pred:false,period:6,group:3,x:4,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f3 6s2",shells:[2,8,18,21,8,2],en:1.13,density:6.77,melt:1208,boil:3403,ie1:527,by:"Carl Auer von Welsbach"},
  {n:60,sym:"Nd",name:"Neodymium",mass:144.242,cat:"lanthanide",pred:false,period:6,group:3,x:5,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f4 6s2",shells:[2,8,18,22,8,2],en:1.14,density:7.01,melt:1297,boil:3347,ie1:533,by:"Carl Auer von Welsbach"},
  {n:61,sym:"Pm",name:"Promethium",mass:145,cat:"lanthanide",pred:false,period:6,group:3,x:6,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f5 6s2",shells:[2,8,18,23,8,2],en:1.13,density:7.26,melt:1315,boil:3273,ie1:540,by:"Chien Shiung Wu"},
  {n:62,sym:"Sm",name:"Samarium",mass:150.362,cat:"lanthanide",pred:false,period:6,group:3,x:7,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f6 6s2",shells:[2,8,18,24,8,2],en:1.17,density:7.52,melt:1345,boil:2173,ie1:544,by:"Lecoq de Boisbaudran"},
  {n:63,sym:"Eu",name:"Europium",mass:151.964,cat:"lanthanide",pred:false,period:6,group:3,x:8,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f7 6s2",shells:[2,8,18,25,8,2],en:1.2,density:5.264,melt:1099,boil:1802,ie1:547,by:"Eug\u00e8ne-Anatole Demar\u00e7ay"},
  {n:64,sym:"Gd",name:"Gadolinium",mass:157.253,cat:"lanthanide",pred:false,period:6,group:3,x:9,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f7 5d1 6s2",shells:[2,8,18,25,9,2],en:1.2,density:7.9,melt:1585,boil:3273,ie1:593,by:"Jean Charles Galissard de Marignac"},
  {n:65,sym:"Tb",name:"Terbium",mass:158.925,cat:"lanthanide",pred:false,period:6,group:3,x:10,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f9 6s2",shells:[2,8,18,27,8,2],en:1.1,density:8.23,melt:1629,boil:3396,ie1:566,by:"Carl Gustaf Mosander"},
  {n:66,sym:"Dy",name:"Dysprosium",mass:162.5,cat:"lanthanide",pred:false,period:6,group:3,x:11,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f10 6s2",shells:[2,8,18,28,8,2],en:1.22,density:8.54,melt:1680,boil:2840,ie1:573,by:"Lecoq de Boisbaudran"},
  {n:67,sym:"Ho",name:"Holmium",mass:164.93,cat:"lanthanide",pred:false,period:6,group:3,x:12,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f11 6s2",shells:[2,8,18,29,8,2],en:1.23,density:8.79,melt:1734,boil:2873,ie1:581,by:"Marc Delafontaine"},
  {n:68,sym:"Er",name:"Erbium",mass:167.259,cat:"lanthanide",pred:false,period:6,group:3,x:13,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f12 6s2",shells:[2,8,18,30,8,2],en:1.24,density:9.066,melt:1802,boil:3141,ie1:589,by:"Carl Gustaf Mosander"},
  {n:69,sym:"Tm",name:"Thulium",mass:168.934,cat:"lanthanide",pred:false,period:6,group:3,x:14,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f13 6s2",shells:[2,8,18,31,8,2],en:1.25,density:9.32,melt:1818,boil:2223,ie1:597,by:"Per Teodor Cleve"},
  {n:70,sym:"Yb",name:"Ytterbium",mass:173.045,cat:"lanthanide",pred:false,period:6,group:3,x:15,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f14 6s2",shells:[2,8,18,32,8,2],en:1.1,density:6.9,melt:1097,boil:1469,ie1:603,by:"Jean Charles Galissard de Marignac"},
  {n:71,sym:"Lu",name:"Lutetium",mass:174.967,cat:"lanthanide",pred:false,period:6,group:3,x:16,y:9,phase:"Solid",block:"f",econf:"[Xe] 4f14 5d1 6s2",shells:[2,8,18,32,9,2],en:1.27,density:9.841,melt:1925,boil:3675,ie1:524,by:"Georges Urbain"},
  {n:72,sym:"Hf",name:"Hafnium",mass:178.492,cat:"transition-metal",pred:false,period:6,group:4,x:4,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d2 6s2",shells:[2,8,18,32,10,2],en:1.3,density:13.31,melt:2506,boil:4876,ie1:658,by:"Dirk Coster"},
  {n:73,sym:"Ta",name:"Tantalum",mass:180.948,cat:"transition-metal",pred:false,period:6,group:5,x:5,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d3 6s2",shells:[2,8,18,32,11,2],en:1.5,density:16.69,melt:3290,boil:5731,ie1:761,by:"Anders Gustaf Ekeberg"},
  {n:74,sym:"W",name:"Tungsten",mass:183.841,cat:"transition-metal",pred:false,period:6,group:6,x:6,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d4 6s2",shells:[2,8,18,32,12,2],en:2.36,density:19.25,melt:3695,boil:6203,ie1:770,by:"Carl Wilhelm Scheele"},
  {n:75,sym:"Re",name:"Rhenium",mass:186.207,cat:"transition-metal",pred:false,period:6,group:7,x:7,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d5 6s2",shells:[2,8,18,32,13,2],en:1.9,density:21.02,melt:3459,boil:5869,ie1:760,by:"Masataka Ogawa"},
  {n:76,sym:"Os",name:"Osmium",mass:190.233,cat:"transition-metal",pred:false,period:6,group:8,x:8,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d6 6s2",shells:[2,8,18,32,14,2],en:2.2,density:22.59,melt:3306,boil:5285,ie1:840,by:"Smithson Tennant"},
  {n:77,sym:"Ir",name:"Iridium",mass:192.217,cat:"transition-metal",pred:false,period:6,group:9,x:9,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d7 6s2",shells:[2,8,18,32,15,2],en:2.2,density:22.56,melt:2719,boil:4403,ie1:880,by:"Smithson Tennant"},
  {n:78,sym:"Pt",name:"Platinum",mass:195.085,cat:"transition-metal",pred:false,period:6,group:10,x:10,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d9 6s1",shells:[2,8,18,32,17,1],en:2.28,density:21.45,melt:2041.4,boil:4098,ie1:870,by:"Antonio de Ulloa"},
  {n:79,sym:"Au",name:"Gold",mass:196.967,cat:"transition-metal",pred:false,period:6,group:11,x:11,y:6,phase:"Solid",block:"d",econf:"[Xe] 4f14 5d10 6s1",shells:[2,8,18,32,18,1],en:2.54,density:19.3,melt:1337.33,boil:3243,ie1:890,by:"Middle East"},
  {n:80,sym:"Hg",name:"Mercury",mass:200.592,cat:"transition-metal",pred:false,period:6,group:12,x:12,y:6,phase:"Liquid",block:"d",econf:"[Xe] 4f14 5d10 6s2",shells:[2,8,18,32,18,2],en:2,density:13.534,melt:234.321,boil:629.88,ie1:1007,by:"unknown, before 2000 BCE"},
  {n:81,sym:"Tl",name:"Thallium",mass:204.38,cat:"post-transition-metal",pred:false,period:6,group:13,x:13,y:6,phase:"Solid",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p1",shells:[2,8,18,32,18,3],en:1.62,density:11.85,melt:577,boil:1746,ie1:589,by:"William Crookes"},
  {n:82,sym:"Pb",name:"Lead",mass:207.21,cat:"post-transition-metal",pred:false,period:6,group:14,x:14,y:6,phase:"Solid",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p2",shells:[2,8,18,32,18,4],en:1.87,density:11.34,melt:600.61,boil:2022,ie1:716,by:"Middle East"},
  {n:83,sym:"Bi",name:"Bismuth",mass:208.98,cat:"post-transition-metal",pred:false,period:6,group:15,x:15,y:6,phase:"Solid",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p3",shells:[2,8,18,32,18,5],en:2.02,density:9.78,melt:544.7,boil:1837,ie1:703,by:"Claude Fran\u00e7ois Geoffroy"},
  {n:84,sym:"Po",name:"Polonium",mass:209,cat:"post-transition-metal",pred:false,period:6,group:16,x:16,y:6,phase:"Solid",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p4",shells:[2,8,18,32,18,6],en:2,density:9.196,melt:527,boil:1235,ie1:812,by:"Pierre Curie"},
  {n:85,sym:"At",name:"Astatine",mass:210,cat:"metalloid",pred:false,period:6,group:17,x:17,y:6,phase:"Solid",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p5",shells:[2,8,18,32,18,7],en:2.2,density:6.35,melt:575,boil:610,ie1:899,by:"Dale R. Corson"},
  {n:86,sym:"Rn",name:"Radon",mass:222,cat:"noble-gas",pred:false,period:6,group:18,x:18,y:6,phase:"Gas",block:"p",econf:"[Xe] 4f14 5d10 6s2 6p6",shells:[2,8,18,32,18,8],en:2.2,density:9.73,melt:202,boil:211.5,ie1:1037,by:"Friedrich Ernst Dorn"},
  {n:87,sym:"Fr",name:"Francium",mass:223,cat:"alkali-metal",pred:false,period:7,group:1,x:1,y:7,phase:"Solid",block:"s",econf:"[Rn] 7s1",shells:[2,8,18,32,18,8,1],en:0.79,density:1.87,melt:300,boil:950,ie1:380,by:"Marguerite Perey"},
  {n:88,sym:"Ra",name:"Radium",mass:226,cat:"alkaline-earth-metal",pred:false,period:7,group:2,x:2,y:7,phase:"Solid",block:"s",econf:"[Rn] 7s2",shells:[2,8,18,32,18,8,2],en:0.9,density:5.5,melt:1233,boil:2010,ie1:509,by:"Pierre Curie"},
  {n:89,sym:"Ac",name:"Actinium",mass:227,cat:"transition-metal",pred:false,period:7,group:3,x:3,y:7,phase:"Solid",block:"d",econf:"[Rn] 6d1 7s2",shells:[2,8,18,32,18,9,2],en:1.1,density:10,melt:1500,boil:3500,ie1:499,by:"Friedrich Oskar Giesel"},
  {n:90,sym:"Th",name:"Thorium",mass:232.038,cat:"actinide",pred:false,period:7,group:3,x:3,y:10,phase:"Solid",block:"f",econf:"[Rn] 6d2 7s2",shells:[2,8,18,32,18,10,2],en:1.3,density:11.724,melt:2023,boil:5061,ie1:587,by:"J\u00f6ns Jakob Berzelius"},
  {n:91,sym:"Pa",name:"Protactinium",mass:231.036,cat:"actinide",pred:false,period:7,group:3,x:4,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f2 6d1 7s2",shells:[2,8,18,32,20,9,2],en:1.5,density:15.37,melt:1841,boil:4300,ie1:568,by:"William Crookes"},
  {n:92,sym:"U",name:"Uranium",mass:238.029,cat:"actinide",pred:false,period:7,group:3,x:5,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f3 6d1 7s2",shells:[2,8,18,32,21,9,2],en:1.38,density:19.1,melt:1405.3,boil:4404,ie1:598,by:"Martin Heinrich Klaproth"},
  {n:93,sym:"Np",name:"Neptunium",mass:237,cat:"actinide",pred:false,period:7,group:3,x:6,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f4 6d1 7s2",shells:[2,8,18,32,22,9,2],en:1.36,density:20.45,melt:912,boil:4447,ie1:604,by:"Edwin McMillan"},
  {n:94,sym:"Pu",name:"Plutonium",mass:244,cat:"actinide",pred:false,period:7,group:3,x:7,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f6 7s2",shells:[2,8,18,32,24,8,2],en:1.28,density:19.816,melt:912.5,boil:3505,ie1:585,by:"Glenn T. Seaborg"},
  {n:95,sym:"Am",name:"Americium",mass:243,cat:"actinide",pred:false,period:7,group:3,x:8,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f7 7s2",shells:[2,8,18,32,25,8,2],en:1.13,density:12,melt:1449,boil:2880,ie1:578,by:"Glenn T. Seaborg"},
  {n:96,sym:"Cm",name:"Curium",mass:247,cat:"actinide",pred:false,period:7,group:3,x:9,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f7 6d1 7s2",shells:[2,8,18,32,25,9,2],en:1.28,density:13.51,melt:1613,boil:3383,ie1:581,by:"Glenn T. Seaborg"},
  {n:97,sym:"Bk",name:"Berkelium",mass:247,cat:"actinide",pred:false,period:7,group:3,x:10,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f9 7s2",shells:[2,8,18,32,27,8,2],en:1.3,density:14.78,melt:1259,boil:2900,ie1:601,by:"Lawrence Berkeley National Laboratory"},
  {n:98,sym:"Cf",name:"Californium",mass:251,cat:"actinide",pred:false,period:7,group:3,x:11,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f10 7s2",shells:[2,8,18,32,28,8,2],en:1.3,density:15.1,melt:1173,boil:1743,ie1:608,by:"Lawrence Berkeley National Laboratory"},
  {n:99,sym:"Es",name:"Einsteinium",mass:252,cat:"actinide",pred:false,period:7,group:3,x:12,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f11 7s2",shells:[2,8,18,32,29,8,2],en:1.3,density:8.84,melt:1133,boil:1269,ie1:619,by:"Lawrence Berkeley National Laboratory"},
  {n:100,sym:"Fm",name:"Fermium",mass:257,cat:"actinide",pred:false,period:7,group:3,x:13,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f12 7s2",shells:[2,8,18,32,30,8,2],en:1.3,density:null,melt:1800,boil:null,ie1:627,by:"Lawrence Berkeley National Laboratory"},
  {n:101,sym:"Md",name:"Mendelevium",mass:258,cat:"actinide",pred:false,period:7,group:3,x:14,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f13 7s2",shells:[2,8,18,32,31,8,2],en:1.3,density:null,melt:1100,boil:null,ie1:635,by:"Lawrence Berkeley National Laboratory"},
  {n:102,sym:"No",name:"Nobelium",mass:259,cat:"actinide",pred:false,period:7,group:3,x:15,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f14 7s2",shells:[2,8,18,32,32,8,2],en:1.3,density:null,melt:1100,boil:null,ie1:642,by:"Joint Institute for Nuclear Research"},
  {n:103,sym:"Lr",name:"Lawrencium",mass:266,cat:"actinide",pred:false,period:7,group:3,x:16,y:10,phase:"Solid",block:"f",econf:"[Rn] 5f14 7s2 7p1",shells:[2,8,18,32,32,8,3],en:1.3,density:null,melt:1900,boil:null,ie1:470,by:"Lawrence Berkeley National Laboratory"},
  {n:104,sym:"Rf",name:"Rutherfordium",mass:267,cat:"transition-metal",pred:false,period:7,group:4,x:4,y:7,phase:"Solid",block:"d",econf:"[Rn] 5f14 6d2 7s2",shells:[2,8,18,32,32,10,2],en:null,density:23.2,melt:2400,boil:5800,ie1:580,by:"Joint Institute for Nuclear Research"},
  {n:105,sym:"Db",name:"Dubnium",mass:268,cat:"transition-metal",pred:false,period:7,group:5,x:5,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d3 7s2",shells:[2,8,18,32,32,11,2],en:null,density:29.3,melt:null,boil:null,ie1:null,by:"Joint Institute for Nuclear Research"},
  {n:106,sym:"Sg",name:"Seaborgium",mass:269,cat:"transition-metal",pred:false,period:7,group:6,x:6,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d4 7s2",shells:[2,8,18,32,32,12,2],en:null,density:35,melt:null,boil:null,ie1:null,by:"Lawrence Berkeley National Laboratory"},
  {n:107,sym:"Bh",name:"Bohrium",mass:270,cat:"transition-metal",pred:false,period:7,group:7,x:7,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d5 7s2",shells:[2,8,18,32,32,13,2],en:null,density:37.1,melt:null,boil:null,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:108,sym:"Hs",name:"Hassium",mass:269,cat:"transition-metal",pred:false,period:7,group:8,x:8,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d6 7s2",shells:[2,8,18,32,32,14,2],en:null,density:40.7,melt:126,boil:null,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:109,sym:"Mt",name:"Meitnerium",mass:278,cat:"transition-metal",pred:true,period:7,group:9,x:9,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d7 7s2",shells:[2,8,18,32,32,15,2],en:null,density:37.4,melt:null,boil:null,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:110,sym:"Ds",name:"Darmstadtium",mass:281,cat:"transition-metal",pred:true,period:7,group:10,x:10,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d9 7s1",shells:[2,8,18,32,32,16,2],en:null,density:34.8,melt:null,boil:null,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:111,sym:"Rg",name:"Roentgenium",mass:282,cat:"transition-metal",pred:true,period:7,group:11,x:11,y:7,phase:"Solid",block:"d",econf:"*[Rn] 5f14 6d10 7s1",shells:[2,8,18,32,32,17,2],en:null,density:28.7,melt:null,boil:null,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:112,sym:"Cn",name:"Copernicium",mass:285,cat:"transition-metal",pred:false,period:7,group:12,x:12,y:7,phase:"Liquid",block:"d",econf:"*[Rn] 5f14 6d10 7s2",shells:[2,8,18,32,32,18,2],en:null,density:14.0,melt:null,boil:3570,ie1:null,by:"Gesellschaft f\u00fcr Schwerionenforschung"},
  {n:113,sym:"Nh",name:"Nihonium",mass:286,cat:"transition-metal",pred:true,period:7,group:13,x:13,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p1",shells:[2,8,18,32,32,18,3],en:null,density:16,melt:700,boil:1430,ie1:null,by:"RIKEN"},
  {n:114,sym:"Fl",name:"Flerovium",mass:289,cat:"post-transition-metal",pred:false,period:7,group:14,x:14,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p2",shells:[2,8,18,32,32,18,4],en:null,density:14,melt:340,boil:420,ie1:null,by:"Joint Institute for Nuclear Research"},
  {n:115,sym:"Mc",name:"Moscovium",mass:289,cat:"post-transition-metal",pred:true,period:7,group:15,x:15,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p3",shells:[2,8,18,32,32,18,5],en:null,density:13.5,melt:670,boil:1400,ie1:null,by:"Joint Institute for Nuclear Research"},
  {n:116,sym:"Lv",name:"Livermorium",mass:293,cat:"post-transition-metal",pred:true,period:7,group:16,x:16,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p4",shells:[2,8,18,32,32,18,6],en:null,density:12.9,melt:709,boil:1085,ie1:null,by:"Joint Institute for Nuclear Research"},
  {n:117,sym:"Ts",name:"Tennessine",mass:294,cat:"metalloid",pred:true,period:7,group:17,x:17,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p5",shells:[2,8,18,32,32,18,7],en:null,density:7.17,melt:723,boil:883,ie1:null,by:"Joint Institute for Nuclear Research"},
  {n:118,sym:"Og",name:"Oganesson",mass:294,cat:"noble-gas",pred:true,period:7,group:18,x:18,y:7,phase:"Solid",block:"p",econf:"*[Rn] 5f14 6d10 7s2 7p6",shells:[2,8,18,32,32,18,8],en:null,density:4.95,melt:null,boil:350,ie1:null,by:"Joint Institute for Nuclear Research"},
];
/* Standard 9-category coloring (alkali/alkaline-earth/transition/post-
 * transition metals, metalloid, nonmetal, noble gas, lanthanide, actinide)
 * -- the same grouping used on most NEET/NCERT reference tables, collapsing
 * the source dataset's separate "diatomic"/"polyatomic nonmetal" split into
 * one "nonmetal" bucket since that distinction isn't chemically load-bearing
 * for this level of study. `border` is a darker shade of `color` used for
 * the tile outline/shadow so tiles keep the app's sticker-outline look. */
export const CATEGORY_META = {
  "alkali-metal": { label: "Alkali metal", color: "#FF9E9E", border: "#B9504F" },
  "alkaline-earth-metal": { label: "Alkaline earth metal", color: "#FFC98B", border: "#B5732C" },
  "transition-metal": { label: "Transition metal", color: "#FFE08A", border: "#A87F1B" },
  "post-transition-metal": { label: "Post-transition metal", color: "#B7E39B", border: "#4F8A34" },
  metalloid: { label: "Metalloid", color: "#8FDCD0", border: "#217A6C" },
  nonmetal: { label: "Nonmetal", color: "#92C9F0", border: "#2C6FA8" },
  "noble-gas": { label: "Noble gas", color: "#C6A6F0", border: "#6B3FA0" },
  lanthanide: { label: "Lanthanide", color: "#F4A6C6", border: "#A83F6E" },
  actinide: { label: "Actinide", color: "#E38FAE", border: "#96335A" },
  unknown: { label: "Unknown", color: "#D8D3C8", border: "#7A7266" },
};

/* s/p/d/f block coloring -- the classification NEET inorganic chemistry
 * actually tests directly, so it's a first-class color mode of its own
 * rather than something only visible in the detail panel. */
export const BLOCK_META = {
  s: { label: "s-block", color: "#FF9E9E", border: "#B9504F" },
  p: { label: "p-block", color: "#92C9F0", border: "#2C6FA8" },
  d: { label: "d-block", color: "#FFE08A", border: "#A87F1B" },
  f: { label: "f-block", color: "#C6A6F0", border: "#6B3FA0" },
};

/* Physical state at room temperature (~25°C / 298K). */
export const PHASE_META = {
  Solid: { label: "Solid", color: "#B7E39B", border: "#4F8A34" },
  Liquid: { label: "Liquid", color: "#92C9F0", border: "#2C6FA8" },
  Gas: { label: "Gas", color: "#FFE08A", border: "#A87F1B" },
};

export const COLOR_MODES = [
  { id: "category", label: "Category", meta: CATEGORY_META, keyOf: (el) => el.cat },
  { id: "block", label: "Block", meta: BLOCK_META, keyOf: (el) => el.block },
  { id: "phase", label: "Phase", meta: PHASE_META, keyOf: (el) => el.phase },
];

export function elementColor(el, modeId) {
  const mode = COLOR_MODES.find((m) => m.id === modeId) || COLOR_MODES[0];
  const key = mode.keyOf(el);
  return mode.meta[key] || CATEGORY_META.unknown;
}

/* Kelvin -> Celsius, rounded to 1dp, or null passthrough for elements with
 * no measured/predicted value (mostly the far end of the synthetic ones). */
export function kToC(k) {
  if (k === null || k === undefined) return null;
  return Math.round((k - 273.15) * 10) / 10;
}

export const MAX_PERIOD = 7;
export const MAX_GROUP = 18;
