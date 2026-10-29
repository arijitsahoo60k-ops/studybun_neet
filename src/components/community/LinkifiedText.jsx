import React, { memo, useMemo } from "react";
import { linkify } from "../../lib/linkify";

// Renders user-written text with http(s)/www URLs turned into real links.
// Text without a URL is returned as the bare string, so the DOM is identical
// to what the call sites rendered before this component existed.
//
// Links open in a new tab with rel="noopener noreferrer nofollow ugc" (this is
// user-generated content), and the click is stopped from bubbling so tapping a
// link inside a chat bubble doesn't also toggle the bubble's action bar.
const stop = (e) => e.stopPropagation();

function LinkifiedText({ text }) {
  const parts = useMemo(() => linkify(text), [text]);
  if (parts.length === 1 && parts[0].type === "text") return <>{parts[0].text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "link" ? (
          <a
            key={i}
            className="sb-link"
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            onClick={stop}
          >
            {p.text}
          </a>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        )
      )}
    </>
  );
}

export default memo(LinkifiedText);
