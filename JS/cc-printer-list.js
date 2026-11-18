// WebSocket / license settings for JSPrintManager 9.0.3
// API key comes from JS/cc-license-config.js (gitignored). See cc-license-config.example.js.
JSPM.JSPrintManager.auto_reconnect = true;
JSPM.JSPrintManager.license_url = "https://altec-connect.nl/license/v9/";
JSPM.JSPrintManager.license_authorization_header =
	(window.CC_LICENSE && window.CC_LICENSE.authorizationHeader) || "";
if (!JSPM.JSPrintManager.license_authorization_header) {
	console.warn('Missing JS/cc-license-config.js — copy from cc-license-config.example.js');
}

// First argument `true` = secure WebSocket (wss://localhost:29503).
// If the Client App has SSL disabled, 9.0.3 reports WSStatus.SslModeMismatch immediately.
JSPM.JSPrintManager.start(true, 'localhost', 29503);

JSPM.JSPrintManager.WS.onStatusChanged = function () {
	getPrinterList();
};

// NEW (9.0.3): clearer SSL mismatch reporting — see also cc-js-status.js / testSslModeMismatch()
if (JSPM.JSPrintManager.WS) {
	JSPM.JSPrintManager.WS.onConnectionFailed = function (status, wasConnected) {
		console.warn('JSPM connection failed', status, 'wasConnected=', wasConnected);
		if (status === JSPM.WSStatus.SslModeMismatch) {
			showPrinterInfoResultIfAvailable(
				'SSL mode mismatch (WSStatus.SslModeMismatch).\n' +
				'This page uses wss:// (start(true, ...)).\n' +
				'Enable SSL in the Client App, or call start(false, ...) to match a non-SSL app.'
			);
		}
	};
}

function showPrinterInfoResultIfAvailable(text) {
	if (typeof showPrinterInfoResult === 'function') {
		showPrinterInfoResult(text);
	}
}

function getPrinterList() {
	if (!jspmWSStatus()) {
		return;
	}

	// --- NEW (9.0.3): clientAppVersion ---
	console.log('JSPM clientAppVersion:', JSPM.JSPrintManager.clientAppVersion);
	updateClientAppVersionLabel(JSPM.JSPrintManager.clientAppVersion);

	// --- NEW (9.0.3): startFastLane ---
	// Opens a second websocket so getPrinters / getPrintersInfo are not blocked by print jobs.
	ensureFastLane();

	// Prefer the fast-lane connection for the printer picker list (2nd arg = fast_lane).
	JSPM.JSPrintManager.getPrinters(false, true).then(function (myPrinters) {
		var options = '';
		for (var i = 0; i < myPrinters.length; i++) {
			options += '<option>' + myPrinters[i] + '</option>';
		}
		$('#installedPrinterName').html(options);
		if (typeof populatePrinterInfoSelect === 'function') {
			populatePrinterInfoSelect(myPrinters || []);
		}
	});

	JSPM.JSPrintManager.getUsbDevices().then(function (usbList) {
		var options = '';
		for (var i = 0; i < usbList.length; i++) {
			var label = usbList[i].name || usbList[i].device_path || usbList[i];
			var value = usbList[i].device_path || usbList[i];
			options += '<option value="' + value + '">' + label + '</option>';
		}
		$('#usbDevice').html(options);
	});
}

// --- NEW (9.0.3): startFastLane helper ---
function ensureFastLane() {
	if (JSPM.JSPrintManager.WSFastLane && JSPM.JSPrintManager.WSFastLane.status === JSPM.WSStatus.Open) {
		return;
	}

	// Same host/port/secure mode as the main connection.
	JSPM.JSPrintManager.startFastLane(true, 'localhost', 29503)
		.then(function (status) {
			console.log('FastLane status:', status, '(Open means getPrintersInfo can bypass print-job queue)');
		})
		.catch(function (err) {
			console.warn('startFastLane failed; falling back to main WS for queries.', err);
		});
}

function updateClientAppVersionLabel(version) {
	var el = document.getElementById('clientAppVersion');
	if (!el) {
		return;
	}
	el.textContent = version ? ('Client v' + version) : 'Client v?';
}
