const BACKEND_URL = "http://localhost:5000";
const OFFLINE_TIMEOUT_MS = 5000;

const statusBadge = document.getElementById("systemStatus");
const sosAlertBadge = document.getElementById("sosAlertBadge");

const cardMap = {
	temperature: {
		valueId: "temperatureValue",
		card: document.getElementById("temperatureValue")?.closest("article"),
		format: (value) => `${value} °C`,
		state: "normal",
	},
	humidity: {
		valueId: "humidityValue",
		card: document.getElementById("humidityValue")?.closest("article"),
		format: (value) => `${value} %`,
		state: "normal",
	},
	ldr: {
		valueId: "ldrValue",
		card: document.getElementById("ldrValue")?.closest("article"),
		format: (value) => value || "Unknown",
		state: "normal",
	},
	flame: {
		valueId: "flameValue",
		card: document.getElementById("flameValue")?.closest("article"),
		format: (value) => value || "Unknown",
		state: "normal",
	},
	touch: {
		valueId: "touchValue",
		card: document.getElementById("touchValue")?.closest("article"),
		format: (value) => value || "Unknown",
		state: "normal",
	},
	buzzer: {
		valueId: "buzzerValue",
		card: document.getElementById("buzzerValue")?.closest("article"),
		format: (value) => value || "OFF",
		state: "normal",
	},
};

const latestValues = {
	temperature: "0",
	humidity: "0",
	ldr: "Unknown",
	flame: "Unknown",
	touch: "Unknown",
	buzzer: "OFF",
};

let offlineTimer = null;
let socketConnected = false;

function normalizeTouchValue(value) {
	const safeValue = String(value || "").trim().toLowerCase();
	if (safeValue === "pressed" || safeValue === "sos pressed") {
		return "Pressed";
	}
	return "Safe";
}

function toggleSosAlert(isActive) {
	if (!sosAlertBadge) {
		return;
	}

	sosAlertBadge.classList.toggle("active", isActive);
}

function setBadgeState(text, stateClass) {
	if (!statusBadge) {
		return;
	}

	statusBadge.textContent = text;
	statusBadge.classList.remove("is-connected", "is-disconnected", "is-offline");
	statusBadge.classList.add(stateClass);
}

function markSocketConnected() {
	socketConnected = true;
	setBadgeState("Connected", "is-connected");
}

function markSocketDisconnected() {
	socketConnected = false;
	setBadgeState("Device Offline", "is-offline");
}

function markDeviceOffline() {
	if (socketConnected) {
		setBadgeState("Device Offline", "is-offline");
	}
	applyCardState("offline", ["temperature", "humidity", "ldr", "flame", "touch", "buzzer"]);
}

function resetOfflineTimer() {
	if (offlineTimer) {
		clearTimeout(offlineTimer);
	}

	offlineTimer = setTimeout(() => {
		markDeviceOffline();
	}, OFFLINE_TIMEOUT_MS);
}

function applyCardState(state, sensorNames) {
	for (const sensorName of sensorNames) {
		const card = cardMap[sensorName]?.card;
		if (!card) {
			continue;
		}

		card.dataset.state = state;
	}
}

function pulseValue(valueElement) {
	if (!valueElement) {
		return;
	}

	valueElement.classList.remove("value-pop");
	void valueElement.offsetWidth;
	valueElement.classList.add("value-pop");
}

function updateCard(sensorName, rawValue) {
	const config = cardMap[sensorName];
	if (!config) {
		return;
	}

	const valueElement = document.getElementById(config.valueId);
	if (!valueElement) {
		return;
	}

	const displayValue = config.format(rawValue);
	valueElement.textContent = displayValue;
	pulseValue(valueElement);
	config.card.dataset.state = config.state;
	latestValues[sensorName] = displayValue;
}

function getSeverityState(sensorName, value) {
	if (sensorName === "flame") {
		return value === "Fire Detected" ? "danger" : "safe";
	}

	if (sensorName === "touch") {
		return value === "Pressed" ? "danger" : "safe";
	}

	if (sensorName === "buzzer") {
		return value === "ON" ? "danger" : "safe";
	}

	if (sensorName === "ldr") {
		return "normal";
	}

	return "normal";
}

function updateSensorCards(data) {
	const normalizedData = {
		temperature: data.temperature ?? 0,
		humidity: data.humidity ?? 0,
		ldr: data.ldr ?? "Unknown",
		flame: data.flame ?? "Unknown",
		touch: normalizeTouchValue(data.touch),
		buzzer: data.buzzer ?? "OFF",
	};

	updateCard("temperature", normalizedData.temperature);
	updateCard("humidity", normalizedData.humidity);
	updateCard("ldr", normalizedData.ldr);
	updateCard("flame", normalizedData.flame);
	updateCard("touch", normalizedData.touch);
	updateCard("buzzer", normalizedData.buzzer);

	for (const [sensorName, rawValue] of Object.entries(normalizedData)) {
		const card = cardMap[sensorName]?.card;
		if (!card) {
			continue;
		}

		card.dataset.state = getSeverityState(sensorName, rawValue);
	}

	addEventLog(
		`Sensor update: T=${normalizedData.temperature}°C, H=${normalizedData.humidity}%, LDR=${normalizedData.ldr}, Flame=${normalizedData.flame}, Touch=${normalizedData.touch}, Buzzer=${normalizedData.buzzer}`
	);
	toggleSosAlert(normalizedData.touch === "Pressed");
	resetOfflineTimer();
	setBadgeState("Connected", "is-connected");
}

function addEventLog(message) {
	const eventLog = document.getElementById("eventLog");
	if (!eventLog) {
		return;
	}

	const item = document.createElement("li");
	item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
	eventLog.prepend(item);

	while (eventLog.children.length > 8) {
		eventLog.removeChild(eventLog.lastElementChild);
	}
}

function connectSocket() {
	if (typeof window.io !== "function") {
		setBadgeState("Disconnected", "is-disconnected");
		addEventLog("Socket.IO client is unavailable.");
		return;
	}

	const socket = window.io(BACKEND_URL, {
		transports: ["websocket", "polling"],
	});

	socket.on("connect", () => {
		markSocketConnected();
		addEventLog("Connected to live backend stream.");
		resetOfflineTimer();
	});

	socket.on("disconnect", () => {
		if (offlineTimer) {
			clearTimeout(offlineTimer);
		}
		markSocketDisconnected();
		toggleSosAlert(false);
		addEventLog("Disconnected from backend stream.");
	});

	socket.on("sensorData", (data) => {
		addEventLog("Live sensor data received.");
		updateSensorCards(data);
	});

	socket.on("connect_error", () => {
		markSocketDisconnected();
		toggleSosAlert(false);
	});
}

function initializeDashboard() {
	setBadgeState("Device Offline", "is-offline");
	toggleSosAlert(false);
	for (const card of Object.values(cardMap).map((entry) => entry.card)) {
		if (card) {
			card.dataset.state = "normal";
		}
	}
	connectSocket();
}

initializeDashboard();
