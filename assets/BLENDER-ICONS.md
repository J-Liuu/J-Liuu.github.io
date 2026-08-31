# Blender Icon Sources

The interface icons in `blender_ui_grouped.svg` and
`blender_startup_grouped_jacky_v7.svg` are Blender artwork.

- Catalog supplied by Jacky: https://ui.blender.org/icons
- Original SVGs: https://github.com/blender/blender/tree/9962fbfc5107b00246d0260e5d2ee502b4aeb7b4/release/datafiles/icons_svg
- Original toolbar geometry: https://github.com/blender/blender/tree/9962fbfc5107b00246d0260e5d2ee502b4aeb7b4/release/datafiles/icons
- Toolbar binary downloads: https://projects.blender.org/blender/blender/media/branch/main/release/datafiles/icons/ (checked against the pinned revision's SHA-256 hashes)
- Geometry format: `release/datafiles/blender_icons_geom.py` in that revision.
- Copyright: Blender Foundation and Blender contributors.
- Upstream licensing notice: https://github.com/blender/blender/blob/9962fbfc5107b00246d0260e5d2ee502b4aeb7b4/COPYING
- License text: `licenses/Blender-GPL-2.0.txt` alongside this file.

Blender distributes these source assets with its GNU GPL licensing notice.
This attribution concerns the imported artwork, not Jacky's project content.
Blender's name and logo belong to their respective owners; this portfolio is
not affiliated with or endorsed by Blender.

## Local Adaptations

Small icons are embedded as SVG symbols. White fills and strokes inherit the
interface color, editor metadata is removed, and internal IDs are prefixed to
prevent collisions. Tool icons are converted from Blender's triangle geometry
to SVG paths with their original coordinates and colors, flipping the vertical
axis for SVG. Every placement uses a centered, fixed-size icon box.

The two top-left Blender marks use an orange outer shape, a white eye ring,
and a near-black center to match Jacky's supplied reference. The ring reuses
the original eye path at a larger scale; the icon import script preserves this
customization when rebuilding.

The collection uses `outliner_collection`; its children use
`outliner_ob_camera`, `mesh_cube`, and `outliner_ob_light`. The cube deliberately
uses Blender's 3D cube rather than the generic triangular mesh-object icon.

## Updating

Run `./scripts/update-blender-icons.ps1` from PowerShell to rebuild the embedded
symbols from the pinned upstream revision. It downloads only the icons
referenced by the two SVGs and caches the originals in the system temporary
directory. Use `-Offline` to rebuild from that cache without network access.
No script or external asset request is needed when the portfolio is viewed.
