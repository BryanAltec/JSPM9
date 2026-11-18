let currentJob = null;
let isJspmBusy = false;

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function createPrintJob() {
	currentJob = new JSPM.ClientPrintJob();
	currentJob.clientPrinter = new JSPM.InstalledPrinter($('#installedPrinterName').val());
	return currentJob;
}

async function printLabelTemplate(template, assetFiles = [], flash = '') {
	const commandChunks = [];
	let firmwareFile = null;
	const encoder = new TextEncoder();

	for (const filePath of assetFiles) {
		if (filePath.indexOf('.NEW') === -1) {
			const fileData = await fetchBinaryAsset(filePath);
			if (!fileData) {
				continue;
			}

			const baseName = filePath.replace(/\.[^/.]+$/, '').split('/').pop();
			const extension = filePath.split('/').pop().split('.').pop().toUpperCase();
			const fileName = `${baseName}.${extension}`;
			commandChunks.push(buildDownloadCommands(flash, [fileName, fileData]));
		} else {
			firmwareFile = filePath;
		}
	}

	const binaryCommands = concatByteArrays(...commandChunks);
	const templateData = encoder.encode(template);
	createPrintJob();
	currentJob.binaryPrinterCommands = concatByteArrays(binaryCommands, templateData);
	await currentJob.sendToClient();
	if (firmwareFile) {
		// Allow printer some time to finish processing before sending firmware
		await wait(1500);
		await printRawCommandsFromUrl(firmwareFile, { afterPrevDelay: 300 });
	}
}

async function fetchBinaryAsset(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}
  
		const buffer = await response.arrayBuffer();
		return new Uint8Array(buffer);
	} catch (error) {
		console.error('Error fetching asset:', error);
		return null;
	}
}

async function waitForJspmReady(timeout = 5000) {
	const start = Date.now();
	while (JSPM.JSPrintManager.websocket_status !== JSPM.WSStatus.Open) {
		if (Date.now() - start > timeout) {
			throw new Error('JSPM websocket not open in time');
		}
		await wait(100);
	}
}
  
function buildDownloadCommands(flash, ...images) {
	const encoder = new TextEncoder();
	const chunks = [encoder.encode('CODEPAGE UTF-8\nCLS\n')];
	for (const [id, data] of images) {
		chunks.push(encoder.encode(`DOWNLOAD ${flash}"${id}"\n`));
		chunks.push(data);
		chunks.push(encoder.encode('\nEOP\n'));
	}
	return concatByteArrays(...chunks);
}

function concatByteArrays(...arrays) {
	const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
	const result = new Uint8Array(totalLength);
   
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
   
	return result;
}

async function printRawCommandsFromUrl(url, options = {}) {
	const { waitForOpen = true, afterPrevDelay = 0, waitPreviousJob = true, timeout = 15000 } = options;
	if (waitForOpen) {
		await waitForJspmReady();
	}

	const start = Date.now();
	while (waitPreviousJob && isJspmBusy) {
		if (Date.now() - start > timeout) {
			throw new Error('Timeout waiting for previous print job to finish');
		}
		await wait(100);
	}

	isJspmBusy = true;
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) {
			throw new Error('Failed to fetch file: ' + res.status);
		}
		const bytes = new Uint8Array(await res.arrayBuffer());
		if (afterPrevDelay) {
			await wait(afterPrevDelay);
		}
		createPrintJob();
		currentJob.binaryPrinterCommands = bytes;
		await currentJob.sendToClient();
	} finally {
		isJspmBusy = false;
	}
}