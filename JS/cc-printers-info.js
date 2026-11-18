function getSelectedPrinterInfoName() {
	var select = document.getElementById('printerInfoName');
	return select ? (select.value || '').trim() : '';
}

function showPrinterInfoResult(data) {
	var box = document.getElementById('printerInfoResult');
	if (!box) {
		return;
	}

	if (typeof data === 'string') {
		box.textContent = data;
		return;
	}

	try {
		box.textContent = JSON.stringify(data, null, 2);
	} catch (err) {
		box.textContent = String(data);
	}
}

/**
 * Shared getPrintersInfo wrapper.
 *
 * Signature in 9.0.3:
 * getPrintersInfo(detail_level, printer_name, printer_icon, extended_attributes?, fast_lane?, spooler_only?)
 *
 * - fast_lane: use the second WS from startFastLane() so queries are not blocked by printing
 * - spooler_only: Basic-only; answer from Windows spooler without talking to each driver
 */
function fetchPrinterInfo(infoLevel, options) {
	options = options || {};
	var printerName = options.printerName != null ? options.printerName : getSelectedPrinterInfoName();
	var useFastLane = options.fastLane !== false; // default true
	var spoolerOnly = !!options.spoolerOnly;

	if (!printerName && !options.allowEmptyName) {
		showPrinterInfoResult('Selecteer eerst een printer.');
		return;
	}

	if (JSPM.JSPrintManager.websocket_status != JSPM.WSStatus.Open) {
		showPrinterInfoResult('WebSocket is niet open.');
		return;
	}

	var label = infoLevel === JSPM.PrintersInfoLevel.Extended ? 'Extended' : 'Basic';
	var modeBits = [];
	if (useFastLane) modeBits.push('fast_lane');
	if (spoolerOnly) modeBits.push('spooler_only');
	showPrinterInfoResult('Laden (' + label + (modeBits.length ? ', ' + modeBits.join(', ') : '') + ')...');

	var startedAt = performance.now();

	JSPM.JSPrintManager.getPrintersInfo(
		infoLevel,
		printerName || '',
		JSPM.PrinterIcon.None,
		'',           // extended_attributes (unused for now)
		useFastLane,  // --- NEW (9.0.3): fast_lane ---
		spoolerOnly   // --- NEW (9.0.3): spooler_only (Basic only) ---
	)
		.then(function (printersList) {
			var elapsedMs = Math.round(performance.now() - startedAt);
			console.log(printerName || '(all)', label, elapsedMs + 'ms', printersList);

			var header = label + ' info';
			if (printerName) header += ' for "' + printerName + '"';
			header += ' — ' + elapsedMs + ' ms';
			if (spoolerOnly) header += ' (spooler_only)';
			if (useFastLane) header += ' (fast_lane)';

			showPrinterInfoResult(header + '\n\n' + JSON.stringify(printersList, null, 2));
		})
		.catch(function (err) {
			var elapsedMs = Math.round(performance.now() - startedAt);
			console.error('getPrintersInfo failed for', printerName, err);
			showPrinterInfoResult(
				'FAILED after ' + elapsedMs + ' ms\n' +
				(err && err.message ? err.message : String(err))
			);
		});
}

// Basic for the selected printer — uses spooler_only so offline/asleep drivers cannot stall the call.
// Use this for picker-style / quick info. For deeper driver details, turn spoolerOnly off.
function fetchPrinterInfoBasic() {
	fetchPrinterInfo(JSPM.PrintersInfoLevel.Basic, {
		fastLane: true,
		spoolerOnly: true // --- NEW (9.0.3): spooler_only ---
	});
}

// Full Basic (contacts driver) for the selected printer — compare timing vs spooler_only.
function fetchPrinterInfoBasicFull() {
	fetchPrinterInfo(JSPM.PrintersInfoLevel.Basic, {
		fastLane: true,
		spoolerOnly: false
	});
}

// Extended for the selected printer — no longer uses WMI on Windows in 9.0.3; timing is shown in the result box.
function fetchPrinterInfoExtended() {
	fetchPrinterInfo(JSPM.PrintersInfoLevel.Extended, {
		fastLane: true,
		spoolerOnly: false
	});
}

// Extended for ALL printers (empty printer_name) — timed, so you can compare multi-queue cost vs single printer.
function fetchPrinterInfoExtendedAll() {
	fetchPrinterInfo(JSPM.PrintersInfoLevel.Extended, {
		printerName: '',
		allowEmptyName: true,
		fastLane: true,
		spoolerOnly: false
	});
}

// List all printers via spooler_only (good for populating pickers quickly).
function fetchPrinterInfoSpoolerPicker() {
	fetchPrinterInfo(JSPM.PrintersInfoLevel.Basic, {
		printerName: '',
		allowEmptyName: true,
		fastLane: true,
		spoolerOnly: true // --- NEW (9.0.3): spooler_only ---
	});
}

function populatePrinterInfoSelect(printers) {
	var select = document.getElementById('printerInfoName');
	if (!select) {
		return;
	}

	var previous = select.value;
	var options = '<option value="">Selecteer printer...</option>';

	(printers || []).forEach(function (printerName) {
		var selected = printerName === previous ? ' selected' : '';
		options += '<option value="' + String(printerName).replace(/"/g, '&quot;') + '"' + selected + '>' + printerName + '</option>';
	});

	select.innerHTML = options;
}

function buildPrinterInfoButtons(printers) {
	populatePrinterInfoSelect(printers);
}

function loadPrinterInfoButtons() {
	if (JSPM.JSPrintManager.websocket_status != JSPM.WSStatus.Open) {
		return;
	}

	JSPM.JSPrintManager.getPrinters(false, true).then(function (printers) {
		populatePrinterInfoSelect(printers || []);
	}).catch(function (err) {
		console.error('getPrinters failed:', err);
	});
}

/**
 * --- NEW (9.0.3): SslModeMismatch test ---
 *
 * This site connects with wss:// because start(true, 'localhost', 29503) sets secure=true.
 * If the Client App has SSL disabled (ws:// only), the lib now fails fast with WSStatus.SslModeMismatch
 * instead of hanging ~30s with a vague certificate error.
 *
 * This test briefly attempts the opposite secure mode on a throwaway connection via getClientAppInfo,
 * and/or explains the current mode. We do NOT flip the main start() secure flag (that would break the session).
 */
function testSslModeMismatch() {
	var msg =
		'Current page connection: wss://localhost:29503 (start(true, ...)).\n' +
		'WSStatus.SslModeMismatch = ' + JSPM.WSStatus.SslModeMismatch + '\n\n' +
		'How to reproduce:\n' +
		'1) Disable SSL in the JSPrintManager / Cloud Connector Client App settings.\n' +
		'2) Reload this page while still calling start(true, ...).\n' +
		'3) Status should become SslModeMismatch immediately (no 30s hang).\n\n' +
		'Fix: enable SSL in the Client App, OR call start(false, \'localhost\', 29503) to use ws://.\n\n' +
		'Current websocket_status: ' + JSPM.JSPrintManager.websocket_status + '\n' +
		'clientAppVersion: ' + (JSPM.JSPrintManager.clientAppVersion || '(unknown)');

	console.log(msg);
	showPrinterInfoResult(msg);

	// Probe the opposite mode (ws://) to show what the client reports without tearing down the main WS.
	JSPM.JSPrintManager.getClientAppInfo(false, 'localhost', 29503)
		.then(function (info) {
			showPrinterInfoResult(
				msg +
				'\n\nProbe start(false)/getClientAppInfo succeeded (client accepts non-SSL):\n' +
				JSON.stringify(info, null, 2) +
				'\n\n=> If main start(true) fails with SslModeMismatch, enable SSL in the app or switch the page to start(false).'
			);
		})
		.catch(function (err) {
			showPrinterInfoResult(
				msg +
				'\n\nProbe with secure=false failed:\n' +
				(err && err.message ? err.message : String(err)) +
				'\n(That is expected if the Client App only allows SSL / wss://.)'
			);
		});
}
