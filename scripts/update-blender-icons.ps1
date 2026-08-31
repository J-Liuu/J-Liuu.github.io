param(
    [string]$CacheDirectory = (Join-Path ([IO.Path]::GetTempPath()) 'jacky-blender-icons'),
    [switch]$Offline
)

$ErrorActionPreference = 'Stop'
$revision = '9962fbfc5107b00246d0260e5d2ee502b4aeb7b4'
$sourceBase = "https://raw.githubusercontent.com/blender/blender/$revision"
$repo = Split-Path $PSScriptRoot -Parent
$svgNamespace = 'http://www.w3.org/2000/svg'
$cache = Join-Path $CacheDirectory $revision
[void][IO.Directory]::CreateDirectory($cache)

function Get-SourceFile([string]$name, [string]$sourcePath) {
    $destination = Join-Path $cache $name
    $needsDownload = -not (Test-Path -LiteralPath $destination)
    if (-not $needsDownload -and $name.EndsWith('.dat')) {
        $cachedBytes = [IO.File]::ReadAllBytes($destination)
        $needsDownload = $cachedBytes.Length -lt 8 -or [Text.Encoding]::ASCII.GetString($cachedBytes, 0, 3) -ne 'VCO'
    }
    if ($needsDownload) {
        if ($Offline) { throw "Missing cached icon source: $name" }
        $url = "$sourceBase/$sourcePath"
        $expectedHash = $null
        if ($name.EndsWith('.dat')) {
            # Toolbar geometry is stored in Git LFS, not the raw Git blob.
            $pointer = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
            if ($pointer -notmatch 'oid sha256:([a-f0-9]{64})') { throw "Missing LFS hash for $name" }
            $expectedHash = $Matches[1]
            $url = "https://projects.blender.org/blender/blender/media/branch/main/$sourcePath"
        }
        Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing
        if ($expectedHash -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $expectedHash) {
            throw "Toolbar source $name no longer matches the pinned revision."
        }
    }
    return $destination
}

function Read-Svg([string]$path) {
    $document = [Xml.XmlDocument]::new()
    $document.PreserveWhitespace = $true
    $document.XmlResolver = $null
    $document.Load($path)
    return ,$document
}

function New-GeometrySymbol([Xml.XmlDocument]$document, [string]$name) {
    $path = Get-SourceFile "$name.dat" "release/datafiles/icons/$name.dat"
    $bytes = [IO.File]::ReadAllBytes($path)
    if ($bytes.Length -lt 8 -or [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne "VCO`0" -or ($bytes.Length - 8) % 18) {
        throw "Invalid Blender geometry icon: $name"
    }
    $count = [int](($bytes.Length - 8) / 18)
    $width = [int]$bytes[4]
    $height = [int]$bytes[5]
    $symbol = $document.CreateElement('symbol', $svgNamespace)
    $symbol.SetAttribute('viewBox', "0 0 $width $height")
    $symbol.SetAttribute('fill', 'none')
    $previousColor = ''
    $shape = $null

    # Blender stores all triangle coordinates first, followed by per-vertex RGBA.
    # Combine adjacent same-color triangles into one path to avoid hairline seams.
    for ($i = 0; $i -lt $count; $i++) {
        $colorIndex = 8 + $count * 6 + $i * 12
        $rgba = $bytes[$colorIndex..($colorIndex + 3)]
        for ($vertex = 1; $vertex -lt 3; $vertex++) {
            for ($channel = 0; $channel -lt 4; $channel++) {
                if ($bytes[$colorIndex + $vertex * 4 + $channel] -ne $rgba[$channel]) {
                    throw "Non-flat triangle color in $name; conversion needs interpolation."
                }
            }
        }
        $color = $rgba -join ','
        if ($color -ne $previousColor) {
            $shape = $document.CreateElement('path', $svgNamespace)
            $shape.SetAttribute('fill', ('#{0:x2}{1:x2}{2:x2}' -f $rgba[0], $rgba[1], $rgba[2]))
            if ($rgba[3] -ne 255) {
                $shape.SetAttribute('fill-opacity', ([double]($rgba[3] / 255)).ToString('0.####', [Globalization.CultureInfo]::InvariantCulture))
            }
            [void]$symbol.AppendChild($shape)
            $previousColor = $color
        }
        $coordinateIndex = 8 + $i * 6
        $points = for ($vertex = 0; $vertex -lt 3; $vertex++) {
            $x = [int]$bytes[$coordinateIndex + $vertex * 2]
            $y = $height - [int]$bytes[$coordinateIndex + $vertex * 2 + 1]
            "$x,$y"
        }
        $shape.SetAttribute('d', $shape.GetAttribute('d') + "M$($points[0])L$($points[1]) $($points[2])Z")
    }
    return ,$symbol
}

function New-CatalogSymbol([Xml.XmlDocument]$document, [string]$name) {
    $path = Get-SourceFile "$name.svg" "release/datafiles/icons_svg/$name.svg"
    $source = Read-Svg $path
    $root = $source.DocumentElement
    if ($root.LocalName -ne 'svg' -or -not $root.HasAttribute('viewBox')) {
        throw "Invalid SVG source: $name"
    }
    # Keep rendering data only; editor metadata is not needed in the portfolio.
    foreach ($node in @($root.SelectNodes('.//*'))) {
        if ($node.NamespaceURI -ne $svgNamespace -or $node.LocalName -in @('metadata', 'title', 'desc')) {
            if ($node.ParentNode) { [void]$node.ParentNode.RemoveChild($node) }
        }
    }
    $symbol = $document.CreateElement('symbol', $svgNamespace)
    foreach ($attribute in $root.Attributes) {
        if ($attribute.NamespaceURI -eq '' -and $attribute.Name -notin @('id', 'width', 'height', 'version')) {
            $symbol.SetAttribute($attribute.Name, $attribute.Value)
        }
    }
    foreach ($child in $root.ChildNodes) {
        if ($child.NodeType -eq [Xml.XmlNodeType]::Element) {
            [void]$symbol.AppendChild($document.ImportNode($child, $true))
        }
    }
    $nodes = @($symbol) + @($symbol.SelectNodes('.//*'))
    $ids = @{}
    foreach ($node in $nodes) {
        if ($node.HasAttribute('id')) {
            $oldId = $node.GetAttribute('id')
            $ids[$oldId] = "blender-$name-$oldId"
            $node.SetAttribute('id', $ids[$oldId])
        }
    }
    foreach ($node in $nodes) {
        if ($node.LocalName -in @('script', 'foreignObject', 'image', 'style')) {
            throw "Unexpected embedded content in $name"
        }
        foreach ($attribute in @($node.Attributes)) {
            if ($attribute.NamespaceURI -notin @('', 'http://www.w3.org/1999/xlink')) {
                [void]$node.Attributes.Remove($attribute)
                continue
            }
            if ($attribute.Name -match '^on') { throw "Unexpected event handler in $name" }
            $value = $attribute.Value
            foreach ($oldId in $ids.Keys) {
                $value = $value.Replace("url(#$oldId)", "url(#$($ids[$oldId]))")
                if ($attribute.LocalName -eq 'href' -and $value -eq "#$oldId") { $value = "#$($ids[$oldId])" }
            }
            if ($attribute.LocalName -eq 'href' -and -not $value.StartsWith('#')) {
                throw "Unexpected external reference in $name"
            }
            if ($attribute.Name -in @('fill', 'stroke') -and $value -in @('#fff', '#ffffff', 'white')) {
                $value = 'currentColor'
            }
            if ($attribute.Name -eq 'style') {
                $value = $value -replace '(?i)(fill|stroke):\s*(#ffffff|#fff|white)(?=;|$)', '$1:currentColor'
            }
            $attribute.Value = $value
        }
    }
    if ($name -eq 'blender') {
        $center = $symbol.SelectSingleNode('.//*[@id="blender-blender-path1"]')
        $outer = $symbol.SelectSingleNode('.//*[@id="blender-blender-path2"]')
        $ring = $center.CloneNode($true)
        $ring.SetAttribute('id', 'blender-blender-eye-ring')
        $ring.SetAttribute('fill', '#fff')
        $ring.SetAttribute('transform', 'translate(250.735 -332.9) scale(1.35) translate(-250.735 332.9)')
        [void]$center.ParentNode.InsertBefore($ring, $center)
        $center.SetAttribute('fill', '#111111')
        $outer.SetAttribute('fill', '#ea7600')
    }
    return ,$symbol
}

$documents = @()
foreach ($file in @('blender_ui_grouped.svg', 'blender_startup_grouped_jacky_v7.svg')) {
    $path = Join-Path $repo "assets/$file"
    $document = Read-Svg $path
    $defs = $document.DocumentElement.SelectSingleNode('*[local-name()="defs"]')
    foreach ($old in @($defs.SelectNodes('*[local-name()="symbol" and starts-with(@id,"blender-")]'))) {
        [void]$defs.RemoveChild($old)
    }
    $names = $document.SelectNodes('//*[local-name()="use"]') | ForEach-Object {
        $reference = $_.GetAttribute('href')
        if ($reference.StartsWith('#blender-')) { $reference.Substring(9) }
    } | Sort-Object -Unique
    foreach ($name in $names) {
        if ($name.StartsWith('ops.')) {
            $symbol = New-GeometrySymbol $document $name
        } else {
            $symbol = New-CatalogSymbol $document $name
        }
        $symbol.SetAttribute('id', "blender-$name")
        $symbol.SetAttribute('preserveAspectRatio', 'xMidYMid meet')
        [void]$defs.AppendChild($symbol)
    }
    $documents += @{ Path = $path; Document = $document; Count = $names.Count }
}

# Write only after every requested icon has downloaded and converted successfully.
foreach ($item in $documents) {
    $settings = [Xml.XmlWriterSettings]::new()
    $settings.Encoding = [Text.UTF8Encoding]::new($false)
    $settings.OmitXmlDeclaration = $true
    $writer = [Xml.XmlWriter]::Create($item.Path, $settings)
    try { $item.Document.Save($writer) } finally { $writer.Dispose() }
    Write-Output "$([IO.Path]::GetFileName($item.Path)): embedded $($item.Count) official icons"
}
