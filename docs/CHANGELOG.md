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

## 2026-04-21 JST (Responsive History-First Layout)

### Summary
- Reworked the shared shell and grid CSS to be more fluid on larger screens.
- Made the main page desktop layout history-first so `My upload history` gets more width than `Upload`.
- Added reusable layout utility classes so future pages can opt into wide single-column or responsive two-column behavior without inline grid overrides.

### Affected flows
- Main page desktop layout
- Main page history table usability
- Shared page shell/layout behavior
- Admin page width behavior

### Data-contract changes
- None

### Files touched
- `style.css`
- `index.html`
- `admin.html`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed the main page and admin page HTML class wiring for the new layout utilities
- Checked desktop and mobile breakpoints in shared CSS for stacked and two-column behavior
- Verified the history table keeps horizontal scrolling as fallback while gaining more desktop width

## 2026-04-21 JST (Wider History Desktop Tuning)

### Summary
- Increased the responsive shell width again for larger displays.
- Rebalanced the desktop history-first grid so `My upload history` takes substantially more space on wide and extra-wide screens.
- Expanded the effective description column capacity so the wider history area translates into better readability instead of unused margin.

### Affected flows
- Main page desktop layout
- Main page history table readability
- Shared wide-screen shell behavior

### Data-contract changes
- None

### Files touched
- `style.css`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed updated wide-screen breakpoints and grid ratios
- Checked history table minimum-width and description-column sizing after the wider shell change

## 2026-04-21 JST (Auto Upload On File Selection)

### Summary
- Added a pending auto-upload flow on the main page so selecting video files starts upload immediately when the required fields are already valid.
- Centralized upload validation into `buildUploadDraft()` so manual upload and auto upload follow the same rules.
- Added duplicate-submission protection with `uploadInProgress` and surfaced auto-upload waiting status in the UI.
- Tightened recording-date validation so a non-empty invalid date no longer silently falls back to Tokyo "today".

### Affected flows
- Main upload flow
- File selection and drag/drop behavior
- Upload validation and duplicate-submission handling

### Data-contract changes
- None

### Files touched
- `index.html`
- `js/pages/index-page.js`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed the shared validation path used by both auto and manual upload triggers
- Checked that file-picker and drag/drop selection now feed the same auto-upload path
- Verified that pending auto-upload waits for missing fields instead of triggering validation alerts immediately

## 2026-04-21 JST (In-Memory Upload Queue)

### Summary
- Replaced the direct main-page upload trigger with an in-memory upload queue that snapshots the current form into queue jobs.
- Kept the auto-start behavior conceptually, but it now auto-queues once required fields are valid instead of directly sending the current form state.
- Allowed the upload form to remain usable while another queue item is uploading, so additional videos can be prepared and queued in parallel.
- Added queue UI for `queued`, `uploading`, `completed`, and `failed` states, plus removal and finished-item cleanup actions.

### Affected flows
- Main upload flow
- File selection and drag/drop behavior
- Upload progress and status display
- Sign-out behavior during active uploads

### Data-contract changes
- None

### Files touched
- `index.html`
- `style.css`
- `js/pages/index-page.js`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`

### Verification performed
- Reviewed queue state transitions for queued, uploading, completed, and failed jobs
- Checked that file selection now snapshots into queue jobs instead of blocking the form until completion
- Verified that upload progress UI remains tied to the currently active queue item while the queue list shows pending and finished work
