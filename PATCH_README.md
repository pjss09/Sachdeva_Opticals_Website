This folder contains patch copies of files changed by the accessibility and UI improvements.

How to apply (manual):
1. Copy the files from this folder into your repository root, replacing the existing files.
   - script.js
   - index.html
   - theme.css
2. Commit and push locally:
   git checkout -b a11y/ci-workflows
   git add -A
   git commit -m "chore(a11y): add accessibility fixes, gallery modal, and CI workflows"
   git push -u origin a11y/ci-workflows

Or review the files here and paste changes into your editor if you prefer a selective apply.

Note: CI workflows and tools (pa11y runner, .github/workflows) are already present in the repo; this patch only contains the frontend files for convenience.