# How To Run

RiskFlow CRM is a Vite + React app. It runs locally in your browser.

## Requirements

- Node.js 20 or newer (includes npm)

## Option 1: Dev server (recommended)

From the project root:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Then open **http://127.0.0.1:5173** in your browser.

Use the same URL every time. The workspace data is stored in the browser per origin, so opening `localhost` or a different port shows a separate, empty workspace.

## Option 2: Windows launcher script

From the project root, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-riskflow.ps1
```

The script installs dependencies if `node_modules` is missing, starts the dev server on `http://127.0.0.1:5173`, and opens it in Edge or Chrome. Activity is logged to `riskflow-start.log` in the project root.

## Production build (optional)

```bash
npm run build
npm run preview
```

`npm run build` writes the static output to `dist/`. `npm run preview` serves it locally.

## Troubleshooting

- **Port 5173 is busy:** close the old RiskFlow browser window or the process using the port, then start again. Do not switch to another port, or your saved data will not appear.
- **Blank or empty workspace after restart:** make sure you opened `http://127.0.0.1:5173` and not a different address.
