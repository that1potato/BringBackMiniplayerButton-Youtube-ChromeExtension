(() => {
	"use strict";

	const BUTTON_ID = "bbmp-miniplayer-button";
	const OLD_BUTTON_ID = "myext-miniplayer-btn";
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
			isVisible
		);
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
		const outer = document.createElementNS(svgNamespace, "rect");
		const inner = document.createElementNS(svgNamespace, "rect");

		setAttributes(svg, {
			viewBox: "0 0 36 36",
			width: "100%",
			height: "100%",
			focusable: "false",
			"aria-hidden": "true",
		});

		setAttributes(outer, {
			x: "6",
			y: "11",
			width: "24",
			height: "17",
			rx: "2",
			ry: "2",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2.6",
		});

		setAttributes(inner, {
			x: "20",
			y: "22",
			width: "8",
			height: "5",
			rx: "1",
			ry: "1",
			fill: "currentColor",
		});

		svg.append(outer, inner);
		return svg;
	}

	function buildButton() {
		const button = document.createElement("button");
		button.id = BUTTON_ID;
		button.className = "ytp-button";
		button.type = "button";
		button.title = "Miniplayer (i)";
		button.setAttribute("aria-label", "Miniplayer");
		button.setAttribute("data-title-no-tooltip", "Miniplayer");
		button.setAttribute("data-tooltip-target-id", "ytp-miniplayer-button");
		button.setAttribute("data-priority", "11");

		Object.assign(button.style, {
			alignItems: "center",
			color: "inherit",
			display: "inline-flex",
			flex: "0 0 auto",
			justifyContent: "center",
			lineHeight: "normal",
			verticalAlign: "top",
		});

		button.appendChild(buildIcon());

		button.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				triggerMiniplayer();
			},
			true
		);

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
		for (const eventName of NAVIGATION_EVENTS) {
			window.removeEventListener(eventName, scheduleEnsure, true);
		}
	};

	scheduleEnsure();
})();
