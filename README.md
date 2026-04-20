# OvernightYoutubeVidioUploader

Static GitHub Pages app for uploading video files to Google Drive and writing metadata to Google Sheets.

There is no backend server. Both the main page and the admin page run in the browser, obtain a Google OAuth access token, and call Google APIs directly.

## Core docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): full system map, data contracts, runtime flows, and known quirks
- [docs/CHANGELOG.md](docs/CHANGELOG.md): append-only maintenance log for future changes

## Repo map

- `index.html`: main uploader page markup and module entrypoint
- `admin.html`: admin-only page markup and module entrypoint
- `app.js`: shared configuration values consumed by both pages
- `js/pages/`: page-specific browser entrypoints
- `js/shared/`: shared helpers, contracts, and formatting utilities
- `js/services/`: Google Drive and Google Sheets API wrappers
- `style.css`: shared visual system for both pages
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow

## Runtime model

- Hosting: GitHub Pages
- Auth: Google Identity Services OAuth token flow in the browser
- Storage: Google Drive
- Metadata store: Google Sheets
- Persistence in browser: `localStorage`

## Documentation contract

When you change this app:

1. Update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) if behavior, data shape, external dependencies, or operational rules changed.
2. Append a new entry to [docs/CHANGELOG.md](docs/CHANGELOG.md).
3. If auth, deployment, or repo entrypoints changed, update this `README.md` too.

Do not treat the docs as optional. Future AI or human maintainers should be able to understand the current system without reverse-engineering the entire codebase again.

## Where to start

If you are new to the repo, read in this order:

1. `app.js`
2. `docs/ARCHITECTURE.md`
3. `js/pages/index-page.js`
4. `js/pages/admin-page.js`
5. `js/services/`

The architecture doc describes the code as it exists today, including important implementation quirks that are easy to miss from a quick scan.
