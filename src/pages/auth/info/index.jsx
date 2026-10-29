import React from "react";
import InfoHero from "./InfoHero";
import FeatureGrid from "./FeatureGrid";
import DataNote from "./DataNote";
import FaqList from "./FaqList";

export default function AuthInfo() {
  return (
    <div className="sb-flow-card sb-info-panel">
      <InfoHero />
      <FeatureGrid />
      <DataNote />
      <FaqList />
    </div>
  );
}
