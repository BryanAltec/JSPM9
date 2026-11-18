(function () {
	var ippComm = {
		_dataReceived: '',
		_isSending: false,
		_maxPayloadBytes: 900000
	};
	var textEncoder = new TextEncoder();

	function renderIppResponse(message) {
		$('#txtIppDataReceived').val(message);
	}

	function getIppPrinterUri() {
		return ($('#ippDeviceUri').val() || '').trim();
	}

	function ensureIppReady() {
		if (typeof jspmWSStatus === 'function' && !jspmWSStatus()) {
			return false;
		}

		if (!globalThis.JSPM || !JSPM.JSPrintManager || !JSPM.Ipp) {
			renderIppResponse('ERROR: JSPM IPP API is not available.');
			return false;
		}

		var printerUri = getIppPrinterUri();
		if (!printerUri) {
			renderIppResponse('ERROR: IPP Device URI is required.');
			return false;
		}

		return true;
	}

	function stringifyResult(data) {
		try {
			return JSON.stringify(data, null, 2);
		} catch (err) {
			return String(data);
		}
	}

	function getIppAttributeValues(ippResponse, attrName) {
		if (!ippResponse || !Array.isArray(ippResponse.groups)) {
			return [];
		}

		for (var i = 0; i < ippResponse.groups.length; i++) {
			var group = ippResponse.groups[i];
			if (!group || !Array.isArray(group.attributes)) {
				continue;
			}

			for (var j = 0; j < group.attributes.length; j++) {
				var attribute = group.attributes[j];
				if (attribute && attribute.name === attrName && Array.isArray(attribute.value)) {
					return attribute.value;
				}
			}
		}

		return [];
	}

	function appendIppResponseLine(text) {
		var current = String($('#txtIppDataReceived').val() || '');
		var suffix = current ? '\n\n' : '';
		renderIppResponse(current + suffix + text);
	}

	function buildIppGetJobAttributesMessage(printerUri, jobId) {
		return {
			version: { major: 1, minor: 1 },
			operationId: JSPM.Ipp.GET_JOB_ATTRIBUTES,
			requestId: 2,
			groups: [
				{
					tag: JSPM.Ipp.OPERATION_ATTRIBUTES_TAG,
					attributes: [
						{ tag: JSPM.Ipp.CHARSET, name: 'attributes-charset', value: ['utf-8'] },
						{ tag: JSPM.Ipp.NATURAL_LANG, name: 'attributes-natural-language', value: ['en-us'] },
						{ tag: JSPM.Ipp.URI, name: 'printer-uri', value: [printerUri] },
						{ tag: JSPM.Ipp.INTEGER, name: 'job-id', value: [jobId] },
						{ tag: JSPM.Ipp.KEYWORD, name: 'requested-attributes', value: ['job-id', 'job-state', 'job-state-message', 'job-state-reasons'] }
					]
				}
			]
		};
	}

	function fetchIppJobAttributes(printerUri, jobId) {
		var msg = buildIppGetJobAttributesMessage(printerUri, jobId);
		return JSPM.JSPrintManager.sendIppMessage(printerUri, msg).then(function (jobData) {
			var state = getIppAttributeValues(jobData, 'job-state')[0];
			var stateMsg = getIppAttributeValues(jobData, 'job-state-message')[0] || '';
			var reasons = getIppAttributeValues(jobData, 'job-state-reasons');
			var reasonsText = Array.isArray(reasons) ? reasons.join(', ') : '';

			appendIppResponseLine(
				'[IPP Job Status]\n' +
				'job-id: ' + jobId + '\n' +
				'job-state: ' + (typeof state === 'undefined' ? 'n/a' : state) + '\n' +
				'job-state-message: ' + stateMsg + '\n' +
				'job-state-reasons: ' + reasonsText
			);
		});
	}

	function sendIppMessage(ippMessage, payload) {
		var printerUri = getIppPrinterUri();
		if (ippComm._isSending) {
			renderIppResponse('ERROR: Previous IPP send is still in progress.');
			return Promise.resolve();
		}

		if (payload && payload.length > ippComm._maxPayloadBytes) {
			renderIppResponse(
				'ERROR: Payload too large (' + payload.length + ' bytes). ' +
				'This can drop the JSPM websocket. Try a smaller file or remove template text.'
			);
			return Promise.resolve();
		}

		renderIppResponse('');
		ippComm._isSending = true;

		return JSPM.JSPrintManager.sendIppMessage(printerUri, ippMessage, payload)
			.then(function (data) {
				var responseText = stringifyResult(data);
				ippComm._dataReceived = '[IPP Response]\n' + responseText;
				renderIppResponse(ippComm._dataReceived);

				if (ippMessage.operationId === JSPM.Ipp.PRINT_JOB && data && data._oprationIdOrStatusCode === 0) {
					var jobId = getIppAttributeValues(data, 'job-id')[0];
					if (typeof jobId !== 'undefined') {
						return fetchIppJobAttributes(printerUri, jobId).then(function () {
							return data;
						});
					}
				}

				return data;
			})
			.catch(function (message) {
				ippComm._dataReceived = 'ERROR: ' + message;
				renderIppResponse(ippComm._dataReceived);
			})
			.finally(function () {
				ippComm._isSending = false;
			});
	}

	function buildIppRawPrintMessage(printerUri, jobName) {
		return {
			version: { major: 1, minor: 1 },
			operationId: JSPM.Ipp.PRINT_JOB,
			requestId: 1,
			groups: [
				{
					tag: JSPM.Ipp.OPERATION_ATTRIBUTES_TAG,
					attributes: [
						{ tag: JSPM.Ipp.CHARSET, name: 'attributes-charset', value: ['utf-8'] },
						{ tag: JSPM.Ipp.NATURAL_LANG, name: 'attributes-natural-language', value: ['en-us'] },
						{ tag: JSPM.Ipp.URI, name: 'printer-uri', value: [printerUri] },
						{ tag: JSPM.Ipp.NAME_WITHOUT_LANG, name: 'job-name', value: [jobName] },
						{ tag: JSPM.Ipp.MIME_MEDIA_TYPE, name: 'document-format', value: ['application/octet-stream'] }
					]
				},
				{
					tag: JSPM.Ipp.JOB_ATTRIBUTES_TAG,
					attributes: [
						{ tag: JSPM.Ipp.INTEGER, name: 'copies', value: [1] }
					]
				}
			]
		};
	}

	function sendIppData() {
		if (!ensureIppReady()) {
			return;
		}

		var command = String($('#ippCommand').val() || '');
		if (command.trim().length === 0) {
			command = 'CONFIG';
		}

		if (!/\r?\n$/.test(command)) {
			command += '\r\n';
		}

		var printerUri = getIppPrinterUri();
		var ippMessage = buildIppRawPrintMessage(printerUri, 'RawCommandTest');
		var payload = textEncoder.encode(command);

		sendIppMessage(ippMessage, payload);
	}

	function concatByteArrays() {
		var arrays = Array.prototype.slice.call(arguments);
		var totalLength = arrays.reduce(function (acc, arr) { return acc + arr.length; }, 0);
		var result = new Uint8Array(totalLength);
		var offset = 0;
		for (var i = 0; i < arrays.length; i++) {
			var arr = arrays[i];
			result.set(arr, offset);
			offset += arr.length;
		}
		return result;
	}

	function normalizeTsplMemoryParam(flashParam) {
		var normalized = String(flashParam || '').trim().toUpperCase();
		normalized = normalized.replace(/[:,\s]+$/g, '');
		if (normalized === 'N') {
			return '';
		}
		return normalized;
	}

	function buildTsplDownloadLine(memoryParam, fileName) {
		return memoryParam
			? 'DOWNLOAD ' + memoryParam + ',"' + fileName + '"\n'
			: 'DOWNLOAD "' + fileName + '"\n';
	}

	function buildDownloadWrapper(flashParam, fileName, fileBinary) {
		var memoryParam = normalizeTsplMemoryParam(flashParam);
		var downloadLine = buildTsplDownloadLine(memoryParam, fileName);
		var header = textEncoder.encode('CODEPAGE UTF-8\nCLS\n');
		var downloadCmd = textEncoder.encode(downloadLine);
		var endMarker = textEncoder.encode('\nEOP\n');
		return concatByteArrays(header, downloadCmd, fileBinary, endMarker);
	}

	function sendIppFileWithTemplate() {
		if (!ensureIppReady()) {
			return;
		}

		var fileInput = document.getElementById('ippFile');

		if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
			renderIppResponse('ERROR: No file selected.');
			return;
		}

		var file = fileInput.files[0];
		var reader = new FileReader();

		reader.onload = function () {
			var fileBinary = new Uint8Array(reader.result);
			var flash = ($('#ippFlash').val() || '').trim();
			var fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
			var downloadBytes = buildDownloadWrapper(flash, fileName, fileBinary);
			var template = String($('#ippCommand').val() || '');
			var templateBytes = textEncoder.encode(template);

			var payload = concatByteArrays(downloadBytes, templateBytes);

			var printerUri = getIppPrinterUri();
			var ippMessage = buildIppRawPrintMessage(printerUri, 'ATP_File_Label');

			sendIppMessage(ippMessage, payload);
		};

		reader.onerror = function () {
			renderIppResponse('ERROR: Failed to read file.');
		};

		reader.readAsArrayBuffer(file);
	}

	function sendIppFile() {
		sendIppFileWithTemplate();
	}

	globalThis.ippComm = ippComm;
	globalThis.sendIppData = sendIppData;
	globalThis.sendIppFile = sendIppFile;
	globalThis.sendIppFileWithTemplate = sendIppFileWithTemplate;
})();
