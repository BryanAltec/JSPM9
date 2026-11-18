(function () {
	var btComm = {
		_btComm: null,
		_isConnecting: false,
		_dataReceived: '',
		_dataToSend: '',
		_rawBuffer: '',
		_hexBuffer: '',
		_responseTimeout: null
	};
	var textEncoder = new TextEncoder();
	var textDecoder = new TextDecoder();

	function parseBtData(data) {
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

	function clearBtResponseTimeout() {
		if (btComm._responseTimeout) {
			clearTimeout(btComm._responseTimeout);
			btComm._responseTimeout = null;
		}
	}

	function isBtCommBusy() {
		return btComm._isConnecting || !!btComm._btComm;
	}

	function formatBtError(err) {
		var message = String(err || 'Unknown error');
		if (message.indexOf('10048') !== -1) {
			return message + '\r\nHint: channel/address lijkt al in gebruik. Sluit andere Bluetooth serial apps, wacht 2-3 sec en probeer opnieuw. Controleer ook of het juiste SPP channel is ingesteld (vaak 1).';
		}

		return message;
	}

	function renderBtResponse(message) {
		$('#txtBtDataReceived').val(message);
	}

	function renderBtRaw() {
		var rawElement = $('#txtBtDataRaw');
		if (rawElement.length) {
			rawElement.val(btComm._rawBuffer);
		}
	}

	function renderBtHex() {
		var hexElement = $('#txtBtDataHex');
		if (hexElement.length) {
			hexElement.val(btComm._hexBuffer);
		}
	}

	function finalizeBtResponse() {
		var cleaned = btComm._rawBuffer
			.split('\r\n')
			.map(function (line) { return line.trim(); })
			.filter(function (line) { return line.length > 0; })
			.join('\r\n');

		renderBtResponse(cleaned);
		btComm._responseTimeout = null;
	}

	function resetBtBuffers() {
		btComm._rawBuffer = '';
		btComm._hexBuffer = '';
		btComm._dataReceived = '';
		clearBtResponseTimeout();
		renderBtRaw();
		renderBtHex();
	}

	function attachBtHandlers() {
		btComm._btComm.onDataReceived = function (data) {
			var incoming = parseBtData(data);
			var dataStr = incoming.text;
			var hexLine = bytesToHex(incoming.bytes);
			btComm._rawBuffer += dataStr;
			if (hexLine) {
				btComm._hexBuffer += hexLine + '\r\n';
			}
			renderBtRaw();
			renderBtHex();
			clearBtResponseTimeout();
			btComm._responseTimeout = setTimeout(finalizeBtResponse, 500);
			console.log('BT chunk received:', dataStr);
		};

		btComm._btComm.onError = function (data, isCritical) {
			btComm._isConnecting = false;
			btComm._dataReceived = 'ERROR (' + (isCritical ? 'CRITICAL' : 'non-critical') + '): ' + formatBtError(data) + '\r\n';
			renderBtResponse(btComm._dataReceived);
			console.error('BT error:', data, 'Critical:', isCritical);
		};

		btComm._btComm.onClose = function (data) {
			btComm._isConnecting = false;
			btComm._dataReceived = 'COMM CLOSED\r\n';
			renderBtResponse(btComm._dataReceived);
			renderBtRaw();
			renderBtHex();
			btComm._btComm = null;
			console.log('BT closed:', data);
		};
	}

	function sendBtData() {
		if (!btComm._btComm) {
			renderBtResponse('BT Comm is not created!');
			return;
		}

		btComm._dataToSend = ($('#btCommand').val() || 'CONFIG').trim();
		if (btComm._dataToSend.length === 0) {
			btComm._dataToSend = 'CONFIG';
		}

		if (!/\r?\n$/.test(btComm._dataToSend)) {
			btComm._dataToSend += '\r\n';
		}

		resetBtBuffers();
		btComm._btComm.send(btComm._dataToSend);
		renderBtResponse('Sent: ' + btComm._dataToSend + '\r\nWaiting for response...');
	}

	function openBtComm() {
		var address = ($('#btAddress').val() || '').trim();
		var channel = parseInt($('#btChannel').val(), 10);

		if (!address) {
			renderBtResponse('BT address is required');
			return;
		}

		if (Number.isNaN(channel)) {
			channel = 1;
		}

		if (isBtCommBusy()) {
			renderBtResponse('BT Comm is al open of bezig met verbinden. Sluit eerst de huidige sessie.');
			return;
		}

		btComm._btComm = new JSPM.BTComm(address, channel);
		btComm._isConnecting = true;
		btComm._dataReceived = 'Connecting...\r\n';
		btComm._rawBuffer = '';
		attachBtHandlers();
		renderBtResponse(btComm._dataReceived);
		renderBtRaw();
		renderBtHex();

		btComm._btComm.connect().then(function () {
			btComm._isConnecting = false;
			btComm._dataReceived = 'COMM OPEN!\r\n';
			renderBtResponse(btComm._dataReceived);
		}).catch(function (err) {
			btComm._isConnecting = false;
			btComm._dataReceived = 'CONNECT ERROR: ' + formatBtError(err) + '\r\n';
			renderBtResponse(btComm._dataReceived);
			console.error('BT connect error:', err);
			btComm._btComm = null;
		});
	}

	function closeBtComm() {
		if (!btComm._btComm) {
			renderBtResponse('BT Comm is not open!');
			return;
		}

		btComm._isConnecting = false;
		clearBtResponseTimeout();
		btComm._btComm.close();
	}

	globalThis.btComm = btComm;
	globalThis.sendBtData = sendBtData;
	globalThis.openBtComm = openBtComm;
	globalThis.closeBtComm = closeBtComm;
})();
