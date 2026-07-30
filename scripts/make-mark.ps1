# Generates every surface of the app mark from one geometry.
#
#     F O
#     U R
#
# JetBrains Mono is monospace, so all four caps share one advance width - the
# grid is a property of the typeface rather than something imposed on it. Same
# face as the hero readout on the dashboard, so the icon and the number it opens
# onto are set in the same voice.
#
# Run from anywhere:  pwsh ./scripts/make-mark.ps1
#
# Outputs, and why each differs:
#   apps/mobile/assets/images/icon.png         opaque, Format24bppRgb. The App
#                                              Store REJECTS an app icon carrying
#                                              an alpha channel, so none is ever
#                                              created rather than flattened.
#   apps/mobile/assets/images/splash-icon.png  transparent, so expo-splash-screen's
#                                              own backgroundColor shows through
#                                              instead of a baked-in rectangle.
#   apps/web/app/icon.svg                      the favicon, as outlines - see the
#                                              note in New-MarkSvg.
#   apps/web/app/apple-icon.png                Safari "Add to Home Screen".
#
# This is a PLACEHOLDER mark, deliberately. It exists because the app shipped
# with Expo's own logo, which is another company's, and a blank splash. When real
# branding arrives, replace the outputs or the constants - do not hand-edit the
# generated files, or the surfaces drift apart again.

Add-Type -AssemblyName System.Drawing

$BG   = '#0d1013'   # color.bg  - see apps/mobile/src/theme.ts
$INK  = '#eceff1'   # color.ink - 16.52:1 on bg
$ROWS = @(@('F', 'O'), @('U', 'R'))

$repo     = Split-Path $PSScriptRoot -Parent
$fontFile = Join-Path $repo 'node_modules\@expo-google-fonts\jetbrains-mono\700Bold\JetBrainsMono_700Bold.ttf'
$assets   = Join-Path $repo 'apps\mobile\assets\images'
$web      = Join-Path $repo 'apps\web\app'

if (-not (Test-Path $fontFile)) {
    throw "JetBrains Mono 700 not found. Run npm install first: $fontFile"
}

$collection = New-Object System.Drawing.Text.PrivateFontCollection
$collection.AddFontFile($fontFile)
$family = $collection.Families[0]

# A privately-loaded single-weight file usually exposes itself as Regular even
# though the outlines are bold. Ask rather than assume.
$style = [System.Drawing.FontStyle]::Regular
if (-not $family.IsStyleAvailable($style)) { $style = [System.Drawing.FontStyle]::Bold }

function Get-Block {
    <#
        Builds the four-glyph block as a single GraphicsPath, scaled and centred
        for a square canvas of $Canvas units. Returned rather than drawn, so the
        same geometry can be rasterised to PNG or serialised to SVG.
    #>
    param(
        [int]$Canvas,
        [double]$Fill           # mark height as a fraction of the canvas
    )

    $em  = 340.0
    $fmt = [System.Drawing.StringFormat]::GenericTypographic

    # Pass one: outline every glyph at the origin and record its true ink bounds.
    # GetBounds is the only honest measure - side bearings and the optical
    # overshoot on O and U mean the advance width is not what the eye centres on.
    $glyphs = @()
    $cellW = 0.0
    $cellH = 0.0
    foreach ($r in 0..1) {
        foreach ($c in 0..1) {
            $outline = New-Object System.Drawing.Drawing2D.GraphicsPath
            $outline.AddString(
                $ROWS[$r][$c], $family, [int]$style, $em,
                (New-Object System.Drawing.PointF(0, 0)), $fmt)
            $bounds = $outline.GetBounds()
            $glyphs += [pscustomobject]@{ Shape = $outline; Bounds = $bounds; Row = $r; Col = $c }
            if ($bounds.Width  -gt $cellW) { $cellW = [double]$bounds.Width }
            if ($bounds.Height -gt $cellH) { $cellH = [double]$bounds.Height }
        }
    }

    # One gutter, both axes, expressed against cap height so it does not drift
    # when the em size changes. Two rows of caps are inherently taller than two
    # monospace glyphs are wide, so a shared gutter is what keeps the four cells
    # reading as a block rather than as two lines of type.
    $gutter = $cellH * 0.16

    # Pass two: seat each glyph in its cell, optically centred on its own ink.
    foreach ($glyph in $glyphs) {
        $cellX = $glyph.Col * ($cellW + $gutter)
        $cellY = $glyph.Row * ($cellH + $gutter)
        $dx = $cellX + (($cellW - $glyph.Bounds.Width)  / 2.0) - $glyph.Bounds.X
        $dy = $cellY + (($cellH - $glyph.Bounds.Height) / 2.0) - $glyph.Bounds.Y

        $move = New-Object System.Drawing.Drawing2D.Matrix
        $move.Translate([single]$dx, [single]$dy)
        $glyph.Shape.Transform($move)
        $move.Dispose()
    }

    # Pass three: centre the block on the canvas as one unit.
    #
    # Scale on HEIGHT, not on the longer side. The block is portrait - see the
    # gutter note above - so fitting the longest side to a square target strands
    # it in wide side margins and reads as an under-sized mark.
    $block = New-Object System.Drawing.Drawing2D.GraphicsPath
    foreach ($glyph in $glyphs) { $block.AddPath($glyph.Shape, $false) }

    $scale = ([double]$Canvas * $Fill) / [double]$block.GetBounds().Height
    $fit = New-Object System.Drawing.Drawing2D.Matrix
    $fit.Scale([single]$scale, [single]$scale)
    $block.Transform($fit)
    $fit.Dispose()

    $scaled = $block.GetBounds()
    $centre = New-Object System.Drawing.Drawing2D.Matrix
    $centre.Translate(
        [single](($Canvas - $scaled.Width)  / 2.0 - $scaled.X),
        [single](($Canvas - $scaled.Height) / 2.0 - $scaled.Y))
    $block.Transform($centre)
    $centre.Dispose()

    foreach ($glyph in $glyphs) { $glyph.Shape.Dispose() }
    return $block
}

function New-Mark {
    param(
        [int]$Canvas,
        [string]$Destination,
        [double]$Fill,
        [switch]$Transparent
    )

    $format = if ($Transparent) {
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    } else {
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    }

    $bitmap = New-Object System.Drawing.Bitmap($Canvas, $Canvas, $format)
    $gfx = [System.Drawing.Graphics]::FromImage($bitmap)
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    if ($Transparent) {
        $gfx.Clear([System.Drawing.Color]::Transparent)
    } else {
        $gfx.Clear([System.Drawing.ColorTranslator]::FromHtml($BG))
    }

    $block = Get-Block -Canvas $Canvas -Fill $Fill
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($INK))
    $gfx.FillPath($brush, $block)

    $brush.Dispose()
    $block.Dispose()
    $gfx.Dispose()
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()

    Write-Output ("wrote {0}" -f (Split-Path $Destination -Leaf))
}

function New-MarkSvg {
    <#
        Serialises the same block to SVG path data.

        The outlines are emitted as real geometry rather than a <text> element,
        because a browser rendering a favicon has no access to JetBrains Mono and
        would silently substitute whatever it had.

        GDI+ encodes a path as parallel point and type arrays. The low three bits
        of each type give the segment kind (0 start, 1 line, 3 cubic bezier in
        groups of three) and 0x80 flags the end of a closed subpath.
    #>
    param([int]$Canvas, [double]$Fill, [string]$Destination)

    $block = Get-Block -Canvas $Canvas -Fill $Fill
    $pts = $block.PathPoints
    $types = $block.PathTypes

    $d = New-Object System.Text.StringBuilder
    $r = { param($v) [Math]::Round([double]$v, 1) }

    for ($i = 0; $i -lt $pts.Length; $i++) {
        switch ($types[$i] -band 0x07) {
            0 { [void]$d.Append(('M{0} {1}' -f (& $r $pts[$i].X), (& $r $pts[$i].Y))) }
            1 { [void]$d.Append((' L{0} {1}' -f (& $r $pts[$i].X), (& $r $pts[$i].Y))) }
            3 {
                [void]$d.Append((' C{0} {1} {2} {3} {4} {5}' -f
                    (& $r $pts[$i].X),     (& $r $pts[$i].Y),
                    (& $r $pts[$i + 1].X), (& $r $pts[$i + 1].Y),
                    (& $r $pts[$i + 2].X), (& $r $pts[$i + 2].Y)))
                $i += 2
            }
        }
        if ($types[$i] -band 0x80) { [void]$d.Append(' Z') }
    }

    $block.Dispose()

    $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $Canvas $Canvas">
  <!--
    The name as a 2x2 block: F O / U R.

    Outlines, not <text> - a favicon renders without the page's fonts, so
    JetBrains Mono 700 is baked in as geometry here.

    GENERATED by scripts/make-mark.ps1, alongside the native app icon, so the
    browser tab and the home screen cannot drift apart. Do not hand-edit.
  -->
  <rect width="$Canvas" height="$Canvas" rx="$([Math]::Round($Canvas * 0.22))" fill="$BG"/>
  <path fill="$INK" d="$($d.ToString())"/>
</svg>
"@

    Set-Content -Path $Destination -Value $svg -Encoding utf8
    Write-Output ("wrote {0}" -f (Split-Path $Destination -Leaf))
}

# --- mobile -------------------------------------------------------------------
# 0.74 leaves ~13% top and bottom, clear of iOS's superellipse mask.
New-Mark -Canvas 1024 -Destination (Join-Path $assets 'icon.png') -Fill 0.74

# The splash mark carries no ground of its own, so it needs no mask clearance -
# expo-splash-screen scales it to `imageWidth` and centres it on backgroundColor.
New-Mark -Canvas 512 -Destination (Join-Path $assets 'splash-icon.png') -Fill 0.92 -Transparent

# --- web ----------------------------------------------------------------------
# The favicon. Rounded corners are drawn in, since a browser tab applies none.
New-MarkSvg -Canvas 256 -Fill 0.70 -Destination (Join-Path $web 'icon.svg')

# iOS masks this one itself, so no rx and the same clearance as the native icon.
New-Mark -Canvas 180 -Destination (Join-Path $web 'apple-icon.png') -Fill 0.74
