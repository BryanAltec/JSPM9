# JSPM9 — Cloud Connector 9 test page

This repository is a **browser test harness** for **Altec Cloud Connector 9** (JSPrintManager 9).  
Use it to verify client connectivity, licensing, printer discovery, print jobs, and the features added in recent Cloud Connector / JS library updates.

Open `layout.html` via a local web server (for example VS Code/Cursor **Live Server**). Do not rely on `file://` for WebSocket tests.

## Client versions covered

| Client build | Focus |
|---|---|
| **9.0.26.621** | Initial Cloud Connector 9 test page |
| **9.0.26.1005** | License API key / authorization header flow |
| **9.0.26.1025** | Improved printer fetching (`getPrintersInfo`, spooler-only, fast lane, timing) |

The page currently ships **JSPrintManager.js v9.0.3** as `JS/JSPrintManager9.js`.

## What you can test here

- WebSocket status and **client app version** (`JSPM.JSPrintManager.clientAppVersion`)
- **Basic** printer info with **`spooler_only`** (fast spooler-based listing)
- **Basic (full)** vs spooler-only timing
- **Extended** info for one printer or **all printers**, with elapsed time
- **Fast lane** (`startFastLane`) so printer queries are not blocked by print jobs
- **Job tracking** (`onUpdated` / `onFinished` / `onError`, including `outcome`: printed / failed / unconfirmed)
- **SSL mode mismatch** (`WSStatus.SslModeMismatch`) when `wss://` and client SSL settings disagree

This site connects with **`wss://localhost:29503`** (`start(true, 'localhost', 29503)`).

## License / API key setup

The real license key lives in **`JS/cc-license-config.js`**, which is **gitignored** and must not be pushed.

1. Copy the example file:

```bash
cp JS/cc-license-config.example.js JS/cc-license-config.js
```

2. Put your Cloud Connector API key in `JS/cc-license-config.js`:

```js
window.CC_LICENSE = {
  authorizationHeader: "Bearer cc_your_key_here"
};
```

3. Reload `layout.html`.

License endpoint used by the page:

`https://altec-connect.nl/license/v9/`

## Main files

| File | Role |
|---|---|
| `layout.html` | UI / toolbar test buttons |
| `JS/JSPrintManager9.js` | JSPrintManager 9.0.3 library |
| `JS/cc-license-config.js` | Local API key (**not in git**) |
| `JS/cc-printer-list.js` | Start WS, license, fast lane, printer list |
| `JS/cc-printers-info.js` | Printer info / timing / SSL probe |
| `JS/cc-job-tracking.js` | Print job outcome tracking test |

## Requirements

- Cloud Connector / JSPrintManager **Client App** matching the build under test
- A modern browser
- Local HTTPS/WSS-compatible client settings when using `start(true, ...)`
