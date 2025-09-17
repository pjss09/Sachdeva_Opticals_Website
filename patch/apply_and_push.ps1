# apply_and_push.ps1
# Usage: Open PowerShell in the repository root (D:\SACHDEVA_OPTICALS_WEBSITE) and run:
#   powershell -ExecutionPolicy Bypass -File .\patch\apply_and_push.ps1

param(
    [string] $BranchName = 'a11y/ci-workflows',
    [string] $RemoteName = 'origin',
    [string] $RemoteUrl = 'https://github.com/pjss09/Sachdeva_Opticals_Website.git',
    [string] $BaseBranch = 'main'
)

function Write-Info { param($m) Write-Host "[info] $m" -ForegroundColor Cyan }
function Write-Err { param($m) Write-Host "[error] $m" -ForegroundColor Red }

# Ensure script runs in repo root
$cwd = Get-Location
Write-Info "Running in $cwd"

# Check for git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err "git is not installed or not on PATH. Install git and try again."
    exit 2
}

# Check for repository (simple check for .git)
if (-not (Test-Path -Path .git)) {
    Write-Err "This directory does not look like a git repository (no .git folder). Please run this in your local repo clone."
    exit 3
}

# ensure fetch
Write-Info "Fetching remotes..."
git fetch --all

# Checkout base branch and update
Write-Info "Checking out base branch '$BaseBranch' and pulling latest..."
try { git checkout $BaseBranch } catch { Write-Err "Could not checkout $BaseBranch"; exit 4 }
git pull $RemoteName $BaseBranch

# Create branch
Write-Info "Creating and checking out branch '$BranchName'"
git checkout -b $BranchName

# Copy patch files into repo root
$patchDir = Join-Path $cwd 'patch'
if (-not (Test-Path $patchDir)) { Write-Err "Patch directory $patchDir not found."; exit 5 }
Write-Info "Copying files from $patchDir into $cwd (overwriting)"
Get-ChildItem -Path $patchDir -File | ForEach-Object {
    $src = $_.FullName
    $dest = Join-Path $cwd $_.Name
    Copy-Item -Path $src -Destination $dest -Force
    Write-Info "Copied $($_.Name)"
}

# Stage and commit
Write-Info "Staging changes..."
git add -A

# If nothing to commit, still try to push branch
$diff = git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($diff)) {
    Write-Info "Committing changes..."
    git commit -m "chore(a11y): accessibility fixes, gallery modal, cart improvements, and CI workflows"
} else {
    Write-Info "No changes to commit. Continuing to push branch if remote action is desired."
}

# Ensure remote exists
$remoteExists = (git remote) -contains $RemoteName
if (-not $remoteExists) {
    Write-Info "Adding remote '$RemoteName' -> $RemoteUrl"
    git remote add $RemoteName $RemoteUrl
}

# Push branch
Write-Info "Pushing branch to $RemoteName/$BranchName..."
try {
    git push -u $RemoteName $BranchName
} catch {
    Write-Err "git push failed. Review errors above.";
    exit 6
}

# Try to open a PR using gh if available
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Info "gh CLI found. Creating pull request..."
    $prTitle = 'chore(a11y): add pa11y multi-page runner, accessibility fixes, and CI workflows'
    $prBody = @"
Summary:
- Adds accessibility and UX improvements (modal focus management, keyboard-accessible gallery thumbnails, cart live announcements, contrast fixes).
- Adds a multi-page pa11y runner and two GitHub Actions workflows to run pa11y and axe-core on PRs.

How to test locally:
- Start server (npm start) and visit http://127.0.0.1:4000
- Run npm run a11y to run local pa11y checks
"@
    gh pr create --title $prTitle --body $prBody --base $BaseBranch --head $BranchName
    if ($LASTEXITCODE -eq 0) { Write-Info "PR created by gh." } else { Write-Err "gh pr create failed." }
} else {
    Write-Info "gh CLI not found. Please open a PR manually at: $RemoteUrl/pull/new/$BranchName"
}

Write-Info "Done. If CI is configured, workflows should start automatically on the PR."