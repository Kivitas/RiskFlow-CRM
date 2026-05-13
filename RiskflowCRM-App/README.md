# RiskFlow CRM

RiskFlow CRM is a local-first business management workspace for CRM, sales, inventory, procurement, accounting, reporting, data import/export, branded documents, and optional AI assistance.

## Run

Double-click `Riskflow.bat`.

## Release Features

- Reports export as PDF, CSV, ODS, and workflow messages for email or WhatsApp.
- Invoices export as branded PDFs with email and WhatsApp follow-up workflows.
- Data Center is the single import/export/analyse hub for contacts, reports, inventory, sales, finance, and external CSV/ODS files.
- AI Assistant supports OpenAI, Gemini, and Anthropic with provider-managed model defaults.
- Inventory supports barcode lookup fields and AR/3D reference metadata.

## Screenshots

The GitHub screenshot pack is in `github/screenshots`.

![Dashboard](github/screenshots/02-dashboard.png)
![Reports](github/screenshots/06-reports.png)
![Inventory](github/screenshots/08-inventory-overview.png)
![Data Center](github/screenshots/17-data-center.png)
![AI Assistant](github/screenshots/20-ai-assistant.png)

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Storage

The app stores workspace data in the browser for the local URL it is opened on. The bundled launcher opens `http://127.0.0.1:5173` so data stays on one browser origin.

## Branding

For the exact production logo, place the final raster logo at `public/riskflow-logo.png`. The app uses that path first and falls back to `public/riskflow-logo.svg` when the PNG is not present.

## License

Copyright (C) 2026 [name]

This project is licensed under the GNU Affero General Public License v3.0 only (AGPLv3). See `LICENSE`.

## GitHub Page Checklist

- Add the exact logo as the repository social preview image.
- Put the best dashboard screenshot at the top of the README.
- Add a short feature list with CRM, inventory, reports, invoices, AI, ODS/CSV import, WhatsApp/email workflows, and local-first storage.
- Add 6-10 screenshots below the feature list; keep the rest in `github/screenshots`.
- Add a clear install/run section: double-click `Riskflow.bat`.
- Add a security note: local browser storage, optional encryption, no cloud sync unless integrations are added.
- Add a roadmap section for real API integrations, hosted deployment, database backend, and payment provider support.
