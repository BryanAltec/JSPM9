// Mirror of cc-printer-list.js for JSPM 9 setups that include this file explicitly.
// API key comes from JS/cc-license-config.js (gitignored). See cc-license-config.example.js.
JSPM.JSPrintManager.auto_reconnect = true;
JSPM.JSPrintManager.license_url = "https://altec-connect.nl/license/v9/";
JSPM.JSPrintManager.license_authorization_header =
	(window.CC_LICENSE && window.CC_LICENSE.authorizationHeader) || "";
if (!JSPM.JSPrintManager.license_authorization_header) {
	console.warn('Missing JS/cc-license-config.js — copy from cc-license-config.example.js');
}

// secure=true → wss://
JSPM.JSPrintManager.start(true, 'localhost', 29503);
JSPM.JSPrintManager.WS.onStatusChanged = function () {
	getPrinterList();
};

function getPrinterList() {
	if (jspmWSStatus()) {
		// NEW (9.0.3)
		console.log('JSPM clientAppVersion:', JSPM.JSPrintManager.clientAppVersion);

		// NEW (9.0.3): second connection for read-only queries
		JSPM.JSPrintManager.startFastLane(true, 'localhost', 29503).catch(function (err) {
			console.warn('startFastLane failed', err);
		});

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
};
