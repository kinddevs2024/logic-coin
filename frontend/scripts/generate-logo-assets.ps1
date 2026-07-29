param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$frontendRoot = Split-Path -Parent $PSScriptRoot
$brandRoot = Join-Path $frontendRoot "assets\brand"
$publicRoot = Join-Path $frontendRoot "public"
$sourceFile = [System.IO.Path]::GetFullPath($SourcePath)

if (-not [System.IO.File]::Exists($sourceFile)) {
  throw "Logo source does not exist: $sourceFile"
}

[System.IO.Directory]::CreateDirectory($brandRoot) | Out-Null
[System.IO.Directory]::CreateDirectory($publicRoot) | Out-Null
[System.IO.File]::Copy(
  $sourceFile,
  (Join-Path $brandRoot "logo-source.png"),
  $true
)

function New-Canvas {
  param(
    [int]$Size,
    [System.Drawing.Color]$Background
  )

  $bitmap = New-Object System.Drawing.Bitmap(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CompositingMode =
      [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.Clear($Background)
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function New-Graphics {
  param([System.Drawing.Bitmap]$Bitmap)

  $graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $graphics.CompositingMode =
    [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality =
    [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode =
    [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode =
    [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode =
    [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return $graphics
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if (-not $fullPath.StartsWith($frontendRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside frontend root: $fullPath"
  }

  $stream = [System.IO.File]::Open(
    $fullPath,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $Bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $stream.Dispose()
  }
}

function New-ScaledBitmap {
  param(
    [System.Drawing.Image]$Image,
    [int]$Size,
    [System.Drawing.Color]$Background,
    [int]$Inset = 0
  )

  $bitmap = New-Canvas -Size $Size -Background $Background
  $graphics = New-Graphics -Bitmap $bitmap
  try {
    $target = New-Object System.Drawing.Rectangle(
      $Inset,
      $Inset,
      ($Size - 2 * $Inset),
      ($Size - 2 * $Inset)
    )
    $graphics.DrawImage(
      $Image,
      $target,
      0,
      0,
      $Image.Width,
      $Image.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function New-CircularLogoMark {
  param(
    [System.Drawing.Image]$Image,
    [int]$Size
  )

  # The supplied 1254px artwork contains a 950px coin centered near (626, 609).
  $sourceRect = New-Object System.Drawing.Rectangle(151, 134, 950, 950)
  $bitmap = New-Canvas -Size $Size -Background ([System.Drawing.Color]::Transparent)
  $graphics = New-Graphics -Bitmap $bitmap
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  try {
    $path.AddEllipse(1, 1, ($Size - 2), ($Size - 2))
    $graphics.SetClip($path)
    $graphics.DrawImage(
      $Image,
      (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
      $sourceRect.X,
      $sourceRect.Y,
      $sourceRect.Width,
      $sourceRect.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $path.Dispose()
    $graphics.Dispose()
  }
  return $bitmap
}

$source = [System.Drawing.Image]::FromFile($sourceFile)
try {
  if ($source.Width -ne 1254 -or $source.Height -ne 1254) {
    throw "Expected the supplied 1254x1254 logo, got $($source.Width)x$($source.Height)"
  }

  $mark1024 = New-CircularLogoMark -Image $source -Size 1024
  try {
    Save-Png -Bitmap $mark1024 -Path (Join-Path $brandRoot "logo-mark.png")
    Save-Png -Bitmap $mark1024 -Path (Join-Path $brandRoot "splash.png")

    $favicon = New-ScaledBitmap `
      -Image $mark1024 `
      -Size 256 `
      -Background ([System.Drawing.Color]::Transparent)
    try {
      Save-Png -Bitmap $favicon -Path (Join-Path $brandRoot "favicon.png")
    } finally {
      $favicon.Dispose()
    }

    $adaptive = New-ScaledBitmap `
      -Image $mark1024 `
      -Size 1024 `
      -Background ([System.Drawing.Color]::Transparent) `
      -Inset 187
    try {
      Save-Png -Bitmap $adaptive -Path (Join-Path $brandRoot "adaptive-icon.png")
    } finally {
      $adaptive.Dispose()
    }
  } finally {
    $mark1024.Dispose()
  }

  $icon1024 = New-ScaledBitmap `
    -Image $source `
    -Size 1024 `
    -Background ([System.Drawing.Color]::White)
  try {
    Save-Png -Bitmap $icon1024 -Path (Join-Path $brandRoot "icon.png")
    Save-Png -Bitmap $icon1024 -Path (Join-Path $publicRoot "icon.png")

    foreach ($iconSize in @(192, 512)) {
      $publicIcon = New-ScaledBitmap `
        -Image $icon1024 `
        -Size $iconSize `
        -Background ([System.Drawing.Color]::White)
      try {
        Save-Png `
          -Bitmap $publicIcon `
          -Path (Join-Path $publicRoot "icon-$iconSize.png")
      } finally {
        $publicIcon.Dispose()
      }
    }

    $appleIcon = New-ScaledBitmap `
      -Image $icon1024 `
      -Size 180 `
      -Background ([System.Drawing.Color]::White)
    try {
      Save-Png `
        -Bitmap $appleIcon `
        -Path (Join-Path $publicRoot "apple-touch-icon.png")
    } finally {
      $appleIcon.Dispose()
    }
  } finally {
    $icon1024.Dispose()
  }

  $maskableBackground =
    [System.Drawing.ColorTranslator]::FromHtml("#F7FAFF")
  $markForMaskable = New-CircularLogoMark -Image $source -Size 512
  try {
    $maskableIcon = New-ScaledBitmap `
      -Image $markForMaskable `
      -Size 512 `
      -Background $maskableBackground `
      -Inset 90
    try {
      Save-Png `
        -Bitmap $maskableIcon `
        -Path (Join-Path $publicRoot "maskable-icon-512.png")
    } finally {
      $maskableIcon.Dispose()
    }
  } finally {
    $markForMaskable.Dispose()
  }
} finally {
  $source.Dispose()
}
