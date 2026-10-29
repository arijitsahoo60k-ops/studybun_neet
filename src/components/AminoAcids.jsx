import React from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "./ui";
import { AMINO_ACIDS, ESSENTIAL_COUNT } from "../data/aminoAcids";

/* One amino acid, rendered twice from the same data: as a <tr> for the
 * tablet/desktop table and as a stacked card for phones (see the
 * max-width: 680px swap in GlobalStyle.jsx — .sb-aa-table-scroll vs
 * .sb-aa-cards). Keeping both markups here, side by side, means a future
 * edit to a row's fields can't update one view and forget the other. */
function AminoAcidRow({ aa, index }) {
  return (
    <tr className={aa.essential ? "sb-aa-row-essential" : ""}>
      <td className="sb-aa-td-num">{index + 1}</td>
      <td className="sb-aa-td-name">
        {aa.name}
        {aa.essential && <span className="sb-aa-star" title="Essential amino acid">*</span>}
      </td>
      <td className="sb-aa-td-r">{aa.r}</td>
      <td className="sb-aa-td-code">{aa.three}</td>
      <td className="sb-aa-td-code">{aa.one}</td>
    </tr>
  );
}

function AminoAcidCard({ aa, index }) {
  return (
    <div className={`sb-aa-card ${aa.essential ? "sb-aa-card-essential" : ""}`}>
      <div className="sb-aa-card-head">
        <span className="sb-aa-card-num">{index + 1}</span>
        <span className="sb-aa-card-name">
          {aa.name}
          {aa.essential && <span className="sb-aa-star" title="Essential amino acid">*</span>}
        </span>
        <span className="sb-aa-card-codes">{aa.three} · {aa.one}</span>
      </div>
      <div className="sb-aa-card-r">
        <span className="sb-aa-card-r-label">Side chain (R)</span>
        {aa.r}
      </div>
    </div>
  );
}

export default function AminoAcids({ onBack }) {
  return (
    <div className="sb-aa-wrap">
      <Card>
        <button className="sb-pt-back" onClick={onBack}>
          <ArrowLeft size={16} /> Study Stuffs
        </button>
        <h2 className="sb-aa-title">Amino Acids</h2>
        <p className="sb-muted" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "2px 0 0" }}>
          The building blocks of proteins — where they come from, what makes them tick, and all 20 natural amino acids from NCERT Table 10.2.
        </p>
      </Card>

      <Card>
        <h3 className="sb-aa-h3">Proteins — the basics</h3>
        <ul className="sb-aa-list">
          <li>Proteins are the most abundant biomolecules in living systems.</li>
          <li>Chief sources: milk, cheese, pulses, peanuts, fish, meat, etc.</li>
          <li>Found in every part of the body — they form the structural and functional basis of life.</li>
          <li>Essential for the body's growth and maintenance.</li>
          <li>The word "protein" comes from the Greek <em>proteios</em>, meaning primary or of prime importance.</li>
          <li>Every protein is a polymer built entirely from α-amino acids.</li>
        </ul>
      </Card>

      <Card>
        <h3 className="sb-aa-h3">What is an amino acid?</h3>
        <ul className="sb-aa-list">
          <li>Amino acids carry two functional groups: an amino group (–NH₂) and a carboxyl group (–COOH).</li>
          <li>Based on where the amino group sits relative to the carboxyl group, they're classified as α, β, γ, δ, and so on.</li>
          <li>Only <strong>α-amino acids</strong> are obtained when proteins are hydrolysed.</li>
          <li>Many amino acids also carry other functional groups beyond just –NH₂ and –COOH.</li>
        </ul>
        <div className="sb-aa-formula-box">
          <span className="sb-aa-formula">R–CH(NH₂)–COOH</span>
          <span className="sb-aa-formula-cap">general structure of an α-amino acid (R = side chain)</span>
        </div>
      </Card>

      <Card>
        <h3 className="sb-aa-h3">Where the names come from</h3>
        <ul className="sb-aa-list">
          <li>All α-amino acids have trivial names that usually point to a property or source of the compound.</li>
          <li><strong>Glycine</strong> — named for its sweet taste (Greek <em>glykos</em> = sweet).</li>
          <li><strong>Tyrosine</strong> — first obtained from cheese (Greek <em>tyros</em> = cheese).</li>
          <li>Amino acids are usually written with a three-letter symbol; sometimes a one-letter code is used instead.</li>
        </ul>
      </Card>

      <Card className="sb-aa-table-card">
        <h3 className="sb-aa-h3">Table 10.2 — Natural Amino Acids</h3>
        <p className="sb-muted" style={{ fontSize: 12, lineHeight: 1.55, margin: "0 0 10px" }}>
          General structure: H₂N–CH(R)–COOH. Names marked <span className="sb-aa-star">*</span> are essential
          amino acids ({ESSENTIAL_COUNT} of the 20) — the body can't make these, so they have to come from diet.
        </p>

        <div className="sb-aa-table-scroll">
          <table className="sb-aa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Amino acid</th>
                <th>Side chain (R)</th>
                <th>3-letter</th>
                <th>1-letter</th>
              </tr>
            </thead>
            <tbody>
              {AMINO_ACIDS.map((aa, i) => (
                <AminoAcidRow key={aa.three} aa={aa} index={i} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="sb-aa-cards">
          {AMINO_ACIDS.map((aa, i) => (
            <AminoAcidCard key={aa.three} aa={aa} index={i} />
          ))}
        </div>

        <p className="sb-aa-footnote">
          <span className="sb-aa-star">*</span> essential amino acid &nbsp;·&nbsp; Proline's R column shows its
          entire structure — it's a cyclic amino acid, not the usual R–CH(NH₂)–COOH shape.
        </p>
      </Card>
    </div>
  );
}
