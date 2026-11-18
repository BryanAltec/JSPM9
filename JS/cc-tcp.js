(function () {
	var tcpComm = {
		_tcpComm: null,
		_siteKey: '',
		_dataReceived: '',
		_dataToSend: '',
		_rawBuffer: '',
		_hexBuffer: '',
		_responseTimeout: null
	};
	var textEncoder = new TextEncoder();
	var textDecoder = new TextDecoder();

	function parseTcpData(data) {
		if (data instanceof Uint8Array) {
			return { text: textDecoder.decode(data), bytes: data };
		}

		if (data instanceof ArrayBuffer) {
			var arrayBufferBytes = new Uint8Array(data);
			return { text: textDecoder.decode(arrayBufferBytes), bytes: arrayBufferBytes };
		}

		var textValue = '';
		if (data && typeof data === 'object') {
			textValue = data.data || data.result || data.message || JSON.stringify(data);
		} else {
			textValue = String(data || '');
		}

		return { text: textValue, bytes: textEncoder.encode(textValue) };
	}

	function bytesToHex(bytes) {
		if (!bytes || bytes.length === 0) {
			return '';
		}

		var parts = [];
		for (var i = 0; i < bytes.length; i++) {
			parts.push(bytes[i].toString(16).toUpperCase().padStart(2, '0'));
		}
		return parts.join(' ');
	}

	function clearTcpResponseTimeout() {
		if (tcpComm._responseTimeout) {
			clearTimeout(tcpComm._responseTimeout);
			tcpComm._responseTimeout = null;
		}
	}

	function renderTcpResponse(message) {
		$('#txtTcpDataReceived').val(message);
	}

	function renderTcpRaw() {
		var rawElement = $('#txtTcpDataRaw');
		if (rawElement.length) {
			rawElement.val(tcpComm._rawBuffer);
		}
	}

	function renderTcpHex() {
		var hexElement = $('#txtTcpDataHex');
		if (hexElement.length) {
			hexElement.val(tcpComm._hexBuffer);
		}
	}

	function finalizeTcpResponse() {
		var cleaned = tcpComm._rawBuffer
			.split('\r\n')
			.map(function (line) { return line.trim(); })
			.filter(function (line) { return line.length > 0; })
			.join('\r\n');

		renderTcpResponse(cleaned);
		tcpComm._responseTimeout = null;
	}

	function resetTcpBuffers() {
		tcpComm._rawBuffer = '';
		tcpComm._hexBuffer = '';
		tcpComm._dataReceived = '';
		clearTcpResponseTimeout();
		renderTcpRaw();
		renderTcpHex();
	}

	function updateTcpSiteManager(action) {
		if (!tcpComm._siteKey) {
			return Promise.resolve();
		}

		return JSPM.JSPrintManager.sitesManager(tcpComm._siteKey, action).catch(function (err) {
			console.error('TCP site manager update failed:', err);
			throw err;
		});
	}

	function attachTcpHandlers() {
		tcpComm._tcpComm.onDataReceived = function (data) {
			var incoming = parseTcpData(data);
			var dataStr = incoming.text;
			var hexLine = bytesToHex(incoming.bytes);
			tcpComm._rawBuffer += dataStr;
			if (hexLine) {
				tcpComm._hexBuffer += hexLine + '\r\n';
			}
			renderTcpRaw();
			renderTcpHex();
			clearTcpResponseTimeout();
			tcpComm._responseTimeout = setTimeout(finalizeTcpResponse, 500);
			console.log('TCP chunk received:', dataStr);
		};

		tcpComm._tcpComm.onError = function (data, isCritical) {
			tcpComm._dataReceived = 'ERROR (' + (isCritical ? 'CRITICAL' : 'non-critical') + '): ' + data + '\r\n';
			renderTcpResponse(tcpComm._dataReceived);
			console.error('TCP error:', data, 'Critical:', isCritical);
		};

		tcpComm._tcpComm.onClose = function (data) {
			updateTcpSiteManager(1).finally(function () {
				tcpComm._dataReceived = 'COMM CLOSED\r\n';
				renderTcpResponse(tcpComm._dataReceived);
				renderTcpRaw();
				renderTcpHex();
				tcpComm._tcpComm = null;
			});
			console.log('TCP closed:', data);
		};
	}

	function sendTcpData() {
		if (!tcpComm._tcpComm) {
			renderTcpResponse('TCP Comm is not created!');
			return;
		}

		tcpComm._dataToSend = ($('#tcpCommand').val() || 'CONFIG').trim();
		if (tcpComm._dataToSend.length === 0) {
			tcpComm._dataToSend = 'CONFIG';
		}

		if (!/\r?\n$/.test(tcpComm._dataToSend)) {
			tcpComm._dataToSend += '\r\n';
		}

		resetTcpBuffers();
		tcpComm._tcpComm.send(tcpComm._dataToSend);
		renderTcpResponse('Sent: ' + tcpComm._dataToSend + '\r\nWaiting for response...');
	}

	function openTcpComm() {
		var address = ($('#tcpAddress').val() || '').trim();
		var port = parseInt($('#tcpPort').val(), 10);

		if (!address || Number.isNaN(port)) {
			renderTcpResponse('TCP address and port are required');
			return;
		}

		tcpComm._siteKey = address + ':' + port;
		tcpComm._tcpComm = new JSPM.TcpComm(address, port);
		tcpComm._dataReceived = 'Connecting...\r\n';
		tcpComm._rawBuffer = '';
		attachTcpHandlers();
		renderTcpResponse(tcpComm._dataReceived);
		renderTcpRaw();
		renderTcpHex();

		updateTcpSiteManager(0).then(function () {
			return tcpComm._tcpComm.connect();
		}).then(function () {
			tcpComm._dataReceived = 'COMM OPEN!\r\n';
			renderTcpResponse(tcpComm._dataReceived);
		}).catch(function (err) {
			tcpComm._dataReceived = 'CONNECT ERROR: ' + err + '\r\n';
			renderTcpResponse(tcpComm._dataReceived);
			console.error('TCP connect error:', err);
		});
	}

	function closeTcpComm() {
		if (!tcpComm._tcpComm) {
			renderTcpResponse('TCP Comm is not open!');
			return;
		}

		clearTcpResponseTimeout();
		tcpComm._tcpComm.close();
	}

	globalThis.tcpComm = tcpComm;
	globalThis.sendTcpData = sendTcpData;
	globalThis.openTcpComm = openTcpComm;
	globalThis.closeTcpComm = closeTcpComm;
})();