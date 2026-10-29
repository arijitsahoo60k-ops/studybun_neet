export const SYLLABUS = {
  Biology: {
    color: "#F497B6",
    deepColor: "var(--subj-biology-ink, #C43668)",
    groups: {
      "Botany": [
        "Cell: The Unit of Life",
        "Cell Cycle and Cell Division",
        "The Living World",
        "Biological Classification",
        "Plant Kingdom",
        "Morphology of Flowering Plants",
        "Anatomy of Flowering Plants",
        "Respiration in Plants",
        "Photosynthesis in Higher Plants",
        "Plant Growth and Development",
        "Sexual Reproduction in Flowering Plants",
        "Principles of Inheritance and Variation",
        "Molecular Basis of Inheritance",
        "Microbes in Human Welfare",
        "Organisms and Populations",
        "Ecosystem",
        "Biodiversity and Conservation",
      ],
      "Zoology": [
        "Structural Organisation in Animals (Frog/Tissues)",
        "Breathing and Exchange of Gases",
        "Body Fluids and Circulation",
        "Excretory Products and their Elimination",
        "Locomotion and Movement",
        "Neural Control and Coordination",
        "Chemical Coordination and Integration",
        "Animal Kingdom",
        "Biomolecules",
        "Human Reproduction",
        "Reproductive Health",
        "Human Health and Disease",
        "Biotechnology: Principles and Processes",
        "Biotechnology and its Applications",
        "Evolution",
      ],
    },
  },
  Physics: {
    color: "#8FB8FF",
    // Same hue as `color` above but pulled darker/more saturated — the pastel
    // swatch is meant for backgrounds, dots and fills (where it sits on a
    // near-white card and needs to stay soft), but used directly as text
    // color it reads too washed-out to be legible at a glance. `deepColor`
    // is for the handful of spots where the subject name itself is the text.
    deepColor: "var(--subj-physics-ink, #2F62C7)",
    groups: {
      "Foundations": ["Basic Mathematics", "Units and Measurement"],
      "Kinematics & Laws of Motion": ["Motion in 1 Dimension", "Motion in a Plane", "Laws of Motion", "Circular Motion"],
      "Work, Power & Rotational Mechanics": ["Work, Energy and Power", "Center of Mass and Collision", "Rotational Motion", "Gravitation"],
      "Properties of Matter & Thermodynamics": ["Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter", "KTG and Thermodynamics"],
      "Oscillations & Waves": ["Simple Harmonic Motion", "Waves"],
      "Electrostatics & Current Electricity": ["Electric Charges and Fields", "Electric Potential and Capacitance", "Current Electricity"],
      "Magnetism & Electromagnetic Induction": ["Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "EM Waves"],
      "Optics": ["Ray Optics and Optical Instruments", "Wave Optics"],
      "Modern Physics": ["Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductors"],
      "Experimental Physics": ["Instruments"],
    },
  },
  Chemistry: {
    color: "#B8E6C1",
    deepColor: "var(--subj-chemistry-ink, #2E9955)",
    groups: {
      "Physical Chemistry": ["Some Basic Concepts of Chemistry", "Redox Reactions", "Structure of Atom", "State of Matter", "Solutions", "Chemical Kinetics", "Thermodynamics", "Chemical Equilibrium", "Ionic Equilibrium", "Electrochemistry", "The Solid State", "Surface Chemistry"],
      "Inorganic Chemistry": ["Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure", "Coordination Compounds", "General Principles and Processes of Isolation of Elements", "P-Block Elements", "Hydrogen and its Compounds", "The d and f-Block Elements", "S-Block Elements", "Principles of Qualitative Analysis"],
      "Organic Chemistry": ["IUPAC Nomenclature", "General Organic Chemistry (GOC)", "Isomerism", "Hydrocarbons", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Polymers", "Aldehydes, Ketones and Carboxylic Acids", "Chemistry in Everyday Life", "Amines", "Environmental Chemistry", "Biomolecules"],
    },
  },
  Mathematics: {
    color: "#D8C2FF",
    deepColor: "var(--subj-math-ink, #7C3FD6)",
    groups: {
      "Algebra": ["Basic Mathematics", "Quadratic Equations", "Sequence and Series", "Permutation and Combination", "Binomial Theorem", "Determinants", "Matrices", "Sets", "Relations and Functions", "Complex Numbers"],
      "Trigonometry": ["Trigonometric Functions", "Trigonometric Equations", "Inverse Trigonometric Functions", "Solution of Triangles"],
      "Coordinate Geometry": ["Straight Lines", "Circles", "Parabola", "Ellipse", "Hyperbola"],
      "Calculus": ["Method of Differentiation", "Limit, Continuity and Differentiability", "Application of Derivatives", "Indefinite Integration", "Definite Integration", "Application of Integrals", "Differential Equations"],
      "Vectors, 3D & Statistics": ["Vector Algebra", "Three Dimensional Geometry", "Statistics", "Probability"],
    },
  },
};

// ---------- Subject Stream Choice (PCB vs PCMB) ----------
// NEET aspirants can choose either PCB (Physics, Chemistry, Biology) or
// PCMB (Physics, Chemistry, Mathematics, Biology) during onboarding or in
// Settings. Everything in the app (Syllabus, Study Tracker, Question
// Practice, Mock Tests, Daily Planner, Analytics) adapts dynamically.
export const SUBJECT_STREAMS = {
  PCB: ["Biology", "Physics", "Chemistry"],
  PCMB: ["Biology", "Physics", "Chemistry", "Mathematics"],
};

export const normalizeStream = (input) => {
  if (!input) return "PCB";
  if (typeof input === "string") return input.toUpperCase() === "PCMB" ? "PCMB" : "PCB";
  const raw = input.subject_stream || input.subjects_choice || "PCB";
  return String(raw).toUpperCase() === "PCMB" ? "PCMB" : "PCB";
};

export const getActiveSubjects = (profileOrStream) => {
  const stream = normalizeStream(profileOrStream);
  return SUBJECT_STREAMS[stream] || SUBJECT_STREAMS.PCB;
};

export const getActiveSyllabus = (profileOrStream) => {
  const subjects = getActiveSubjects(profileOrStream);
  const out = {};
  subjects.forEach((s) => {
    if (SYLLABUS[s]) out[s] = SYLLABUS[s];
  });
  return out;
};

// ---------- Biology branch & NCERT classification metadata ----------
// Matches the complete NEET UG Biology Curriculum Tracker (Rationalised NCERT
// Class 11 & 12: 32 Chapters = 17 Botany + 15 Zoology, 360/720 Marks, 90 MCQs).
export const BIOLOGY_BRANCHES = {
  "Botany": {
    short: "BOT",
    color: "#2E9955",
    subtitle: "Plant Biology & Allied Sciences · 17 Chapters · Class 11 (Ch 1–10) + Class 12 (Ch 11–17)",
    questions: 45,
    marks: 180,
  },
  "Zoology": {
    short: "ZOO",
    color: "#C43668",
    subtitle: "Animal Biology, Human Physiology & Health · 15 Chapters · Class 11 (Ch 1–9) + Class 12 (Ch 10–15)",
    questions: 45,
    marks: 180,
  },
};

export const BIOLOGY_CHAPTER_META = {
  // Section I: Botany (17 Chapters)
  "Cell: The Unit of Life": { batchId: "BOT-01", highYield: true, classLevel: "Class 11", unit: "Unit III: Cell Structure & Function", branch: "Botany" },
  "Cell Cycle and Cell Division": { batchId: "BOT-02", highYield: true, classLevel: "Class 11", unit: "Unit III: Cell Structure & Function", branch: "Botany" },
  "The Living World": { batchId: "BOT-03", classLevel: "Class 11", unit: "Unit I: Diversity in the Living World", branch: "Botany" },
  "Biological Classification": { batchId: "BOT-04", classLevel: "Class 11", unit: "Unit I: Diversity in the Living World", branch: "Botany" },
  "Plant Kingdom": { batchId: "BOT-05", highYield: true, classLevel: "Class 11", unit: "Unit I: Diversity in the Living World", branch: "Botany" },
  "Morphology of Flowering Plants": { batchId: "BOT-06", classLevel: "Class 11", unit: "Unit II: Structural Organisation", branch: "Botany" },
  "Anatomy of Flowering Plants": { batchId: "BOT-07", classLevel: "Class 11", unit: "Unit II: Structural Organisation", branch: "Botany" },
  "Respiration in Plants": { batchId: "BOT-08", highYield: true, classLevel: "Class 11", unit: "Unit IV: Plant Physiology", branch: "Botany" },
  "Photosynthesis in Higher Plants": { batchId: "BOT-09", highYield: true, classLevel: "Class 11", unit: "Unit IV: Plant Physiology", branch: "Botany" },
  "Plant Growth and Development": { batchId: "BOT-10", classLevel: "Class 11", unit: "Unit IV: Plant Physiology", branch: "Botany" },
  "Sexual Reproduction in Flowering Plants": { batchId: "BOT-11", highYield: true, classLevel: "Class 12", unit: "Unit VI: Reproduction", branch: "Botany" },
  "Principles of Inheritance and Variation": { batchId: "BOT-12", highYield: true, classLevel: "Class 12", unit: "Unit VII: Genetics and Evolution", branch: "Botany" },
  "Molecular Basis of Inheritance": { batchId: "BOT-13", highYield: true, classLevel: "Class 12", unit: "Unit VII: Genetics and Evolution", branch: "Botany" },
  "Microbes in Human Welfare": { batchId: "BOT-14", classLevel: "Class 12", unit: "Unit VIII: Biology in Human Welfare", branch: "Botany" },
  "Organisms and Populations": { batchId: "BOT-15", highYield: true, classLevel: "Class 12", unit: "Unit X: Ecology and Environment", branch: "Botany" },
  "Ecosystem": { batchId: "BOT-16", highYield: true, classLevel: "Class 12", unit: "Unit X: Ecology and Environment", branch: "Botany" },
  "Biodiversity and Conservation": { batchId: "BOT-17", highYield: true, classLevel: "Class 12", unit: "Unit X: Ecology and Environment", branch: "Botany" },

  // Section II: Zoology (15 Chapters)
  "Structural Organisation in Animals (Frog/Tissues)": { batchId: "ZOO-01", highYield: true, classLevel: "Class 11", unit: "Unit II: Structural Organisation", branch: "Zoology" },
  "Breathing and Exchange of Gases": { batchId: "ZOO-02", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Body Fluids and Circulation": { batchId: "ZOO-03", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Excretory Products and their Elimination": { batchId: "ZOO-04", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Locomotion and Movement": { batchId: "ZOO-05", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Neural Control and Coordination": { batchId: "ZOO-06", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Chemical Coordination and Integration": { batchId: "ZOO-07", classLevel: "Class 11", unit: "Unit V: Human Physiology", branch: "Zoology" },
  "Animal Kingdom": { batchId: "ZOO-08", highYield: true, classLevel: "Class 11", unit: "Unit I: Diversity in the Living World", branch: "Zoology" },
  "Biomolecules": { batchId: "ZOO-09", highYield: true, classLevel: "Class 11", unit: "Unit III: Cell Structure & Function", branch: "Zoology" },
  "Human Reproduction": { batchId: "ZOO-10", highYield: true, classLevel: "Class 12", unit: "Unit VI: Reproduction", branch: "Zoology" },
  "Reproductive Health": { batchId: "ZOO-11", classLevel: "Class 12", unit: "Unit VI: Reproduction", branch: "Zoology" },
  "Human Health and Disease": { batchId: "ZOO-12", highYield: true, classLevel: "Class 12", unit: "Unit VIII: Biology in Human Welfare", branch: "Zoology" },
  "Biotechnology: Principles and Processes": { batchId: "ZOO-13", highYield: true, classLevel: "Class 12", unit: "Unit IX: Biotechnology", branch: "Zoology" },
  "Biotechnology and its Applications": { batchId: "ZOO-14", highYield: true, classLevel: "Class 12", unit: "Unit IX: Biotechnology", branch: "Zoology" },
  "Evolution": { batchId: "ZOO-15", classLevel: "Class 12", unit: "Unit VII: Genetics and Evolution", branch: "Zoology" },
};

export const BIOLOGY_HIGH_YIELD = {
  botany: [
    { unit: "Genetics & Molecular Biology", questions: "12–15 questions" },
    { unit: "Ecology & Environment", questions: "10–12 questions" },
    { unit: "Plant Physiology", questions: "7–9 questions" },
    { unit: "Cell Biology & Division", questions: "6–8 questions" },
  ],
  zoology: [
    { unit: "Human Physiology", questions: "12–14 questions" },
    { unit: "Human Reproduction & Health", questions: "6–8 questions" },
    { unit: "Biotechnology (Both units)", questions: "6–8 questions" },
    { unit: "Animal Kingdom", questions: "4–6 questions" },
  ],
  structureNote: "NEET Exam Structure: Section A: 35 Mandatory Questions • Section B: 15 Questions (Attempt any 10) per subject (Botany & Zoology) • Target Score: 340+ / 360",
  curriculumNote: "In standard coaching and NTA question grouping, Genetics (Principles & Molecular Basis) and Ecology are predominantly mapped under Botany faculties, while cell biology forms the common structural gateway.",
};

// ---------- Chemistry branch metadata ----------
export const CHEMISTRY_BRANCHES = {
  "Physical Chemistry": { short: "PC", color: "#5C8CE0" },
  "Inorganic Chemistry": { short: "IOC", color: "#4FA876" },
  "Organic Chemistry": { short: "OC", color: "#D98A3D" },
};

// ---------- Historical PYQ-based chapter weightage (out of 10) ----------
// Calibrated to NEET UG (and NCERT high-yield) exam patterns. Students can
// still hand-edit any chapter's weightage on the Syllabus page; this is the
// default used the first time a chapter's progress row is created.
export const CHAPTER_WEIGHTAGE = {
  // Biology — Botany (17 Chapters)
  "Cell: The Unit of Life": 8,
  "Cell Cycle and Cell Division": 8,
  "The Living World": 4,
  "Biological Classification": 7,
  "Plant Kingdom": 7,
  "Morphology of Flowering Plants": 7,
  "Anatomy of Flowering Plants": 6,
  "Respiration in Plants": 7,
  "Photosynthesis in Higher Plants": 8,
  "Plant Growth and Development": 6,
  "Sexual Reproduction in Flowering Plants": 8,
  "Principles of Inheritance and Variation": 9,
  "Molecular Basis of Inheritance": 10,
  "Microbes in Human Welfare": 5,
  "Organisms and Populations": 8,
  "Ecosystem": 7,
  "Biodiversity and Conservation": 7,
  // Biology — Zoology (15 Chapters)
  "Structural Organisation in Animals (Frog/Tissues)": 6,
  "Breathing and Exchange of Gases": 6,
  "Body Fluids and Circulation": 7,
  "Excretory Products and their Elimination": 6,
  "Locomotion and Movement": 6,
  "Neural Control and Coordination": 7,
  "Chemical Coordination and Integration": 7,
  "Animal Kingdom": 8,
  "Biomolecules": 8,
  "Human Reproduction": 8,
  "Reproductive Health": 6,
  "Human Health and Disease": 8,
  "Biotechnology: Principles and Processes": 9,
  "Biotechnology and its Applications": 8,
  "Evolution": 7,
  // Physics
  "Basic Mathematics": 4, "Units and Measurement": 5, "Motion in 1 Dimension": 5,
  "Motion in a Plane": 6, "Laws of Motion": 6, "Circular Motion": 4,
  "Work, Energy and Power": 6, "Center of Mass and Collision": 5, "Rotational Motion": 7,
  "Gravitation": 5, "Mechanical Properties of Solids": 3, "Mechanical Properties of Fluids": 4,
  "Thermal Properties of Matter": 4, "KTG and Thermodynamics": 6, "Simple Harmonic Motion": 5,
  "Waves": 5, "Electric Charges and Fields": 6, "Electric Potential and Capacitance": 6,
  "Current Electricity": 8, "Moving Charges and Magnetism": 7, "Magnetism and Matter": 4,
  "Electromagnetic Induction": 6, "Alternating Current": 6, "EM Waves": 4,
  "Ray Optics and Optical Instruments": 8, "Wave Optics": 5, "Dual Nature of Radiation and Matter": 6,
  "Atoms": 5, "Nuclei": 5, "Semiconductors": 8, "Instruments": 3,
  // Chemistry — Physical
  "Some Basic Concepts of Chemistry": 6, "Redox Reactions": 4, "Structure of Atom": 6,
  "State of Matter": 4, "Solutions": 7, "Chemical Kinetics": 7, "Thermodynamics": 7,
  "Chemical Equilibrium": 6, "Ionic Equilibrium": 6, "Electrochemistry": 7,
  "The Solid State": 4, "Surface Chemistry": 3,
  // Chemistry — Inorganic
  "Classification of Elements and Periodicity in Properties": 5, "Chemical Bonding and Molecular Structure": 9,
  "Coordination Compounds": 8, "General Principles and Processes of Isolation of Elements": 3,
  "P-Block Elements": 7, "Hydrogen and its Compounds": 2, "The d and f-Block Elements": 7,
  "S-Block Elements": 4, "Principles of Qualitative Analysis": 3,
  // Chemistry — Organic
  "IUPAC Nomenclature": 4, "General Organic Chemistry (GOC)": 8, "Isomerism": 6,
  "Hydrocarbons": 6, "Haloalkanes and Haloarenes": 5, "Alcohols, Phenols and Ethers": 6,
  "Polymers": 3, "Aldehydes, Ketones and Carboxylic Acids": 8, "Chemistry in Everyday Life": 2,
  "Amines": 6, "Environmental Chemistry": 2,
  // Maths — Algebra
  "Quadratic Equations": 4, "Sequence and Series": 5, "Permutation and Combination": 5,
  "Binomial Theorem": 4, "Determinants": 5, "Matrices": 6, "Sets": 3,
  "Relations and Functions": 4, "Complex Numbers": 6,
  // Maths — Trigonometry
  "Trigonometric Functions": 4, "Trigonometric Equations": 4,
  "Inverse Trigonometric Functions": 3, "Solution of Triangles": 3,
  // Maths — Coordinate Geometry
  "Straight Lines": 5, "Circles": 5, "Parabola": 5, "Ellipse": 4, "Hyperbola": 4,
  // Maths — Calculus
  "Method of Differentiation": 5, "Limit, Continuity and Differentiability": 6,
  "Application of Derivatives": 6, "Indefinite Integration": 5, "Definite Integration": 7,
  "Application of Integrals": 5, "Differential Equations": 5,
  // Maths — Vectors, 3D & Statistics
  "Vector Algebra": 4, "Three Dimensional Geometry": 5, "Statistics": 4, "Probability": 6,
};

export const weightageFor = (chapterName) => CHAPTER_WEIGHTAGE[chapterName] ?? 5;

// ---------- Prerequisite graph ----------
export const PREREQUISITES = {
  // Biology prerequisites
  "Biology::Cell Cycle and Cell Division": ["Biology::Cell: The Unit of Life"],
  "Biology::Biological Classification": ["Biology::The Living World"],
  "Biology::Plant Kingdom": ["Biology::Biological Classification"],
  "Biology::Anatomy of Flowering Plants": ["Biology::Morphology of Flowering Plants"],
  "Biology::Respiration in Plants": ["Biology::Cell: The Unit of Life"],
  "Biology::Photosynthesis in Higher Plants": ["Biology::Cell: The Unit of Life"],
  "Biology::Plant Growth and Development": ["Biology::Morphology of Flowering Plants"],
  "Biology::Sexual Reproduction in Flowering Plants": ["Biology::Morphology of Flowering Plants", "Biology::Cell Cycle and Cell Division"],
  "Biology::Principles of Inheritance and Variation": ["Biology::Cell Cycle and Cell Division"],
  "Biology::Molecular Basis of Inheritance": ["Biology::Principles of Inheritance and Variation", "Biology::Biomolecules"],
  "Biology::Ecosystem": ["Biology::Organisms and Populations"],
  "Biology::Biodiversity and Conservation": ["Biology::Organisms and Populations"],
  "Biology::Animal Kingdom": ["Biology::Biological Classification"],
  "Biology::Biomolecules": ["Biology::Cell: The Unit of Life"],
  "Biology::Body Fluids and Circulation": ["Biology::Breathing and Exchange of Gases"],
  "Biology::Chemical Coordination and Integration": ["Biology::Neural Control and Coordination"],
  "Biology::Human Reproduction": ["Biology::Cell Cycle and Cell Division"],
  "Biology::Reproductive Health": ["Biology::Human Reproduction"],
  "Biology::Biotechnology: Principles and Processes": ["Biology::Molecular Basis of Inheritance"],
  "Biology::Biotechnology and its Applications": ["Biology::Biotechnology: Principles and Processes"],
  "Biology::Evolution": ["Biology::Principles of Inheritance and Variation"],
  // Physics prerequisites
  "Physics::Motion in a Plane": ["Physics::Basic Mathematics"],
  "Physics::Laws of Motion": ["Physics::Motion in 1 Dimension"],
  "Physics::Center of Mass and Collision": ["Physics::Laws of Motion"],
  "Physics::Rotational Motion": ["Physics::Center of Mass and Collision"],
  "Physics::Simple Harmonic Motion": ["Physics::Motion in 1 Dimension"],
  "Physics::Electric Potential and Capacitance": ["Physics::Electric Charges and Fields"],
  "Physics::Current Electricity": ["Physics::Electric Charges and Fields"],
  "Physics::Moving Charges and Magnetism": ["Physics::Current Electricity"],
  "Physics::Magnetism and Matter": ["Physics::Moving Charges and Magnetism"],
  "Physics::Electromagnetic Induction": ["Physics::Moving Charges and Magnetism"],
  "Physics::Alternating Current": ["Physics::Electromagnetic Induction"],
  "Physics::Wave Optics": ["Physics::Ray Optics and Optical Instruments"],
  "Physics::Dual Nature of Radiation and Matter": ["Physics::Ray Optics and Optical Instruments"],
  "Physics::Atoms": ["Physics::Dual Nature of Radiation and Matter"],
  "Physics::Nuclei": ["Physics::Atoms"],
  // Chemistry prerequisites
  "Chemistry::Ionic Equilibrium": ["Chemistry::Chemical Equilibrium"],
  "Chemistry::Electrochemistry": ["Chemistry::Redox Reactions"],
  "Chemistry::Coordination Compounds": ["Chemistry::Chemical Bonding and Molecular Structure"],
  "Chemistry::The d and f-Block Elements": ["Chemistry::Classification of Elements and Periodicity in Properties"],
  "Chemistry::Hydrocarbons": ["Chemistry::Isomerism"],
  "Chemistry::Haloalkanes and Haloarenes": ["Chemistry::Hydrocarbons"],
  "Chemistry::Alcohols, Phenols and Ethers": ["Chemistry::Haloalkanes and Haloarenes"],
  "Chemistry::Aldehydes, Ketones and Carboxylic Acids": ["Chemistry::Alcohols, Phenols and Ethers"],
  "Chemistry::Amines": ["Chemistry::Aldehydes, Ketones and Carboxylic Acids"],
  // Mathematics prerequisites
  "Mathematics::Application of Derivatives": ["Mathematics::Method of Differentiation"],
  "Mathematics::Definite Integration": ["Mathematics::Indefinite Integration"],
  "Mathematics::Application of Integrals": ["Mathematics::Definite Integration"],
  "Mathematics::Differential Equations": ["Mathematics::Definite Integration"],
  "Mathematics::Three Dimensional Geometry": ["Mathematics::Vector Algebra"],
  "Mathematics::Trigonometric Equations": ["Mathematics::Trigonometric Functions"],
};

export const prerequisitesFor = (subject, chapterName) => PREREQUISITES[`${subject}::${chapterName}`] || [];

export const ALL_CHAPTERS = (() => {
  const list = [];
  Object.entries(SYLLABUS).forEach(([subject, data]) => {
    Object.entries(data.groups).forEach(([group, chs]) => {
      chs.forEach((name) => {
        const bioMeta = subject === "Biology" ? BIOLOGY_CHAPTER_META[name] : null;
        list.push({
          subject,
          group,
          name,
          key: `${subject}::${name}`,
          ...(bioMeta ? { batchId: bioMeta.batchId, classLevel: bioMeta.classLevel, unit: bioMeta.unit } : {}),
        });
      });
    });
  });
  return list;
})();

export const getActiveChapters = (profileOrStream) => {
  const activeSet = new Set(getActiveSubjects(profileOrStream));
  return ALL_CHAPTERS.filter((c) => activeSet.has(c.subject));
};

export const DEFAULT_CHAPTER_PROGRESS = {
  status: "Not Started",
  priority: "Medium",
  difficulty: "Medium",
  weightage: 5,
  lectures_total: 4,
  lectures_done: 0,
  dpp_pending: 2,
  pyq_pending: 10,
  notes_pending: 1,
  favorite: false,
};

export const defaultChapterProgressFor = (chapterName) => ({
  ...DEFAULT_CHAPTER_PROGRESS,
  weightage: weightageFor(chapterName),
});
