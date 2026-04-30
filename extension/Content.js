(() => {
	"use strict";

	const BUTTON_ID = "bbmp-miniplayer-button";
	const OLD_BUTTON_ID = "myext-miniplayer-btn";
	const STYLE_ID = "bbmp-miniplayer-style";
	const STATE_KEY = "__bbmpMiniplayerRestorer";
	const PLAYER_SELECTOR =
		"#movie_player.html5-video-player, #movie_player, .html5-video-player";
	const RIGHT_CONTROLS_SELECTOR = ".ytp-right-controls";
	const NATIVE_MINIPLAYER_SELECTOR =
		".ytp-miniplayer-button, button[title='Miniplayer'], button[aria-label='Miniplayer'], button[title='Miniplayer (i)'], button[aria-label='Miniplayer (i)']";
	const NAVIGATION_EVENTS = [
		"yt-navigate-finish",
		"yt-page-data-updated",
		"yt-player-updated",
		"yt-player-released",
		"fullscreenchange",
	];

	window[STATE_KEY]?.disconnect?.();

	const state = {
		observer: null,
		intervalId: 0,
		ensureQueued: false,
	};

	window[STATE_KEY] = state;

	function isEligiblePage() {
		return (
			location.pathname === "/watch" || location.pathname.startsWith("/live/")
		);
	}

	function getPlayerRoot() {
		return document.querySelector(PLAYER_SELECTOR);
	}

	function getRightControls(playerRoot = getPlayerRoot()) {
		return (
			playerRoot?.querySelector(RIGHT_CONTROLS_SELECTOR) ||
			document.querySelector(`ytd-player ${RIGHT_CONTROLS_SELECTOR}`) ||
			document.querySelector(RIGHT_CONTROLS_SELECTOR)
		);
	}

	function isVisible(element) {
		if (!element || element.hidden) return false;

		const style = window.getComputedStyle(element);
		return (
			style.display !== "none" &&
			style.visibility !== "hidden" &&
			(element.offsetWidth > 0 ||
				element.offsetHeight > 0 ||
				element.getClientRects().length > 0)
		);
	}

	function nativeButtonVisibleIn(controls) {
		return [...controls.querySelectorAll(".ytp-miniplayer-button")].some(
			(button) =>
				button.id !== BUTTON_ID &&
				button.id !== OLD_BUTTON_ID &&
				isVisible(button)
		);
	}

	function ensureStyle() {
		let style = document.getElementById(STYLE_ID);
		if (!style) {
			style = document.createElement("style");
			style.id = STYLE_ID;
			document.documentElement.appendChild(style);
		}

		style.textContent = `
			#${BUTTON_ID} {
				align-items: center !important;
				background: transparent !important;
				border: 0 !important;
				border-radius: 14px !important;
				box-sizing: border-box !important;
				color: #fff !important;
				cursor: pointer !important;
				display: inline-flex !important;
				flex: 0 0 auto !important;
				height: 48px !important;
				justify-content: center !important;
				line-height: normal !important;
				margin: 0 !important;
				opacity: 1 !important;
				padding: 0 !important;
				pointer-events: auto !important;
				position: relative !important;
				vertical-align: top !important;
				width: 48px !important;
			}

			#${BUTTON_ID}:hover,
			#${BUTTON_ID}:focus-visible {
				background: rgba(255, 255, 255, 0.16) !important;
			}

			#${BUTTON_ID} > svg {
				display: block !important;
				height: 24px !important;
				pointer-events: none !important;
				width: 24px !important;
			}
		`;

	}

	function getButtonHost(controls) {
		const fullscreenButton = controls.querySelector(".ytp-fullscreen-button");
		if (fullscreenButton?.parentElement) return fullscreenButton.parentElement;

		const sizeButton = controls.querySelector(".ytp-size-button");
		if (sizeButton?.parentElement) return sizeButton.parentElement;

		return controls.querySelector(".ytp-right-controls-right") || controls;
	}

	function setAttributes(element, attributes) {
		for (const [name, value] of Object.entries(attributes)) {
			element.setAttribute(name, value);
		}
	}

	function buildIcon() {
		const svgNamespace = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(svgNamespace, "svg");
		const path = document.createElementNS(svgNamespace, "path");

		setAttributes(svg, {
			height: "24",
			viewBox: "0 0 24 24",
			width: "24",
			focusable: "false",
			"aria-hidden": "true",
		});

		setAttributes(path, {
			d: "M21.20 3.01C21.66 3.05 22.08 3.26 22.41 3.58C22.73 3.91 22.94 4.33 22.98 4.79L23 5V19C23.00 19.49 22.81 19.97 22.48 20.34C22.15 20.70 21.69 20.93 21.20 20.99L21 21H3L2.79 20.99C2.30 20.93 1.84 20.70 1.51 20.34C1.18 19.97 .99 19.49 1 19V13H3V19H21V5H11V3H21L21.20 3.01ZM1.29 3.29C1.10 3.48 1.00 3.73 1.00 4C1.00 4.26 1.10 4.51 1.29 4.70L5.58 9H3C2.73 9 2.48 9.10 2.29 9.29C2.10 9.48 2 9.73 2 10C2 10.26 2.10 10.51 2.29 10.70C2.48 10.89 2.73 11 3 11H9V5C9 4.73 8.89 4.48 8.70 4.29C8.51 4.10 8.26 4 8 4C7.73 4 7.48 4.10 7.29 4.29C7.10 4.48 7 4.73 7 5V7.58L2.70 3.29C2.51 3.10 2.26 3.00 2 3.00C1.73 3.00 1.48 3.10 1.29 3.29ZM19.10 11.00L19 11H12L11.89 11.00C11.66 11.02 11.45 11.13 11.29 11.29C11.13 11.45 11.02 11.66 11.00 11.89L11 12V17C10.99 17.24 11.09 17.48 11.25 17.67C11.42 17.85 11.65 17.96 11.89 17.99L12 18H19L19.10 17.99C19.34 17.96 19.57 17.85 19.74 17.67C19.90 17.48 20.00 17.24 20 17V12L19.99 11.89C19.97 11.66 19.87 11.45 19.70 11.29C19.54 11.13 19.33 11.02 19.10 11.00ZM13 16V13H18V16H13Z",
			fill: "currentColor",
		});

		svg.appendChild(path);
		return svg;
	}

	function buildButton() {
		const button = document.createElement("button");
		button.id = BUTTON_ID;
		button.className = "ytp-button";
		button.type = "button";
		button.title = "";
		button.setAttribute("aria-keyshortcuts", "i");
		button.setAttribute("aria-label", "Miniplayer keyboard shortcut i");
		button.setAttribute("data-title-no-tooltip", "Miniplayer");
		button.setAttribute("data-tooltip-title", "Miniplayer (i)");
		button.setAttribute("data-tooltip-target-id", "ytp-miniplayer-button");
		button.setAttribute("data-priority", "11");

		button.appendChild(buildIcon());

		let lastActivation = 0;
		const activate = (event) => {
			event.preventDefault();
			event.stopPropagation();

			const now = Date.now();
			if (now - lastActivation < 500) return;

			lastActivation = now;
			triggerMiniplayer();
		};

		button.addEventListener("pointerup", (event) => {
			if (event.button === 0) activate(event);
		}, true);
		button.addEventListener("click", activate, true);

		return button;
	}

	function removeOrphanedButtons(controls) {
		for (const button of document.querySelectorAll(`#${OLD_BUTTON_ID}`)) {
			button.remove();
		}

		for (const button of document.querySelectorAll(`#${BUTTON_ID}`)) {
			if (!controls.contains(button)) button.remove();
		}
	}

	function insertButton(controls) {
		const host = getButtonHost(controls);
		let button =
			host.querySelector(`#${BUTTON_ID}`) ||
			controls.querySelector(`#${BUTTON_ID}`);
		if (!button) button = document.getElementById(BUTTON_ID) || buildButton();

		const fullscreenButton = host.querySelector(".ytp-fullscreen-button");
		const sizeButton = host.querySelector(".ytp-size-button");
		const referenceButton = fullscreenButton || sizeButton?.nextElementSibling;

		if (referenceButton && referenceButton !== button) {
			host.insertBefore(button, referenceButton);
		} else if (button.parentElement !== host) {
			host.appendChild(button);
		}
	}

	function ensureButton() {
		if (!isEligiblePage()) {
			document.getElementById(BUTTON_ID)?.remove();
			document.getElementById(OLD_BUTTON_ID)?.remove();
			return;
		}

		const controls = getRightControls();
		if (!controls) return;

		ensureStyle();
		removeOrphanedButtons(controls);

		if (nativeButtonVisibleIn(controls)) {
			document.getElementById(BUTTON_ID)?.remove();
			document.getElementById(OLD_BUTTON_ID)?.remove();
			return;
		}

		insertButton(controls);
	}

	function scheduleEnsure() {
		if (state.ensureQueued) return;

		state.ensureQueued = true;
		window.requestAnimationFrame(() => {
			state.ensureQueued = false;
			ensureButton();
		});
	}

	function clickNativeMiniplayerButton() {
		for (const button of document.querySelectorAll(NATIVE_MINIPLAYER_SELECTOR)) {
			if (button.id === BUTTON_ID || button.id === OLD_BUTTON_ID) continue;
			if (!isVisible(button)) continue;

			button.click();
			return true;
		}

		return false;
	}

	function callPlayerMiniplayerMethod() {
		const playerRoot = getPlayerRoot();
		const candidates = [playerRoot, playerRoot?.getPlayer?.()].filter(Boolean);
		const methodNames = [
			"toggleMiniplayer",
			"toggleMiniPlayer",
			"showMiniplayer",
			"enterMiniplayer",
			"enterMiniplayerMode",
		];

		for (const candidate of candidates) {
			for (const methodName of methodNames) {
				if (typeof candidate[methodName] !== "function") continue;

				try {
					candidate[methodName]();
					return true;
				} catch {
					// YouTube changes these private methods often; keep falling back.
				}
			}
		}

		return false;
	}

	function dispatchMiniplayerShortcut() {
		const eventInit = {
			bubbles: true,
			cancelable: true,
			code: "KeyI",
			composed: true,
			key: "i",
			keyCode: 73,
			view: window,
			which: 73,
		};

		document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
		document.dispatchEvent(new KeyboardEvent("keyup", eventInit));
	}

	function isMiniplayerActive() {
		const app = document.querySelector("ytd-app");
		if (
			app?.hasAttribute("miniplayer-active") ||
			app?.hasAttribute("miniplayer-active_")
		) {
			return true;
		}

		const miniplayer = document.querySelector("ytd-miniplayer");
		return isVisible(miniplayer);
	}

	function findMiniplayerMenuItem() {
		return [...document.querySelectorAll(".ytp-menuitem")].find((item) => {
			const label =
				item.getAttribute("aria-label") ||
				item.querySelector(".ytp-menuitem-label")?.textContent ||
				item.textContent ||
				"";

			return /\bmini\s*player\b|\bminiplayer\b/i.test(label);
		});
	}

	function pressEscape() {
		const eventInit = {
			bubbles: true,
			cancelable: true,
			code: "Escape",
			composed: true,
			key: "Escape",
			keyCode: 27,
			view: window,
			which: 27,
		};

		document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
		document.dispatchEvent(new KeyboardEvent("keyup", eventInit));
	}

	function clickContextMenuMiniplayerItem() {
		const target =
			document.querySelector("#movie_player video, video") || getPlayerRoot();
		if (!target) return false;

		const rect = target.getBoundingClientRect();
		const clientX = Math.round(rect.left + rect.width / 2);
		const clientY = Math.round(rect.top + rect.height / 2);

		target.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				button: 2,
				buttons: 2,
				cancelable: true,
				clientX,
				clientY,
				composed: true,
				view: window,
			})
		);

		window.setTimeout(() => {
			const menuItem = findMiniplayerMenuItem();
			if (menuItem) menuItem.click();
			else pressEscape();
		}, 80);

		return true;
	}

	function triggerMiniplayer() {
		if (clickNativeMiniplayerButton()) return;
		if (callPlayerMiniplayerMethod()) return;

		dispatchMiniplayerShortcut();

		window.setTimeout(() => {
			if (!isMiniplayerActive()) clickContextMenuMiniplayerItem();
		}, 250);
	}

	state.observer = new MutationObserver(scheduleEnsure);
	state.observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	for (const eventName of NAVIGATION_EVENTS) {
		window.addEventListener(eventName, scheduleEnsure, true);
	}

	state.intervalId = window.setInterval(ensureButton, 2000);
	state.disconnect = () => {
		state.observer?.disconnect();
		window.clearInterval(state.intervalId);
		document.getElementById(STYLE_ID)?.remove();
		for (const eventName of NAVIGATION_EVENTS) {
			window.removeEventListener(eventName, scheduleEnsure, true);
		}
	};

	scheduleEnsure();
})();
