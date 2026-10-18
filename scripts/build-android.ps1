param(
  [switch]$DebugBuild,
  [string]$Keystore = $env:ANIPIC_KEYSTORE,
  [string]$Alias = 'anipic',
  [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
if (!$env:JAVA_HOME -or !$env:ANDROID_HOME) { throw 'Configurer JAVA_HOME (JDK 17) et ANDROID_HOME (SDK Android, API 36 / build-tools 35.0.0).' }
if (!$OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'release-artifacts' }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
if ($Keystore) { $Keystore = (Resolve-Path -LiteralPath $Keystore).Path }
$nativeVersion = (Get-Content -LiteralPath (Join-Path $androidRoot 'twa-manifest.json') -Raw | ConvertFrom-Json).appVersion
if ($nativeVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Version Android invalide.' }
Push-Location $androidRoot
try {
  if ($DebugBuild) {
    & ./gradlew.bat --no-daemon assembleDebug lintDebug
    if ($LASTEXITCODE -ne 0) { throw 'Compilation Android debug échouée.' }
    Copy-Item -LiteralPath 'app/build/outputs/apk/debug/app-debug.apk' -Destination (Join-Path $OutputDirectory 'AniPic-debug.apk')
  } else {
    if (!$Keystore -or !$env:ANIPIC_KEYSTORE_PASSWORD) { throw 'Indiquer ANIPIC_KEYSTORE et ANIPIC_KEYSTORE_PASSWORD. Ne jamais ajouter la clé privée au dépôt.' }
    & ./gradlew.bat --no-daemon assembleRelease lintRelease
    if ($LASTEXITCODE -ne 0) { throw 'Compilation Android release échouée.' }
    $buildTools = Join-Path $env:ANDROID_HOME 'build-tools/35.0.0'
    $apk = Join-Path $OutputDirectory "AniPic-$nativeVersion.apk"
    & "$buildTools/zipalign.exe" -f -p 4 'app/build/outputs/apk/release/app-release-unsigned.apk' (Join-Path $OutputDirectory 'AniPic-aligned.apk')
    if ($LASTEXITCODE -ne 0) { throw 'Alignement APK échoué.' }
    & "$buildTools/apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias --ks-pass env:ANIPIC_KEYSTORE_PASSWORD --key-pass env:ANIPIC_KEYSTORE_PASSWORD --out $apk (Join-Path $OutputDirectory 'AniPic-aligned.apk')
    if ($LASTEXITCODE -ne 0) { throw 'Signature APK échouée.' }
    & "$buildTools/apksigner.bat" verify --verbose --print-certs $apk
    if ($LASTEXITCODE -ne 0) { throw 'Vérification signature APK échouée.' }
    Remove-Item -LiteralPath (Join-Path $OutputDirectory 'AniPic-aligned.apk')
    Get-FileHash -LiteralPath $apk -Algorithm SHA256
  }
} finally { Pop-Location }
