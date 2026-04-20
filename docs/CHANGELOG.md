# Changelog

This is the append-only maintenance log for this repository.

Rules:

- Add new entries at the end of this file.
- Do not rewrite older entries unless they are factually wrong.
- Keep `docs/ARCHITECTURE.md` as the current-state document.
- Use this file to record what changed, not to replace architecture docs.

## Entry template

```md
## YYYY-MM-DD JST

### Summary
- Short description of the change

### Affected flows
- Main upload flow / history edit / admin access / admin delete / deployment / etc.

### Data-contract changes
- None

### Files touched
- `path/to/file`

### Verification performed
- Manual review
- Smoke test
```

## 2026-04-21 JST

### Summary
- Added initial repository documentation for AI and human maintainers.
- Documented the current implementation of the uploader page, admin page, shared config, shared styles, and deployment workflow.
- Established a maintenance rule that future changes must update `docs/ARCHITECTURE.md` and append to this changelog.

### Affected flows
- Documentation only

### Data-contract changes
- None

### Files touched
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Read `app.js`
- Read `index.html`
- Read `admin.html`
- Read `.github/workflows/deploy.yml`
- Cross-checked documented sheet columns, Drive metadata keys, localStorage keys, and main/admin runtime flows against source

## 2026-04-21 JST (Maintainability Refactor)

### Summary
- Moved the large inline scripts out of `index.html` and `admin.html` into external page modules.
- Added shared helper modules for auth, formatting, filename handling, storage keys, and data-contract constants.
- Added shared Google Drive and Google Sheets service wrappers so browser UI code no longer embeds every raw API call inline.
- Updated docs to reflect the new module layout and code-navigation paths.

### Affected flows
- Main upload flow
- Main history loading and inline edit flow
- Admin access management
- Admin project management
- Admin recent-file deletion flow
- Documentation and code navigation

### Data-contract changes
- None

### Files touched
- `index.html`
- `admin.html`
- `js/pages/index-page.js`
- `js/pages/admin-page.js`
- `js/shared/constants.js`
- `js/shared/auth.js`
- `js/shared/format.js`
- `js/shared/file-name.js`
- `js/services/drive.js`
- `js/services/sheets.js`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Checked the new HTML entrypoints point to external page modules
- Cross-checked shared constants against the existing `Projects`, `Log`, and localStorage contracts
- Reviewed main/admin page modules against prior runtime behavior and Google API usage
- Confirmed documentation references the new `js/pages`, `js/shared`, and `js/services` layout

## 2026-04-21 JST (History Project Reassignment)

### Summary
- Extended main-page history editing so a file can be reassigned to a different project after upload.
- Added project selection to the inline edit UI.
- When the project changes, the file now moves to the destination project folder, receives a new destination-project sequence, and updates both Drive metadata and the `Log` sheet.

### Affected flows
- Main history inline edit flow
- Drive metadata update flow
- Drive parent-folder move flow
- Log row update flow

### Data-contract changes
- None

### Files touched
- `js/pages/index-page.js`
- `js/services/drive.js`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed the inline edit save flow for project-change and non-project-change paths
- Verified destination project metadata is sourced from the active project list
- Verified Drive update now covers parent-folder moves plus `projectId` / `projectNo` / `seq` appProperties
- Verified `Log` row updates now include project and sequence columns during inline edit

## 2026-04-21 JST (GitHub Actions Node 24 Compatibility)

### Summary
- Updated the GitHub Pages deployment workflow to use Node 24 compatible action versions.
- Replaced the deprecated `actions/checkout@v4` with `actions/checkout@v6`.
- Replaced `actions/upload-pages-artifact@v3` with `actions/upload-pages-artifact@v5` so the nested artifact upload path no longer relies on the deprecated Node 20 runtime.

### Affected flows
- GitHub Pages deployment workflow

### Data-contract changes
- None

### Files touched
- `.github/workflows/deploy.yml`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed the current Pages workflow references against the local workflow file
- Cross-checked official GitHub action release information for Node 24 compatible major versions
