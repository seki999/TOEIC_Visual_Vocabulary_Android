param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Run-Step([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe 失败：$LASTEXITCODE" }
}
if (-not $SkipInstall) { Run-Step npm.cmd @('ci') }
Run-Step npm.cmd @('run','validate')
Run-Step npm.cmd @('run','typecheck')
Run-Step npm.cmd @('run','lint')
Run-Step npm.cmd @('test')
Run-Step npm.cmd @('run','build')
Run-Step npx.cmd @('cap','sync','android')
Push-Location android
try { Run-Step .\gradlew.bat @('--no-daemon','testDebugUnitTest','lintDebug','assembleDebug','assembleDebugAndroidTest') }
finally { Pop-Location }
New-Item -ItemType Directory -Force release | Out-Null
Copy-Item -LiteralPath android/app/build/outputs/apk/debug/app-debug.apk -Destination release/toeic-visual-vocabulary-Android-debug.apk -Force
& "$PSScriptRoot/scripts/verify-apk.ps1"
$apkHash = (Get-FileHash -Algorithm SHA256 release/toeic-visual-vocabulary-Android-debug.apk).Hash
"$apkHash  toeic-visual-vocabulary-Android-debug.apk" | Out-File -Encoding utf8 release/SHA256.txt
Write-Host '已生成 Debug APK（调试签名，非正式 Release）：release/toeic-visual-vocabulary-Android-debug.apk'
