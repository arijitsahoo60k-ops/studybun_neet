import React, { useState, useEffect } from "react";
import { Layers, Atom, Dna, FlaskConical, ChevronRight } from "lucide-react";
import { Card, SectionTitle } from "../components/ui";
import PeriodicTable from "../components/PeriodicTable";
import ProteinVisualizer from "../components/protein/ProteinVisualizer";
import AminoAcids from "../components/AminoAcids";

/* Every reference tool StudyBun offers lives here. This list is the whole
 * point of the page -- new graphs/reference charts get a new entry here and
 * nothing else about the page needs to change. `render` gets the onBack
 * callback used to return to the list. */
const TOOLS = [
  {
    id: "periodic-table",
    title: "Periodic Table",
    blurb: "All 118 elements — searchable, colour-coded by category, block, or phase, with a full detail card and Bohr shell diagram for each one.",
    icon: Atom,
    render: (onBack) => <PeriodicTable onBack={onBack} />,
  },
  {
    id: "protein-structure",
    title: "Protein Structure",
    blurb: "See a protein fold from amino-acid chain to full 3D assembly — primary, secondary, tertiary and quaternary, with an interactive rotate-and-zoom model.",
    icon: Dna,
    render: (onBack) => <ProteinVisualizer onBack={onBack} />,
  },
  {
    id: "amino-acids",
    title: "Amino Acids",
    blurb: "The building blocks of proteins — structure, naming, and the full NCERT table of all 20 natural amino acids with their side chains and codes.",
    icon: FlaskConical,
    render: (onBack) => <AminoAcids onBack={onBack} />,
  },
];

function ToolCard({ tool, onOpen }) {
  const Icon = tool.icon;
  return (
    <Card className="sb-stuff-card sb-clickable" onClick={() => onOpen(tool.id)}>
      <div className="sb-stuff-card-top">
        <span className="sb-icon-badge sb-stuff-icon"><Icon size={18} /></span>
        <ChevronRight size={16} className="sb-stuff-chevron" />
      </div>
      <h3 className="sb-stuff-title">{tool.title}</h3>
      <p className="sb-stuff-blurb">{tool.blurb}</p>
    </Card>
  );
}

export default function StudyStuffsPage() {
  const [openId, setOpenId] = useState(null);
  const openTool = TOOLS.find((t) => t.id === openId);

  // List <-> tool is a sub-view swap inside this one page (not a page nav),
  // so App.jsx's own "scroll to top on page change" effect never fires for
  // it -- do the same reset locally whenever the sub-view changes.
  useEffect(() => {
    const main = document.querySelector(".sb-main");
    if (main) main.scrollTop = 0;
  }, [openId]);

  if (openTool) {
    return (
      <div className="sb-page sb-page-studystuffs sb-page-studystuffs-detail">
        {openTool.render(() => setOpenId(null))}
      </div>
    );
  }

  return (
    <div className="sb-page sb-page-studystuffs">
      <Card>
        <SectionTitle icon={Layers}>Study Stuffs</SectionTitle>
        <p className="sb-muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Reference charts and interactive NCERT tools for NEET (Periodic Table, 3D Protein Folding, and 20 Amino Acids), all in one place. Tap a card to open it full-screen.
        </p>
      </Card>

      <div className="sb-stuff-grid">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onOpen={setOpenId} />
        ))}
      </div>
    </div>
  );
}
