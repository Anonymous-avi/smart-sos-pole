const API_URL = "http://localhost:5000/api/sensors";

const dom = {
	coordinate: document.getElementById("coordinateValue"),
	status: document.getElementById("connectionStatus"),
	lastUpdated: document.getElementById("lastUpdated"),
	mapFrame: document.getElementById("mapFrame"),
	openMapLink: document.getElementById("openMapLink"),
};

const revealItems = document.querySelectorAll(".reveal");
let wasConnected = false;
let mapInitialized = false;

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

function setConnection(status, text) {
	if (!dom.status) {
		return;
	}

	dom.status.classList.remove("waiting", "online", "offline");
	dom.status.classList.add(status);
	dom.status.textContent = text;
}

function parseGps(gpsValue) {
	if (typeof gpsValue === "string") {
		const [latText, lonText] = gpsValue.split(",").map((value) => value.trim());
		const lat = Number(latText);
		const lon = Number(lonText);

		if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
			return { lat, lon };
		}
	}

	if (gpsValue && typeof gpsValue === "object") {
		const lat = Number(gpsValue.lat);
		const lon = Number(gpsValue.lon ?? gpsValue.lng);
		if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
			return { lat, lon };
		}
	}

	return null;
}

function buildEmbedUrl(lat, lon) {
	return `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
}

function buildOpenMapUrl(lat, lon) {
	return `https://www.google.com/maps?q=${lat},${lon}`;
}

function initializeMap(lat, lon) {
	if (mapInitialized) {
		return;
	}

	const embedUrl = buildEmbedUrl(lat, lon);
	if (dom.mapFrame) {
		dom.mapFrame.src = embedUrl;
	}
	if (dom.openMapLink) {
		dom.openMapLink.href = buildOpenMapUrl(lat, lon);
	}

	mapInitialized = true;
}

function updateGpsUI(lat, lon) {
	if (dom.coordinate) {
		dom.coordinate.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}

	initializeMap(lat, lon);

	if (dom.lastUpdated) {
		dom.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
	}
}

async function fetchGpsData() {
	try {
		const response = await fetch(API_URL);
		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const payload = await response.json();
		const parsed = parseGps(payload.gps);
		if (!parsed) {
			throw new Error("GPS data is missing or invalid");
		}

		updateGpsUI(parsed.lat, parsed.lon);
		setConnection("online", "Backend connected: live GPS feed active");
		wasConnected = true;
	} catch (_error) {
		setConnection("offline", "Backend unavailable: retrying GPS feed...");
		if (dom.coordinate && !wasConnected) {
			dom.coordinate.textContent = "28.6139, 77.2090";
			initializeMap(28.6139, 77.2090);
		}
	}
}

fetchGpsData();
setInterval(fetchGpsData, 2000);
