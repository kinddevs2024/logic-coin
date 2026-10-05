$ErrorActionPreference = 'Stop'
$taskRepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$previousOffline = $env:EXPO_OFFLINE
Push-Location (Join-Path $taskRepoRoot 'frontend')
try {
  $env:EXPO_OFFLINE = '1'
  & node ../node_modules/expo/bin/cli install --check
  if ($LASTEXITCODE -ne 0) { throw 'Installed Expo dependency compatibility failed' }
  & npm run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
  & npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Type check failed' }
  & npm test
  if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
  & node --test ../scripts/ota/server.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Signed update tests failed' }
  & node ../node_modules/expo/bin/cli export --platform android --output-dir dist-android-checked --max-workers 2
  if ($LASTEXITCODE -ne 0) { throw 'Android export failed' }
  Write-Output 'All local preview checks passed.'
} finally {
  $env:EXPO_OFFLINE = $previousOffline
  Pop-Location
}
