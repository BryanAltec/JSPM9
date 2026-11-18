(function () {
	var usbComm = {
		_usbComm: null,
		_dataReceived: '',
		_dataToSend: '',
		_rawBuffer: '',
		_hexBuffer: '',
		_responseTimeout: null
	};
	var textEncoder = new TextEncoder();
	var textDecoder = new TextDecoder();

	function parseUsbData(data) {
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

	function clearUsbResponseTimeout() {
		if (usbComm._responseTimeout) {
			clearTimeout(usbComm._responseTimeout);
			usbComm._responseTimeout = null;
		}
	}

	function renderUsbResponse(message) {
		$('#txtDataReceived').val(message);
	}

	function renderUsbRaw() {
		$('#txtDataRaw').val(usbComm._rawBuffer);
	}

	function renderUsbHex() {
		var hexElement = $('#txtDataHex');
		if (hexElement.length) {
			hexElement.val(usbComm._hexBuffer);
		}
	}

	function finalizeUsbResponse() {
		var cleaned = usbComm._rawBuffer
			.split('\r\n')
			.map(function (line) { return line.trim(); })
			.filter(function (line) { return line.length > 0; })
			.join('\r\n');

		renderUsbResponse(cleaned);
		usbComm._responseTimeout = null;
	}

	function resetUsbBuffers() {
		usbComm._rawBuffer = '';
		usbComm._hexBuffer = '';
		usbComm._dataReceived = '';
		clearUsbResponseTimeout();
		renderUsbRaw();
		renderUsbHex();
	}

	function attachUsbHandlers() {
		usbComm._usbComm.onDataReceived = function (data) {
			var incoming = parseUsbData(data);
			var dataStr = incoming.text;
			var hexLine = bytesToHex(incoming.bytes);
			usbComm._rawBuffer += dataStr;
			if (hexLine) {
				usbComm._hexBuffer += hexLine + '\r\n';
			}
			renderUsbRaw();
			renderUsbHex();
			clearUsbResponseTimeout();
			usbComm._responseTimeout = setTimeout(finalizeUsbResponse, 500);
			console.log('Data chunk received:', dataStr);
		};

		usbComm._usbComm.onError = function (data, isCritical) {
			usbComm._dataReceived = 'ERROR (' + (isCritical ? 'CRITICAL' : 'non-critical') + '): ' + data + '\r\n';
			renderUsbResponse(usbComm._dataReceived);
			console.error('Error:', data, 'Critical:', isCritical);
		};

		usbComm._usbComm.onClose = function (data) {
			usbComm._dataReceived = 'COMM CLOSED\r\n';
			renderUsbResponse(usbComm._dataReceived);
			renderUsbRaw();
			renderUsbHex();
			usbComm._usbComm = null;
			console.log('Closed:', data);
		};
	}

	function sendUsbData() {
		if (!usbComm._usbComm) {
			renderUsbResponse('USB Comm is not created!');
			return;
		}

		usbComm._dataToSend = ($('#usbCommand').val() || 'CONFIG').trim();
		if (usbComm._dataToSend.length === 0) {
			usbComm._dataToSend = 'CONFIG';
		}

		if (!/\r?\n$/.test(usbComm._dataToSend)) {
			usbComm._dataToSend += '\r\n';
		}

		resetUsbBuffers();
		usbComm._usbComm.send(usbComm._dataToSend);
		renderUsbResponse('Sent: ' + usbComm._dataToSend + '\r\nWaiting for response...');
	}

	function openUsbComm() {
		usbComm._usbComm = new JSPM.USBComm($('#usbDevice').val());
		usbComm._dataReceived = 'Connecting...\r\n';
		usbComm._rawBuffer = '';
		attachUsbHandlers();
		renderUsbResponse(usbComm._dataReceived);
		renderUsbRaw();
		renderUsbHex();

		usbComm._usbComm.connect().then(function () {
			usbComm._dataReceived = 'COMM OPEN!\r\n';
			renderUsbResponse(usbComm._dataReceived);
		}).catch(function (err) {
			usbComm._dataReceived = 'CONNECT ERROR: ' + err + '\r\n';
			renderUsbResponse(usbComm._dataReceived);
			console.error('Connect error:', err);
		});
	}

	function closeUsbComm() {
		if (!usbComm._usbComm) {
			renderUsbResponse('USB Comm is not open!');
			return;
		}

		clearUsbResponseTimeout();
		renderUsbResponse('USB comm detached\r\n');
		renderUsbRaw();
		renderUsbHex();
		usbComm._usbComm = null;
	}

	globalThis.usbComm = usbComm;
	globalThis.sendUsbData = sendUsbData;
	globalThis.openUsbComm = openUsbComm;
	globalThis.closeUsbComm = closeUsbComm;
})();