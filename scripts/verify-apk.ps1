param([string]$Apk = "$PSScriptRoot/../release/toeic-visual-vocabulary-Android-debug.apk")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath("$PSScriptRoot/../public")
$manifest = Get-Content -LiteralPath "$root/data/manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$paths = @('data/manifest.json')
foreach ($list in $manifest.lists) {
    $paths += $list.file
    $data = Get-Content -LiteralPath "$root/$($list.file)" -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($word in $data.items) { foreach ($image in $word.images) { $paths += $image.src } }
}
$zip = [IO.Compression.ZipFile]::OpenRead([IO.Path]::GetFullPath($Apk))
$sha = [Security.Cryptography.SHA256]::Create()
try {
    if ($null -eq $zip.GetEntry('assets/public/index.html')) { throw 'APK 缺少前端入口' }
    foreach ($path in ($paths | Sort-Object -Unique)) {
        $entry = $zip.GetEntry("assets/public/$path")
        if ($null -eq $entry) { throw "APK 缺少资源：$path" }
        $packed = $entry.Open()
        try { $packedHash = [BitConverter]::ToString($sha.ComputeHash($packed)) }
        finally { $packed.Dispose() }
        $source = [IO.File]::OpenRead("$root/$path")
        try { $sourceHash = [BitConverter]::ToString($sha.ComputeHash($source)) }
        finally { $source.Dispose() }
        if ($packedHash -ne $sourceHash) { throw "APK 资源与源码不一致：$path" }
    }
    Write-Host "APK 内置资源逐文件 SHA-256 验证通过：$($paths.Count) 个引用（含 manifest/List/图片）"
}
finally { $sha.Dispose(); $zip.Dispose() }
