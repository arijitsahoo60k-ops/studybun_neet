# Dark mode notes
- Toggle lives only in Settings > Mascot & theme > Appearance (sidebar button removed). Switching is optimistic (instant), then saved to profiles.dark_mode.
- Hard "sticker" shadows are themeable via `--sticker-shadow` (falls back to the outline colour, so light mode is unchanged; dark sets it to transparent).
- Dark surface tokens (`--clay-*`, `--row-bg`, `--glow-*`) are built once per theme in `themeVars()` (cached).
- Perf rules: no full-screen blend-mode overlays, one small blurred shadow per raised surface, nested rows are flat tints, no filters on animated SVGs, no `*` selectors.
