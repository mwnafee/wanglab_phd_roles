# TARA Lab TA/RA Dashboard

Static GitHub Pages site with:

- Excel-style semester view
- Sortable student TA/RA ratio view
- Whole-lab TA/RA ratio summary
- Orange excluded cells for Manik's first 4 semester columns and Zabirul's first 7 semester columns
- Student self-entry form validated by nickname + RCS ID
- GitHub Actions workflow that can commit role changes back to `initial-data.json`
- Cloudflare Worker scaffold for authenticated repo writes

## Data

`initial-data.json` is a copied JSON version of the current `PhD_Student_Role.xlsx` table.

If no shared update endpoint is configured, the form falls back to browser-local `localStorage`.

The repo includes `.github/workflows/update-role.yml` for repo-backed updates. To connect the webpage to that workflow, point `window.APP_CONFIG.updateUrl` at a service that dispatches the workflow with `nickname`, `semester`, `role`, and `rcsId`.

The `cloudflare/` folder contains a Worker that can talk to the GitHub App installation and update `initial-data.json` directly. You will need to set these Cloudflare secrets before deploying:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

And if you keep the repo name different, update `GITHUB_REPO` in `cloudflare/wrangler.toml`.

## GitHub Pages

Publish this folder as the repository root, or copy these files into the branch/folder served by Pages:

- `index.html`
- `styles.css`
- `app.js`
- `initial-data.json`
- `PhD_Student_Role.xlsx`
