// Basic mobile detection (user agent + small viewport heuristic)
function ccIsMobile() {
	try {
		const ua = navigator.userAgent || '';
		const byUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
		const bySize = Math.min(window.innerWidth, window.innerHeight) < 768;
		return byUA || bySize;
	} catch {
		return false;
	}
}

// Helpers to show/hide the full-screen overlay from cc-missing.js
function ccShowOverlayFor(status) {
	const api = (typeof globalThis !== 'undefined' && globalThis.CCMissingOverlay) ? globalThis.CCMissingOverlay : null;
	// Do not show overlay on mobile devices
	if (ccIsMobile()) return;
	if (!api?.show) return;
	let title = '';
	let html = '';
	if (status === 'closed') {
		title = 'Altec Cloud Connector is not running';
		html = '<p>Please install or start the Altec Cloud Connector and reload this page.</p>' +
			   '<p><a href="https://www.altec-connect.nl/wp-includes/cloudconnector/V8/cloudconnector8-8.0.0.0-win.exe" target="_blank" rel="noopener noreferrer">Download the Altec CloudConnector</a></p>';
	} else if (status === 'blocked') {
		title = 'Access blocked by Altec Cloud Connector';
		html = '<p>This site is blocked in the Connector settings. Allow this site in the Connector and reload.</p>';
	}
	if (title) api.show({ title, html, dismissible: true });
}

function ccHideOverlay() {
	const api = (typeof globalThis !== 'undefined' && globalThis.CCMissingOverlay) ? globalThis.CCMissingOverlay : null;
	api?.hide?.();
}

function ccGetSocketStatusElement() {
	let el = document.getElementById('socketStatus');
	if (el) return el;

	const toolbarActions = document.querySelector('.toolbar-actions') || document.querySelector('.page-toolbar');
	if (!toolbarActions) return null;

	el = document.createElement('div');
	el.id = 'socketStatus';
	el.className = 'socket-status is-closed';
	el.setAttribute('aria-live', 'polite');
	el.textContent = 'closed';
	toolbarActions.prepend(el);
	return el;
}

function ccNormalizeStatus(status) {
	if (status === 'connected' || status === 'open') return 'connected';
	if (status === 'blocked') return 'blocked';
	if (status === 'connecting' || status === 'waiting') return 'connecting';
	// NEW (9.0.3): SslModeMismatch — wss:// page vs non-SSL client (or reverse)
	if (status === 'sslmismatch' || status === 'ssl_mode_mismatch') return 'sslmismatch';
	return 'closed';
}

function ccStatusLabel(status) {
	switch (ccNormalizeStatus(status)) {
		case 'connected': return 'connected';
		case 'blocked': return 'blocked';
		case 'connecting': return 'connecting';
		case 'sslmismatch': return 'ssl mismatch';
		default: return 'closed';
	}
}

function ccStatusClass(status) {
	switch (ccNormalizeStatus(status)) {
		case 'connected': return 'is-connected';
		case 'blocked': return 'is-blocked';
		case 'connecting': return 'is-connecting';
		case 'sslmismatch': return 'is-blocked';
		default: return 'is-closed';
	}
}

//Check JSPM WebSocket status
function jspmWSStatus() {
	// If JSPM is not available at all, treat as closed
	const hasJspm = !!(globalThis?.JSPM?.JSPrintManager && globalThis?.JSPM?.WSStatus);
	if (!hasJspm) {
		statusUpdate('closed');
		ccShowOverlayFor('closed');
		return false;
	}

	if (JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.Open) {
		let socketStatus = 'connected';
		statusUpdate(socketStatus);
		ccHideOverlay();
		return true;
	}
	else if (JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.Closed) {
		let socketStatus = 'closed';
		statusUpdate(socketStatus);
		ccShowOverlayFor('closed');
		return false;
	}
	else if (JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.Blocked) {
		let socketStatus = 'blocked';
		statusUpdate(socketStatus);
		ccShowOverlayFor('blocked');
		return false;
	}
	// --- NEW (9.0.3): WSStatus.SslModeMismatch ---
	else if (JSPM.WSStatus.SslModeMismatch != null &&
		JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.SslModeMismatch) {
		statusUpdate('sslmismatch');
		ccShowOverlayFor('closed');
		return false;
	}
	else if (JSPM.WSStatus.CertificateError != null &&
		JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.CertificateError) {
		statusUpdate('closed');
		ccShowOverlayFor('closed');
		return false;
	}
	else if (JSPM.WSStatus.ConnectionError != null &&
		JSPM.JSPrintManager.websocket_status == JSPM.WSStatus.ConnectionError) {
		statusUpdate('closed');
		ccShowOverlayFor('closed');
		return false;
	}
};

//Change color and status
function statusUpdate(status) { 
	const normalized = ccNormalizeStatus(status);
	const label = ccStatusLabel(normalized);
	const el = ccGetSocketStatusElement();
	if (el) {
		el.classList.remove('is-connected', 'is-closed', 'is-blocked', 'is-connecting');
		el.classList.add(ccStatusClass(normalized));
		el.textContent = label;
	}
	// Safety: also hide overlay when connected via generic updates
	if (normalized === 'connected') ccHideOverlay();
	if (normalized === 'connected' && typeof globalThis !== 'undefined' && globalThis.jQuery) {
		globalThis.jQuery('#download-button').hide();
	}
};

// Single-run status check to handle cases where the connector isn't started at all
(function ccRunStatusOnce(){
	if (globalThis.__ccStatusInit) return; // prevent duplicates across script loads
	globalThis.__ccStatusInit = true;
	const run = () => { try { jspmWSStatus(); } catch { /* handled inside jspmWSStatus */ } };
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true });
	} else {
		run();
	}
})();