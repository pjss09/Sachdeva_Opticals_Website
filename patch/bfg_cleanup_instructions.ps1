# bfg_cleanup_instructions.ps1
# Run these commands step-by-step in PowerShell to clean large files from the repo using BFG.
# Adjust paths as needed. This script uses a mirror clone so your working copy is not overwritten.

# 1) Where to place BFG jar
$BfgJar = 'C:\tools\bfg.jar'
# If you don't have the jar, download from https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
# Example PowerShell download (uncomment to run):
# Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar' -OutFile $BfgJar

# 2) Create a mirror clone
Set-Location D:\
if (Test-Path -Path .\repo.git) { Remove-Item -Recurse -Force .\repo.git }
git clone --mirror https://github.com/pjss09/Sachdeva_Opticals_Website.git repo.git
Set-Location .\repo.git

# 3) Run BFG to remove node_modules and common large binaries
# Remove the node_modules folders from history and any chrome.dll or *.exe that exceed size
java -jar $BfgJar --delete-folders node_modules --delete-files chrome.dll --delete-files '*.exe' .

# 4) Cleanup and GC
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5) Force push cleaned history back to origin
git push --force

# 6) Now update your working copy (recommend re-clone, but you can reset) -- example to reset your working clone:
# In your working clone, run:
# git fetch origin
# git checkout a11y/ci-workflows
# git reset --hard origin/a11y/ci-workflows

Write-Host "BFG cleanup complete. Remember to re-clone or reset your working copy to match cleaned remote." -ForegroundColor Green