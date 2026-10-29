/* bg/card are deliberately near-white for every theme (this was the original
 * design: card ~99% lightness, bg ~97-98% with only a whisper of the theme's
 * hue). Color lives in accent/accent2/soft/palette and in outlined shapes —
 * not in the page or card surfaces — so cards read as flat cream/white
 * "sticker paper" with color used as an accent, never a wash. */
export const THEMES = {
  "Sakura Bloom": {
    bg: "#FFF8EF", card: "#FFFDFA", outline: "#5B4A54", ink: "#4A3B45", muted: "#8A7681",
    accent: "#FF4F8B", accent2: "#FFB74A", soft: "#FFC7DE",
    palette: ["#FFB3CE", "#8FD4A8", "#FFB74A", "#D9BEF2", "#9FD3EC", "#FFE28A"],
    mascotFill: "#FFB3CE", mascotInner: "#FFEFF5", mascotBlush: "#F0568F",
    dot: "rgba(91,74,84,0.05)", emoji: "🌸",
    decor: ["blossom", "blossomSprig", "blossom", "sparkleStar"],
  },
  "Strawberry Milk": {
    bg: "#FFF6F3", card: "#FFFDFB", outline: "#7A3B41", ink: "#5C2E33", muted: "#9A6A6E",
    accent: "#FF3B55", accent2: "#FFB23D", soft: "#FFD2C4",
    palette: ["#FF9BA3", "#B8E8C9", "#FFCB6E", "#FFC2CC", "#F2A0A8", "#FFE7A8"],
    mascotFill: "#FFA8AE", mascotInner: "#FFE3E5", mascotBlush: "#E85560",
    dot: "rgba(122,59,65,0.06)", emoji: "🍓",
    decor: ["strawberry", "milkDrop", "strawberry", "sparkleStar"],
  },
  "Blueberry Dream": {
    bg: "#F2F5FF", card: "#FFFFFF", outline: "#3F4A73", ink: "#333F63", muted: "#7F89AD",
    accent: "#4C5FEB", accent2: "#9B6FE0", soft: "#C9B3F7",
    palette: ["#8FA0F5", "#C9A8F0", "#7FCBEA", "#FFD873", "#6B7EF0", "#E0C2F5"],
    mascotFill: "#A8B8F7", mascotInner: "#EAEEFF", mascotBlush: "#8F5FD9",
    dot: "rgba(63,74,115,0.06)", emoji: "🫐",
    decor: ["berryCluster", "sparkleStar", "berryCluster", "sparkleStar"],
  },
  "Tulip Garden": {
    bg: "#FFF9F2", card: "#FFFFFB", outline: "#6B4A33", ink: "#573B26", muted: "#9C8168",
    accent: "#F2622A", accent2: "#FFC93C", soft: "#FFD79A",
    palette: ["#FFAFC2", "#FFCF52", "#8FCB86", "#8FCBE0", "#FF9E5C", "#F6E08A"],
    mascotFill: "#FFCF7A", mascotInner: "#FFF3D6", mascotBlush: "#F2708A",
    dot: "rgba(107,74,51,0.06)", emoji: "🌷",
    decor: ["tulip", "blossomSprig", "tulip", "sparkleStar"],
  },
  "Cloud Paradise": {
    bg: "#F5FAFF", card: "#FFFFFF", outline: "#4A5C6E", ink: "#3D4C5C", muted: "#84939F",
    accent: "#4A93E0", accent2: "#9B7FE0", soft: "#BFE0FB",
    palette: ["#8FCBF2", "#C2A8F0", "#FFC98A", "#8FE0C2", "#AFC2F5", "#F0DCF7"],
    mascotFill: "#BFE0FB", mascotInner: "#FFFFFF", mascotBlush: "#7FA8E0",
    dot: "rgba(74,92,110,0.05)", emoji: "☁️",
    decor: ["cloud", "sparkleStar", "cloud", "bubbleCluster"],
  },
  "Bubblegum Pop": {
    bg: "#FFF7FB", card: "#FFFDFE", outline: "#6B3F5C", ink: "#54324A", muted: "#9C7A94",
    accent: "#FF6FA8", accent2: "#76DEF1", soft: "#FECFE9",
    palette: ["#FFC2E0", "#B8ECF5", "#FFF1A8", "#D9C6F5", "#FFD1D1", "#FCE1F0"],
    mascotFill: "#FFD1E6", mascotInner: "#FFF0F7", mascotBlush: "#FF8FBB",
    dot: "rgba(107,63,92,0.06)", emoji: "🍬",
    decor: ["bubbleCluster", "lollipop", "bubbleCluster", "sparkleStar"],
  },
  "Matcha Garden": {
    bg: "#FBF8EF", card: "#FFFFFB", outline: "#3F5236", ink: "#33452B", muted: "#77886C",
    accent: "#5C9E4A", accent2: "#E0B563", soft: "#B8E0A0",
    palette: ["#8FCB79", "#7FC2E8", "#E0B563", "#F2A8C2", "#6FAE5C", "#BFE8A8"],
    mascotFill: "#B8E0A0", mascotInner: "#F1F7EC", mascotBlush: "#E87FA0",
    dot: "rgba(63,82,54,0.06)", emoji: "🍃",
    decor: ["matchaLeaf", "teacup", "matchaLeaf", "sparkleStar"],
  },
  "Teddy Cafe": {
    bg: "#FBF1E4", card: "#FFFAF0", outline: "#5A3A28", ink: "#4A3120", muted: "#8C7360",
    accent: "#D3884F", accent2: "#EFC897", soft: "#FDD49A",
    palette: ["#E8C79E", "#D8B08C", "#F3E3C8", "#F0C8C2", "#E0BC96", "#F6D9B0"],
    mascotFill: "#E8C79E", mascotInner: "#F8ECD9", mascotBlush: "#E39A8C",
    dot: "rgba(90,58,40,0.06)", emoji: "🧸", stitched: true,
    decor: ["pawPrint", "coffeeCup", "pawPrint", "blossomSprig"],
  },
  "Panda Paper": {
    bg: "#FAFAF7", card: "#FFFFFE", outline: "#2E2C2A", ink: "#242220", muted: "#8D8983",
    accent: "#392F2A", accent2: "#F6A9BD", soft: "#EAE3CF",
    palette: ["#D9D5C9", "#BDB8A9", "#C7C2B4", "#F0AFC0", "#9A968C", "#EAE7DE"],
    mascotFill: "#E9E6DD", mascotInner: "#FFFFFC", mascotBlush: "#F0AFC0",
    dot: "rgba(46,44,42,0.055)", emoji: "🐼",
    decor: ["bambooStalk", "pawPrint", "bambooStalk", "sparkleStar"],
  },
  "Mossy Blockland": {
    bg: "#F6FBF2", card: "#FCFEFA", outline: "#3B2A18", ink: "#33421F", muted: "#748A5F",
    accent: "#69CD41", accent2: "#C87A2E", soft: "#D7F4B1",
    palette: ["#B8E0A0", "#8FCB7C", "#AEE3E0", "#D8B98A", "#C7C6BE", "#F6D98A"],
    mascotFill: "#C8EAB0", mascotInner: "#F1FAE7", mascotBlush: "#F0A9BC",
    dot: "rgba(59,42,24,0.07)", emoji: "🟩", blocky: true,
    decor: ["pixelTree", "pixelBlock", "pixelTree", "pixelBlock"],
  },
  "Comet Lab": {
    bg: "#F2FBFC", card: "#FAFEFE", outline: "#2C4A52", ink: "#22383E", muted: "#6E8A90",
    accent: "#42CAE3", accent2: "#B984F0", soft: "#C5F1F4",
    palette: ["#A8E6E0", "#CBB6F0", "#FFD8A0", "#FFB3C6", "#9FD7E8", "#D6F0F2"],
    mascotFill: "#C7EDF0", mascotInner: "#F1FCFD", mascotBlush: "#B98CE8",
    dot: "rgba(44,74,82,0.06)", emoji: "🧪",
    decor: ["beaker", "orbitRing", "dnaTwist", "sparkleStar"],
  },
  "CD-ROM Dreams": {
    bg: "#F5F7FF", card: "#FCFDFF", outline: "#211D18", ink: "#241F19", muted: "#8D8272",
    accent: "#6C7BFF", accent2: "#FF5FA8", soft: "#C0DFFF",
    palette: ["#B9D8FF", "#FFB8DE", "#D8FFB0", "#E4D8FF", "#FFE39E", "#CFE7FF"],
    mascotFill: "#DCE6F5", mascotInner: "#FFFFFF", mascotBlush: "#FF6FA8",
    dot: "rgba(33,29,24,0.08)", emoji: "💿", y2k: true,
    decor: ["floppyDisk", "chromeBubble", "cdDisc", "retroMonitor"],
  },
  "Terracotta Mesa": {
    bg: "#FBF3EA", card: "#FFFBF5", outline: "#5C4432", ink: "#4A3524", muted: "#93795F",
    accent: "#C1653D", accent2: "#7C9473", soft: "#E8C9A0",
    palette: ["#E3B48C", "#A9C29A", "#F0D9A8", "#D98C6B", "#C7D6BE", "#EFE1C4"],
    mascotFill: "#E8C9A0", mascotInner: "#FBEFDD", mascotBlush: "#D9825C",
    dot: "rgba(92,68,50,0.06)", emoji: "🌵",
    decor: ["cactus", "desertSun", "cactus", "sparkleStar"],
  },
  "Marigold Mela": {
    bg: "#FFF8ED", card: "#FFFDF7", outline: "#6B3220", ink: "#5A2A1C", muted: "#9C7458",
    accent: "#E8862E", accent2: "#C23B6B", soft: "#F6C244",
    palette: ["#F3A94E", "#E45C86", "#F7D77A", "#D97A3E", "#F0A8C2", "#FBE7B8"],
    mascotFill: "#F6C97A", mascotInner: "#FFF3D9", mascotBlush: "#E8749A",
    dot: "rgba(107,50,32,0.06)", emoji: "🪔",
    decor: ["marigoldFlower", "diyaLamp", "marigoldFlower", "sparkleStar"],
  },
  "Citrus Soda": {
    bg: "#FAFCEF", card: "#FFFFFA", outline: "#4A5C2E", ink: "#3D4A26", muted: "#838F63",
    accent: "#F2B705", accent2: "#F0883D", soft: "#C9E267",
    palette: ["#F7D34E", "#F2A559", "#D9EC8C", "#F0C93E", "#BFE0A0", "#FCE8A8"],
    mascotFill: "#F5E28A", mascotInner: "#FFFBE0", mascotBlush: "#F0A559",
    dot: "rgba(74,92,46,0.06)", emoji: "🍋",
    decor: ["lemonSlice", "mintSprig", "lemonSlice", "sparkleStar"],
  },
  "Harvest Ember": {
    bg: "#FBF3E9", card: "#FFFAF2", outline: "#4A2E1E", ink: "#3D2617", muted: "#8C7360",
    accent: "#B5541F", accent2: "#C98A2E", soft: "#E8A857",
    palette: ["#D97C3E", "#E8B85C", "#7A8F4E", "#C4632E", "#EAD196", "#9C6B3A"],
    mascotFill: "#E3B072", mascotInner: "#FBEEDA", mascotBlush: "#D97448",
    dot: "rgba(74,46,30,0.06)", emoji: "🍂",
    decor: ["mapleLeaf", "acorn", "mapleLeaf", "sparkleStar"],
  },
  "Kraft & Compass": {
    bg: "#F4EEDD", card: "#FFFBF0", outline: "#3A2E1F", ink: "#2E2418", muted: "#8C7C63",
    accent: "#5B7052", accent2: "#B5602E", soft: "#E3C98C",
    palette: ["#C9BFA0", "#8FAE7C", "#D98F52", "#B7A67E", "#6E8B6A", "#EAD9AE"],
    mascotFill: "#E3C98C", mascotInner: "#FBF3DD", mascotBlush: "#C97B4E",
    dot: "rgba(58,46,31,0.06)", emoji: "🧭", paper: true,
    decor: ["compass", "mapPin", "compass", "mapleLeaf"],
  },
  "Whiskey Barrel": {
    bg: "#F7EEE0", card: "#FFF9EF", outline: "#4A2E1E", ink: "#3D2617", muted: "#8F7862",
    accent: "#9C5A28", accent2: "#7A2E28", soft: "#D9A458",
    palette: ["#C98A44", "#8A4A3A", "#E3C48A", "#B5703A", "#5E3826", "#EEDCB8"],
    mascotFill: "#DDB07C", mascotInner: "#FBEFD9", mascotBlush: "#B5603A",
    dot: "rgba(74,46,30,0.06)", emoji: "🥃", paper: true,
    decor: ["barrel", "rivetStud", "barrel", "oakLeaf"],
  },
  "Denim & Rust": {
    bg: "#F2EEE4", card: "#FFFDF8", outline: "#2E3A44", ink: "#26313A", muted: "#7C8791",
    accent: "#3F5C76", accent2: "#B5562E", soft: "#A9C2D6",
    palette: ["#5D7C99", "#C97347", "#9CB3C4", "#D9A97C", "#3F5266", "#E8D9C2"],
    mascotFill: "#A9C2D6", mascotInner: "#F0F6FA", mascotBlush: "#C97347",
    dot: "rgba(46,58,68,0.06)", emoji: "🔧", paper: true,
    decor: ["wrench", "rivetStud", "wrench", "gear"],
  },
  "Gunmetal Press": {
    bg: "#F3F0E8", card: "#FCFAF3", outline: "#2A2A28", ink: "#242422", muted: "#847E70",
    accent: "#4A5560", accent2: "#35485E", soft: "#C7BFA8",
    palette: ["#5C6672", "#8A97A3", "#C4AE7E", "#3A4A5A", "#9A8F73", "#D8D0BC"],
    mascotFill: "#C7CDD3", mascotInner: "#F4F5F6", mascotBlush: "#5C6672",
    dot: "rgba(42,42,40,0.07)", emoji: "🖋️", paper: true,
    decor: ["quillInk", "gear", "quillInk", "rivetStud"],
  },
  "Red Velvet": {
    bg: "#FCF2EF", card: "#FFFAF6", outline: "#5C2A2E", ink: "#4A2226", muted: "#957070",
    accent: "#C1616B", accent2: "#E8B7A0", soft: "#F3D9B8",
    palette: ["#D98A93", "#F3D9B8", "#8A3F42", "#E8C6A8", "#C97A7A", "#F6E8D2"],
    mascotFill: "#D98A93", mascotInner: "#FBEBE3", mascotBlush: "#8A3F42",
    dot: "rgba(92,42,46,0.06)", emoji: "🍰",
    decor: ["strawberry", "blossomSprig", "strawberry", "sparkleStar"],
  },
  "Wisteria Dream": {
    bg: "#FAF3FA", card: "#FEFBFE", outline: "#5A3F63", ink: "#4A3352", muted: "#93809C",
    accent: "#B583C4", accent2: "#E0AECF", soft: "#F0D9E8",
    palette: ["#D0A0DC", "#F0D9E8", "#9C63B5", "#E8C2D9", "#C48ADA", "#F6E8F2"],
    mascotFill: "#D0A0DC", mascotInner: "#F7EEF9", mascotBlush: "#9C4F8C",
    dot: "rgba(90,63,99,0.06)", emoji: "🪻",
    decor: ["blossom", "blossomSprig", "blossom", "sparkleStar"],
  },

  /* ===== photo-backdrop themes =====
   * These seven (four below + three more further down) keep the same
   * near-white card/bg rule as every other theme above (so cards, chips,
   * and text stay exactly as legible as always) but
   * add a `bgImage` + `photoBg: true` pair. App.jsx reads `photoBg` to flip
   * on a fixed, full-viewport pixel-art backdrop behind the whole app (see
   * .sb-app[data-photo-bg] in GlobalStyle.jsx) -- the photo shows only in the
   * gaps around cards/sidebar, the same visual slot the existing Settings >
   * Custom Background feature uses, just theme-driven instead of user-URL-
   * driven, and the two never conflict (custom bg always wins if active --
   * see z-index note in GlobalStyle.jsx). accent/accent2/soft/palette below
   * are hand-picked from each image so chips, buttons and the decor layer
   * read as part of the scene instead of clashing with it. */
  "Wildwood CRT": {
    bg: "#FBF3E6", card: "#FFFAF1", outline: "#4A3B2E", ink: "#3D3226", muted: "#8C7C68",
    accent: "#E8863E", accent2: "#6B9C5A", soft: "#F6D28A",
    palette: ["#F3B77A", "#8FBF6E", "#F6D8A8", "#E88A6B", "#6E9C82", "#F2E3B8"],
    mascotFill: "#F6D8A8", mascotInner: "#FDF3DE", mascotBlush: "#E88A6B",
    dot: "rgba(74,59,46,0.05)", emoji: "🖥️", photoBg: true, bgImage: "/theme-bg/wildwood-crt.webp",
    decor: ["pixelTree", "retroMonitor", "pixelTree", "sparkleStar"],
  },
  "Midnight Express": {
    bg: "#F4F6FC", card: "#FFFFFF", outline: "#2C3454", ink: "#2A2E4A", muted: "#767DA0",
    accent: "#F0B85C", accent2: "#C23B45", soft: "#C9D3F0",
    palette: ["#8C97C9", "#F0B85C", "#C23B45", "#E7ECFA", "#5A6491", "#F6D9A0"],
    mascotFill: "#C9D3F0", mascotInner: "#EEF1FB", mascotBlush: "#C23B45",
    dot: "rgba(44,52,84,0.05)", emoji: "🚄", photoBg: true, bgImage: "/theme-bg/midnight-express.webp",
    decor: ["crescentMoon", "twinkleStar", "shootingStar", "gear"],
  },
  "Windmill Meadow": {
    bg: "#FFF7EA", card: "#FFFDF6", outline: "#5A3620", ink: "#4A2C1A", muted: "#977C60",
    accent: "#E8752E", accent2: "#7C9A4E", soft: "#F6D66E",
    palette: ["#F0954A", "#8FAE5E", "#F6E08A", "#D97A3E", "#5E7A3E", "#FBE9C2"],
    mascotFill: "#F6E08A", mascotInner: "#FEF6DE", mascotBlush: "#F0954A",
    dot: "rgba(90,54,32,0.05)", emoji: "🌾", photoBg: true, bgImage: "/theme-bg/windmill-meadow.webp",
    decor: ["tulip", "desertSun", "marigoldFlower", "sparkleStar"],
  },
  "Sunset Drift": {
    bg: "#FDF6EC", card: "#FFFCF6", outline: "#3E2E4A", ink: "#382A44", muted: "#8C7F9C",
    accent: "#F0733E", accent2: "#8A6FB0", soft: "#FBC98A",
    palette: ["#F09A5C", "#9C82C4", "#F4C77A", "#5E4E78", "#E86B4A", "#FCE3C0"],
    mascotFill: "#FBC98A", mascotInner: "#FEF1DC", mascotBlush: "#E86B4A",
    dot: "rgba(62,46,74,0.05)", emoji: "🏎️", photoBg: true, bgImage: "/theme-bg/sunset-drift.webp",
    decor: ["gear", "desertSun", "wrench", "sparkleStar"],
  },

  /* ===== photo-backdrop themes, batch 2 =====
   * Same rules as the four above -- near-white bg/card, hand-picked
   * accent/accent2/soft/palette from each source photo so the UI reads as
   * part of the scene. Nothing else about the photo-bg system changes. */
  "Pixel Garden": {
    bg: "#FBF6E9", card: "#FFFCF3", outline: "#3B3223", ink: "#332C1E", muted: "#8C8268",
    accent: "#C96A32", accent2: "#667A45", soft: "#F1D39A",
    palette: ["#E6B978", "#667A45", "#F1D39A", "#C96A32", "#354832", "#D8C9A0"],
    mascotFill: "#E6B978", mascotInner: "#FBF3DE", mascotBlush: "#C96A32",
    dot: "rgba(59,50,35,0.06)", emoji: "🌼", photoBg: true, bgImage: "/theme-bg/pixel-garden.webp",
    decor: ["pixelBlock", "blossom", "pixelBlock", "sparkleStar"],
  },
  "Dusk Alley": {
    bg: "#FBF2E6", card: "#FFFAF3", outline: "#3A2E24", ink: "#332920", muted: "#8F7C68",
    accent: "#C75F35", accent2: "#70432F", soft: "#E3A06A",
    palette: ["#E3A06A", "#C69A5C", "#70432F", "#C75F35", "#8A6F5A", "#F0DEC4"],
    mascotFill: "#E3A06A", mascotInner: "#FCEFDE", mascotBlush: "#C75F35",
    dot: "rgba(58,46,36,0.06)", emoji: "🌇", photoBg: true, bgImage: "/theme-bg/dusk-alley.webp",
    decor: ["cloud", "crescentMoon", "cloud", "twinkleStar"],
  },
  "Paper Sky": {
    bg: "#F3F1E2", card: "#FCFAF0", outline: "#2E3A38", ink: "#293633", muted: "#66736D",
    accent: "#3F7775", accent2: "#D67A3E", soft: "#E7C583",
    palette: ["#7FA3A0", "#E7C583", "#D67A3E", "#A84F38", "#3F7775", "#EDE3C6"],
    mascotFill: "#7FA3A0", mascotInner: "#F5F1DF", mascotBlush: "#D67A3E",
    dot: "rgba(41,54,51,0.06)", emoji: "✈️", photoBg: true, bgImage: "/theme-bg/paper-sky.webp",
    decor: ["cloud", "mapPin", "cloud", "sparkleStar"],
  },

  /* ===== photo-backdrop theme, batch 3 =====
   * Same rules as the seven above -- near-white bg/card, hand-picked
   * accent/accent2/soft/palette from the source photo (rusty countryside
   * postbox + wildflowers + blue sky) so the UI reads as part of the scene
   * instead of the photo's own blue/green being dumped onto cards/buttons.
   * Rust is the hero accent (not green, since the photo is already mostly
   * green), sky blue is secondary, wheat/marigold is the soft/highlight
   * tone, and the outline goes dark forest-charcoal instead of the usual
   * brown so the UI border reads as part of the landscape. */
  "Meadow Post": {
    bg: "#F3EBDD", card: "#FFF9EC", outline: "#263A2D", ink: "#304536", muted: "#71806A",
    accent: "#B95732", accent2: "#4D8799", soft: "#E8C98B",
    palette: ["#D6B875", "#87996B", "#4D8799", "#B95732", "#365844", "#D9A63A"],
    mascotFill: "#D6B875", mascotInner: "#FFF4DA", mascotBlush: "#D98A68",
    dot: "rgba(38,58,45,0.055)", emoji: "📮", photoBg: true, bgImage: "/theme-bg/meadow-post.webp",
    decor: ["marigoldFlower", "blossom", "marigoldFlower", "sparkleStar"],
  },

  /* ===== photo-backdrop themes, batch 4 =====
   * Same rules as the eight above -- near-white bg/card, hand-picked
   * accent/accent2/soft/palette pulled straight from each source photo's
   * boldest, most saturated notes (never the washed-out/pastel route the
   * earlier batches leaned on) so chips, buttons and the decor layer pop
   * against the scene instead of receding into it. */
  "Sherbet Alley": {
    bg: "#FFF4EF", card: "#FFFDFB", outline: "#5C1B3D", ink: "#4A1730", muted: "#9C6F82",
    accent: "#FF2D78", accent2: "#FF8A3D", soft: "#FFD23D",
    palette: ["#FF6FB8", "#FFAE42", "#B355D6", "#FF5A3C", "#2E8FD6", "#FFE070"],
    mascotFill: "#FF9AC4", mascotInner: "#FFE8F2", mascotBlush: "#E8432E",
    dot: "rgba(92,27,61,0.06)", emoji: "🌀", photoBg: true, bgImage: "/theme-bg/sherbet-alley.webp",
    decor: ["cloud", "lollipop", "sparkleStar", "sparkleStar"],
  },
  "Petal Serenade": {
    bg: "#FDF4F7", card: "#FFFBFC", outline: "#241D3D", ink: "#28223F", muted: "#847C9C",
    accent: "#E8447A", accent2: "#F2A93C", soft: "#F7C5DA",
    palette: ["#E8447A", "#F2A93C", "#2D4468", "#F7C5DA", "#C2185B", "#5C7099"],
    mascotFill: "#F4A6C1", mascotInner: "#FDEAF1", mascotBlush: "#C2185B",
    dot: "rgba(36,29,61,0.06)", emoji: "🌺", photoBg: true, bgImage: "/theme-bg/petal-serenade.webp",
    decor: ["blossom", "twinkleStar", "blossom", "crescentMoon"],
  },

  /* ===== photo-backdrop themes, batch 5 =====
   * Same rules as the ten above -- near-white bg/card, accent/accent2/soft/
   * palette hand-picked straight from each source photo's own boldest
   * notes so the UI reads as part of the scene, never a clashing overlay.
   * Stitched Cosmos: cross-stitched Earth+Moon on black -- gold/mustard and
   * forest-green continents against deep navy ocean and void, so gold leads
   * as the hero accent (it's the only warm note in an otherwise cool/dark
   * photo) with a vivid indigo-blue as the poppy secondary and the outline
   * pulled dark-navy instead of the usual brown/charcoal to match the space
   * backdrop. Velvet Skyline: whimsical night-city painting -- teal sky,
   * cobalt + near-black towers, one fuchsia building and a lime-green
   * bridge, with warm gold window-lights as the only glow in the scene.
   * Fuchsia leads as the hero accent since it's the photo's single most
   * saturated note, gold window-light is secondary, lime is the soft/
   * highlight tone, and the outline goes deep indigo-black to match the
   * painting's own dark building silhouettes. */
  "Stitched Cosmos": {
    bg: "#F1F3FB", card: "#FBFCFF", outline: "#1D2440", ink: "#262E52", muted: "#7B84AC",
    accent: "#D9A23A", accent2: "#4A6EF0", soft: "#F0C87A",
    palette: ["#D9A23A", "#4FA85B", "#4A6EF0", "#C9CFE0", "#1B2560", "#7FC98A"],
    mascotFill: "#F0C87A", mascotInner: "#FFF6E4", mascotBlush: "#E0793E",
    dot: "rgba(29,36,64,0.06)", emoji: "🌍", photoBg: true, bgImage: "/theme-bg/stitched-cosmos.webp",
    decor: ["candyPlanet", "orbitRing", "twinkleStar", "sparkleStar"],
  },
  "Velvet Skyline": {
    bg: "#EFF6FA", card: "#FCFEFF", outline: "#1E1B33", ink: "#28233F", muted: "#847E9E",
    accent: "#C23F8A", accent2: "#E8B23E", soft: "#8FB93E",
    palette: ["#2E6FA8", "#4B3F8C", "#C23F8A", "#7C9A2E", "#E8B23E", "#0E8FBF"],
    mascotFill: "#9FC4E8", mascotInner: "#EDF6FC", mascotBlush: "#C23F8A",
    dot: "rgba(30,27,51,0.06)", emoji: "🌃", photoBg: true, bgImage: "/theme-bg/velvet-skyline.webp",
    decor: ["crescentMoon", "twinkleStar", "cloud", "sparkleStar"],
  },

  /* ===== photo-backdrop themes, batch 6 =====
   * Same rules as the twelve above -- near-white bg/card, accent/accent2/
   * soft/palette hand-picked straight from each source photo's own boldest
   * notes (never washed-out pastels) so chips/buttons/decor read as part of
   * the scene. Stardust Fox: oil-painted boy-and-fox-under-a-shooting-star
   * night scene -- burnt-orange fox fur is the only warm note against a deep
   * indigo sky, so it leads as hero accent, star-gold is secondary, and the
   * outline pulls dark navy to match the sky instead of the usual brown.
   * Autumn Pup: cream cartoon dog buried in rust/maple-orange fall leaves --
   * rust leads as hero accent, golden leaf-yellow is secondary, outline goes
   * near-black warm brown to match the dog's own ink linework. Pixel
   * Lakeside: cross-stitch-style pixel-art night forest and lake -- the
   * yellow-green tree canopy is the only bright note against deep navy sky
   * and water, so it leads as hero accent, moonlight-gold is secondary, and
   * the outline pulls the same deep navy as the sky/lake. Amber Radio: warm
   * sunlit desk scene with a vintage wood radio, steaming coffee and a
   * trailing pothos -- the amber wood tone leads as hero accent, leaf-green
   * is secondary, and the outline goes deep coffee-brown to match the desk's
   * own long shadows. */
  "Stardust Fox": {
    bg: "#F2F5FB", card: "#FCFEFF", outline: "#1E3A56", ink: "#1B2F47", muted: "#6B7A94",
    accent: "#E0703A", accent2: "#F0C860", soft: "#F6DFA0",
    palette: ["#E0703A", "#F0C860", "#D63B3B", "#8FAFD9", "#2A4A70", "#F5EFE0"],
    mascotFill: "#F0B183", mascotInner: "#FDF6E8", mascotBlush: "#D63B3B",
    dot: "rgba(30,58,86,0.06)", emoji: "🦊", photoBg: true, bgImage: "/theme-bg/stardust-fox.webp",
    decor: ["crescentMoon", "shootingStar", "twinkleStar", "sparkleStar"],
  },
  "Autumn Pup": {
    bg: "#FBF1E4", card: "#FFF9EF", outline: "#2A1E16", ink: "#3A2415", muted: "#8C6F55",
    accent: "#C24A1F", accent2: "#E8A33D", soft: "#F0C48A",
    palette: ["#C24A1F", "#E8A33D", "#9C3D1F", "#D97A2E", "#3A2415", "#F0DAB0"],
    mascotFill: "#F0DAB0", mascotInner: "#FDF6E8", mascotBlush: "#C97452",
    dot: "rgba(58,36,21,0.06)", emoji: "🍂", photoBg: true, bgImage: "/theme-bg/autumn-pup.webp",
    decor: ["mapleLeaf", "acorn", "mapleLeaf", "sparkleStar"],
  },
  "Pixel Lakeside": {
    bg: "#EFF5F3", card: "#FBFEFC", outline: "#1B324F", ink: "#1D2E42", muted: "#6E7F92",
    accent: "#5C9E4A", accent2: "#F0DE7A", soft: "#BFE0D0",
    palette: ["#5C9E4A", "#8CC63F", "#F0DE7A", "#2E5A82", "#1B324F", "#BFE0D0"],
    mascotFill: "#BFE0D0", mascotInner: "#F0FAF5", mascotBlush: "#E8B85C",
    dot: "rgba(27,50,79,0.06)", emoji: "🌲", photoBg: true, bgImage: "/theme-bg/pixel-lakeside.webp",
    decor: ["pixelTree", "twinkleStar", "pixelTree", "crescentMoon"],
  },
  "Amber Radio": {
    bg: "#FBF3E4", card: "#FFFAF0", outline: "#3A2818", ink: "#33261A", muted: "#8C7A63",
    accent: "#A85A2E", accent2: "#6B8F42", soft: "#E8C98A",
    palette: ["#A85A2E", "#6B8F42", "#C23B3B", "#2E4A8C", "#E8C98A", "#3A2818"],
    mascotFill: "#E8C98A", mascotInner: "#FEF6E4", mascotBlush: "#C2703E",
    dot: "rgba(58,40,24,0.06)", emoji: "📻", photoBg: true, bgImage: "/theme-bg/amber-radio.webp",
    decor: ["coffeeCup", "mintSprig", "quillInk", "sparkleStar"],
  },
};

/* ===================================================================
 * Dark mode
 * ---------------------------------------------------------------
 * Appearance is a per-user flag (profiles.dark_mode) mirrored in
 * localStorage so the very first paint -- before the profile row has
 * loaded -- already matches (index.html reads the same key and sets
 * <html data-dark> before React mounts, so there's no light flash).
 *
 * Dark palettes are DERIVED from each theme's own accent / accent2 /
 * palette, so all themes keep their identity in the dark. The result is
 * cached per theme object: themeVars() runs on every App render (the
 * focus timer re-renders it each second), and the colour maths below
 * should be paid once, not 60 times a minute.
 * =================================================================== */
export const DARK_MODE_STORAGE_KEY = "sb-dark-mode-v1";

export function readStoredDarkMode(fallback = false) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return Boolean(fallback);
    const raw = window.localStorage.getItem(DARK_MODE_STORAGE_KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    // storage blocked (private mode etc.) -- fall through to the fallback
  }
  return Boolean(fallback);
}

export function writeStoredDarkMode(enabled) {
  const val = Boolean(enabled);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(DARK_MODE_STORAGE_KEY, val ? "1" : "0");
    }
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.setAttribute("data-dark", val ? "true" : "false");
      if (document.body) document.body.setAttribute("data-dark", val ? "true" : "false");
    }
  } catch {
    // ignore DOM errors
  }
  return val;
}

/* ---------- colour helpers (dark palette calibration) ---------- */
function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return [255, 111, 94];
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [255, 111, 94];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex([r, g, b]) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${cl(r)}${cl(g)}${cl(b)}`.toUpperCase();
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToHsl([r, g, b]) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
      default: break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

/* Lift a light-mode accent until it reads (>= minContrast) on a dark surface. */
function adaptAccentForDark(hex, minContrast = 4.8, surfaceHex = "#19191D") {
  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.25 && l < 0.45) s = Math.max(s, 0.36);
  let cur = rgbToHex(hslToRgb([h, s, l]));
  while (contrastRatio(cur, surfaceHex) < minContrast && l < 0.86) {
    l += 0.02;
    cur = rgbToHex(hslToRgb([h, s, l]));
  }
  return cur;
}

function shiftLightness(hex, deltaL) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const nextL = Math.max(0.12, Math.min(0.92, l + deltaL));
  return rgbToHex(hslToRgb([h, s, nextL]));
}

function mixHex(hexA, hexB, weightA = 0.5) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightA));
  return rgbToHex([r1 * w + r2 * (1 - w), g1 * w + g2 * (1 - w), b1 * w + b2 * (1 - w)]);
}

const FONT_VARS = {
  "--font-display": "'Baloo 2', system-ui, sans-serif",
  "--font-body": "'Nunito', system-ui, sans-serif",
  "--font-hand": "'Caveat', cursive",
};

function buildLightVars(theme) {
  return {
    "--bg": theme.bg, "--card": theme.card, "--accent": theme.accent, "--accent2": theme.accent2,
    "--soft": theme.soft, "--ink": theme.ink, "--muted": theme.muted, "--outline": theme.outline,
    "--dot": theme.dot, "--figure-body": theme.mascotFill, "--figure-inner": theme.mascotInner, "--figure-blush": theme.mascotBlush, "--figure-outline": theme.outline, "--figure-ink": theme.ink, "--mascot-fill": theme.mascotFill, "--mascot-body": theme.mascotFill, "--mascot-inner": theme.mascotInner, "--mascot-blush": theme.mascotBlush, "--mascot-outline": theme.outline, "--mascot-ink": theme.ink,
    "--p1": theme.palette[0], "--p2": theme.palette[1], "--p3": theme.palette[2],
    "--p4": theme.palette[3], "--p5": theme.palette[4], "--p6": theme.palette[5],
    ...FONT_VARS,
    // Light-mode values of the tokens dark mode overrides (identical to the
    // hard-coded fallbacks wherever they are consumed, so light is unchanged).
    "--countdown-ink": theme.outline,
    "--pin-base-ink": theme.outline,
    "--chart-secondary": theme.outline,
    "--subj-biology-ink": "#C43668",
    "--subj-physics-ink": "#2F62C7",
    "--subj-chemistry-ink": "#2E9955",
    "--subj-math-ink": "#7C3FD6",
  };
}

function buildDarkVars(theme) {
  const surface = "#19191D";
  const darkAccent = adaptAccentForDark(theme.accent, 4.85, surface);
  const darkAccent2 = adaptAccentForDark(theme.accent2, 4.85, surface);
  const darkCard = mixHex(darkAccent, "#19191D", 0.025);
  const darkCardHi = mixHex(darkAccent, "#202025", 0.035);
  const palette = (theme.palette || []).map((c) => adaptAccentForDark(c, 4.6, darkCard));
  const onAccent = contrastRatio("#26100C", darkAccent) >= 4.5 ? "#26100C" : "#FFF8F5";

  return {
    "--bg": mixHex(darkAccent, "#0D0D0F", 0.02),
    "--bg-secondary": mixHex(darkAccent, "#121215", 0.025),
    "--surface-inset": mixHex(darkAccent, "#131317", 0.02),
    "--card": darkCard,
    "--card-hi": darkCardHi,
    "--card-bg": darkCardHi,
    "--accent": darkAccent,
    "--accent-light": shiftLightness(darkAccent, 0.11),
    "--accent-deep": shiftLightness(darkAccent, -0.18),
    "--on-accent": onAccent,
    "--accent2": darkAccent2,
    "--accent2-deep": shiftLightness(darkAccent2, -0.18),
    "--soft": mixHex(darkAccent, "#202026", 0.18),
    "--soft-hi": mixHex(darkAccent, "#26262E", 0.26),
    "--ink": "#F0EFF3",
    "--ink-secondary": "#B5B2BE",
    "--muted": "#9693A3",
    "--muted-dim": "#6E6B7B",
    "--outline": "#302F3A",
    "--border-subtle": "rgba(255, 255, 255, 0.07)",
    "--border-hi": "rgba(255, 255, 255, 0.13)",
    "--dot": "rgba(255, 255, 255, 0.025)",
    // nested rows / wells sit INSIDE a card: tint only, never their own shadow
    "--row-bg": "rgba(255, 255, 255, 0.035)",
    "--row-bg-hover": "rgba(255, 255, 255, 0.06)",
    // pre-resolved glow colours so the ambient layer is one cheap static paint
    "--glow-1": rgba(darkAccent, 0.1),
    "--glow-2": rgba(darkAccent2, 0.06),
    "--accent-wash": rgba(darkAccent, 0.14),
    "--accent-ring": rgba(darkAccent, 0.3),
    "--figure-body": theme.mascotFill,
    "--figure-inner": theme.mascotInner,
    "--figure-blush": theme.mascotBlush,
    "--figure-outline": theme.outline,
    "--figure-ink": theme.ink,
    "--mascot-fill": theme.mascotFill,
    "--mascot-body": theme.mascotFill,
    "--mascot-inner": theme.mascotInner,
    "--mascot-blush": theme.mascotBlush,
    "--mascot-outline": "#2D2C36",
    "--mascot-ink": "#F0EFF3",
    "--mascot-orig-card": theme.card,
    "--mascot-orig-outline": theme.outline,
    "--mascot-orig-ink": theme.ink,
    "--mascot-orig-soft": theme.soft,
    "--mascot-orig-accent": theme.accent,
    "--mascot-orig-accent2": theme.accent2,
    "--mascot-orig-muted": theme.muted,
    "--countdown-ink": "#F0EFF3",
    "--pin-base-ink": "#F0EFF3",
    "--chart-secondary": darkAccent2,
    "--subj-biology-ink": "#FF8AB5",
    "--subj-physics-ink": "#82B4FF",
    "--subj-chemistry-ink": "#6ADBA0",
    "--subj-math-ink": "#C6A3FF",
    "--status-success": "#56CE8E",
    "--status-warning": "#F2C879",
    "--status-error": "#FF7A78",
    // Surface depth. Deliberately cheap: ONE small blurred drop shadow + a
    // 1px (blur-free) top highlight. The old 4-layer neumorphic stack
    // (two 14-18px blurs per element) was the main reason dark mode
    // scrolled at ~25fps on phones.
    "--clay-raised": "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 6px 18px -8px rgba(0, 0, 0, 0.7)",
    "--clay-raised-sm": "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 5px rgba(0, 0, 0, 0.3)",
    "--clay-pressed": "inset 0 2px 5px rgba(0, 0, 0, 0.42)",
    "--clay-flat": "inset 0 1px 0 rgba(255, 255, 255, 0.045)",
    // the original sticker look uses hard offset shadows in the outline colour;
    // in dark they would read as grey ghost-frames, so they are switched off
    "--sticker-shadow": "transparent",
    "--p1": palette[0] || darkAccent,
    "--p2": palette[1] || darkAccent2,
    "--p3": palette[2] || darkAccent,
    "--p4": palette[3] || darkAccent2,
    "--p5": palette[4] || darkAccent,
    "--p6": palette[5] || darkAccent2,
    ...FONT_VARS,
  };
}

const VAR_CACHE = new WeakMap();

/** CSS custom properties for a theme. `darkMode` swaps in the derived dark
 *  palette + surface tokens. The returned object is cached per theme and
 *  shared -- treat it as read-only (spread it if you need to add keys). */
export function themeVars(theme, darkMode = false) {
  const t = theme || THEMES["Sakura Bloom"];
  let entry = VAR_CACHE.get(t);
  if (!entry) { entry = {}; VAR_CACHE.set(t, entry); }
  const key = darkMode ? "dark" : "light";
  return entry[key] || (entry[key] = darkMode ? buildDarkVars(t) : buildLightVars(t));
}

export function timeWash(darkMode = false) {
  if (darkMode) return "rgba(0,0,0,0)"; // the dark canvas owns its own ambient glow
  const h = new Date().getHours();
  if (h < 6) return "rgba(110,120,210,0.07)";      // late night — cool violet
  if (h < 11) return "rgba(140,190,255,0.05)";      // morning — cool blue
  if (h < 17) return "rgba(255,255,255,0)";         // midday — neutral
  if (h < 20) return "rgba(255,165,110,0.06)";      // evening — warm amber
  return "rgba(150,100,200,0.07)";                  // night — warm violet
}
