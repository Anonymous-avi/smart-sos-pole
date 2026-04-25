const API_URL = "http://localhost:5000/api/sensors";

const dom = {
	temperatureValue: document.getElementById("temperatureValue"),
	humidityValue: document.getElementById("humidityValue"),
	temperatureNote: document.getElementById("temperatureNote"),
	humidityNote: document.getElementById("humidityNote"),
	connectionStatus: document.getElementById("connectionStatus"),
	lastUpdated: document.getElementById("lastUpdated"),
	eventLog: document.getElementById("eventLog"),
};

const revealItems = document.querySelectorAll(".reveal");
let wasConnected = false;

const revealObserver = new IntersectionObserver(
	(entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add("visible");
				observer.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.15 }
);

revealItems.forEach((item) => revealObserver.observe(item));

function pushEvent(message) {
	if (!dom.eventLog) {
		return;
	}

	const time = new Date().toLocaleTimeString();
	const row = document.createElement("li");
	row.textContent = `${time} - ${message}`;
	dom.eventLog.prepend(row);

	while (dom.eventLog.children.length > 7) {
		dom.eventLog.removeChild(dom.eventLog.lastChild);
	}
}

function updateNotes(temperature, humidity) {
	if (!dom.temperatureNote || !dom.humidityNote) {
		return;
	}

	dom.temperatureNote.classList.remove("ok", "warn", "danger");
	dom.humidityNote.classList.remove("ok", "warn", "danger");

	if (temperature >= 35) {
		dom.temperatureNote.textContent = "High temperature";
		dom.temperatureNote.classList.add("danger");
	} else if (temperature >= 30) {
		dom.temperatureNote.textContent = "Warm range";
		dom.temperatureNote.classList.add("warn");
	} else {
		dom.temperatureNote.textContent = "Normal range";
		dom.temperatureNote.classList.add("ok");
	}

	if (humidity >= 70) {
		dom.humidityNote.textContent = "High humidity";
		dom.humidityNote.classList.add("warn");
	} else if (humidity < 45) {
		dom.humidityNote.textContent = "Dry air";
		dom.humidityNote.classList.add("warn");
	} else {
		dom.humidityNote.textContent = "Comfort range";
		dom.humidityNote.classList.add("ok");
	}
}

function setConnection(status, text) {
	if (!dom.connectionStatus) {
		return;
	}

	dom.connectionStatus.classList.remove("waiting", "online", "offline");
	dom.connectionStatus.classList.add(status);
	dom.connectionStatus.textContent = text;
}

function updateUI(sensorData) {
	const temperature = Number(sensorData.temperature ?? sensorData.temp ?? 0);
	const humidity = Number(sensorData.humidity ?? 0);

	dom.temperatureValue.textContent = `${temperature.toFixed(1)} deg C`;
	dom.humidityValue.textContent = `${humidity.toFixed(1)}%`;
	updateNotes(temperature, humidity);

	if (dom.lastUpdated) {
		dom.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
	}
}

async function fetchWeatherData() {
	try {
		const response = await fetch(API_URL);
		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const data = await response.json();
		updateUI(data);
		setConnection("online", "Backend connected: live weather feed active");

		if (!wasConnected) {
			pushEvent("Connected to backend weather API.");
			wasConnected = true;
		}
	} catch (_error) {
		setConnection("offline", "Backend unavailable: retrying...");
		if (wasConnected) {
			pushEvent("Weather API connection lost.");
		}
		wasConnected = false;
	}
}

fetchWeatherData();
setInterval(fetchWeatherData, 2000);
