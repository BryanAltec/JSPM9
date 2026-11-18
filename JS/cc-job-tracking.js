/**
 * --- NEW (9.0.3): accurate job tracking test ---
 *
 * Print jobs are tracked from the moment the spooler creates them.
 * Jobs that leave the queue without being printed are reported through onError.
 * Final status includes an `outcome` field: printed | failed | unconfirmed.
 *
 * How to use:
 * 1) Select a printer in the Label print card (#installedPrinterName).
 * 2) Click "Job track test".
 * 3) Watch the result box + console for onUpdated / onFinished / onError + outcome.
 *
 * To force a non-printed path: cancel the job in the Windows queue, pause the printer,
 * or send to a printer that rejects the job — onError / outcome should reflect that.
 */
function testJobTracking() {
	if (JSPM.JSPrintManager.websocket_status != JSPM.WSStatus.Open) {
		showPrinterInfoResult('WebSocket is niet open.');
		return;
	}

	var printerName = ($('#installedPrinterName').val() || getSelectedPrinterInfoName() || '').trim();
	if (!printerName) {
		showPrinterInfoResult('Selecteer eerst een printer (label card of info dropdown).');
		return;
	}

	var logLines = [];
	function logEvent(kind, data) {
		var line = '[' + new Date().toISOString() + '] ' + kind + ': ' + JSON.stringify(data);
		logLines.push(line);
		console.log(kind, data);
		showPrinterInfoResult(
			'Job tracking test → printer "' + printerName + '"\n' +
			'Watch for outcome: printed | failed | unconfirmed\n\n' +
			logLines.join('\n')
		);
	}

	showPrinterInfoResult('Sending tracked job to "' + printerName + '"...');

	var job = new JSPM.ClientPrintJob();
	job.clientPrinter = new JSPM.InstalledPrinter(printerName);
	job.printerCommandsDocName = 'JSPM9-job-track-test';
	// Tiny raw payload so the spooler creates a real job without needing a template file.
	job.printerCommands = 'CODEPAGE UTF-8\nCLS\nTEXT 10,10,"0",0,1,1,"job-track-test"\nPRINT 1,1\n';

	// Progress while the job is in the spooler / printing.
	job.onUpdated = function (data) {
		logEvent('onUpdated', data);
	};

	// Final status — expect an `outcome` field in 9.0.3+ client builds.
	job.onFinished = function (data) {
		logEvent('onFinished', data);
		if (data && data.outcome) {
			logEvent('outcome', data.outcome);
		} else if (data) {
			logEvent('outcome-missing', 'No outcome field yet — check Client App build matches 9.0.3');
		}
	};

	// Fired when the job leaves the queue without being printed (or other critical errors).
	job.onError = function (data, isCritical) {
		logEvent('onError', { data: data, isCritical: isCritical, outcome: data && data.outcome });
	};

	job.sendToClient()
		.then(function () {
			logEvent('sendToClient', 'accepted by client');
		})
		.catch(function (err) {
			logEvent('sendToClient-failed', err && err.message ? err.message : String(err));
		});
}
