import React from "react";

/* Purely decorative, self-contained layer for the "photo-backdrop" themes
   (Wildwood CRT, Midnight Express, Windmill Meadow, Sunset Drift, Pixel
   Garden, Dusk Alley, Paper Sky, Meadow Post, Sherbet Alley, Petal Serenade,
   Stitched Cosmos, Velvet Skyline — see src/data/themes.js). Mounted once in
   App.jsx, right next to <CustomBackgroundLayer/>, and just as inert
   everywhere else:

   - `position: fixed` with z-index -2 (one step further back than
     CustomBackgroundLayer's -1), so it never touches layout on any page.
   - It renders nothing at all for the other themes (`theme.photoBg` is
     only set on the photo-backdrop entries), so nothing about them changes.
   - If the user has their own Settings > Custom Background image active,
     that layer sits at z-index -1 and fully covers this one — no JS
     coordination needed, the user's own photo always wins automatically.
   - Cards/sidebar/every surface keep their normal opaque backgrounds
     exactly as before; .sb-app[data-photo-bg="true"] (GlobalStyle.jsx) is
     the only rule that changes, dropping .sb-app's own opaque paint so the
     image shows through the gaps around them, same as the custom-bg
     feature already does. */
export default function ThemePhotoLayer({ theme }) {
  if (!theme?.photoBg || !theme?.bgImage) return null;

  return (
    <div className="sb-theme-photo-layer" aria-hidden="true">
      <div
        className="sb-theme-photo-img"
        style={{ backgroundImage: `url("${theme.bgImage}")` }}
      />
      <div className="sb-theme-photo-scrim" />
    </div>
  );
}
