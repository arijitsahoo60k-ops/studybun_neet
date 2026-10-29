import React from "react";
import Mascot from "../Mascot";

// Memoised so the mascot SVG isn't re-rendered by the once-a-second clock.
const MemberAvatar = React.memo(function MemberAvatar({ species, studying, size = 44 }) {
  return <Mascot species={species || "bunny"} mood={studying ? "studying" : "idle"} size={size} ambient={false} />;
});
export default MemberAvatar;
