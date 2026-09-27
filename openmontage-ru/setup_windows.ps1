# Установка монтажного конвейера Reels на Windows с видеокартой NVIDIA.
# Запуск (PowerShell):  powershell -ExecutionPolicy Bypass -File setup_windows.ps1
# Всё ставится в %USERPROFILE%\Reels. Скрипт можно запускать повторно.

$ErrorActionPreference = "Stop"
$Base = Join-Path $env:USERPROFILE "Reels"
$Branch = "claude/openmontage-repo-review-g6rmmd"
$OpenMontageCommit = "08e2151fa02de28a5d6a312b3d575692bf147ad7"   # патч сделан под этот коммит

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function RefreshPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [Environment]::GetEnvironmentVariable("Path", "User")
}

Step "Программы: Git, Python 3.11, Node.js LTS, FFmpeg (сборка с NVENC)"
foreach ($id in "Git.Git", "Python.Python.3.11", "OpenJS.NodeJS.LTS", "Gyan.FFmpeg") {
  winget install -e --id $id --accept-source-agreements --accept-package-agreements --silent
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { Write-Host "  (winget $($id): код $($LASTEXITCODE) — возможно, уже установлено)" }
}
RefreshPath

Step "Папка $Base"
New-Item -ItemType Directory -Force $Base | Out-Null
Set-Location $Base

Step "Репозиторий с конвейером (ветка $Branch)"
if (-not (Test-Path "content_plan_dashboard")) {
  git clone -b $Branch https://github.com/oneblin4ik-hash/content_plan_dashboard.git
} else { git -C content_plan_dashboard pull }
$Kit = Join-Path $Base "content_plan_dashboard\openmontage-ru"

Step "OpenMontage"
if (-not (Test-Path "OpenMontage")) {
  git clone https://github.com/calesthio/OpenMontage.git
  git -C OpenMontage checkout $OpenMontageCommit
}
$Root = Join-Path $Base "OpenMontage"
Set-Location $Root

Step "Python-окружение и библиотеки (Whisper, CUDA-библиотеки для видеокарты)"
if (-not (Test-Path ".venv")) { py -3.11 -m venv .venv }
$Py = Join-Path $Root ".venv\Scripts\python.exe"
& $Py -m pip install -U pip
& $Py -m pip install -r requirements.txt
& $Py -m pip install faster-whisper pillow numpy fonttools brotli nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"

Step "Remotion (рендер субтитров и титра)"
Push-Location remotion-composer
npm install
Pop-Location

Step "Кириллические шрифты и правки OpenMontage"
& $Py (Join-Path $Kit "build_cyrillic_fonts.py") --composer (Join-Path $Root "remotion-composer")
git apply --check (Join-Path $Kit "openmontage-ru-fixes.patch") 2>$null
if ($LASTEXITCODE -eq 0) { git apply (Join-Path $Kit "openmontage-ru-fixes.patch") }
else { Write-Host "  патч уже применён — пропускаю" }

[Environment]::SetEnvironmentVariable("OPENMONTAGE_ROOT", $Root, "User")
$env:OPENMONTAGE_ROOT = $Root

Step "Проверка"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader
$enc = ffmpeg -hide_banner -encoders 2>$null | Select-String "hevc_nvenc"
if ($enc) { Write-Host "  NVENC есть" -ForegroundColor Green } else { Write-Host "  ! ffmpeg без NVENC" -ForegroundColor Yellow }
& $Py -c "import ctranslate2; print('  CUDA-устройств для Whisper:', ctranslate2.get_cuda_device_count())"

Write-Host "`nГотово. Конвейер: $Kit\reels\montage.py" -ForegroundColor Green
Write-Host "Python: $Py"
