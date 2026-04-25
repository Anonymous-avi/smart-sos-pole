const dom = {
    temperature: document.getElementById("temperatureValue"),
    humidity: document.getElementById("humidityValue"),
    ldr: document.getElementById("ldrValue"),
    flame: document.getElementById("flameValue"),
    touch: document.getElementById("touchValue"),
    buzzer: document.getElementById("buzzerValue"),
    systemStatus: document.getElementById("systemStatus"),
    eventLog: document.getElementById("eventLog"),
};

const API_BASE_URL = "http://localhost:5000/api";

const state = {
    temperature: 29.2,
    humidity: 58,
    ldrDark: false,
    flameDetected: false,
    touchSOS: false,
    buzzerOn: false,
};

const trendData = {
    labels: [],
    temperature: [],
    humidity: [],
};

const MAX_POINTS = 10;
let environmentChart;
let safetyChart;
let wasConnected = false;

function pushEvent(message) {
    if (!dom.eventLog) return;

    const time = new Date().toLocaleTimeString();
    const item = document.createElement("li");
    item.textContent = `${time} - ${message}`;
    dom.eventLog.prepend(item);

    // Keep log clean (last 10 items)
    while (dom.eventLog.children.length > 10) {
        dom.eventLog.removeChild(dom.eventLog.lastChild);
    }
}

function setStatusClass(element, statusClass) {
    if (!element) return;
    element.classList.remove("is-ok", "is-warning", "is-danger");
    element.classList.add(statusClass);
}

function updateSensorCards() {
    if (!dom.temperature) return;

    dom.temperature.textContent = `${state.temperature.toFixed(1)} deg C`;
    dom.humidity.textContent = `${Math.round(state.humidity)}%`;
    dom.ldr.textContent = state.ldrDark ? "Night" : "Day";
    dom.flame.textContent = state.flameDetected ? "Fire Detected" : "Safe";
    dom.touch.textContent = state.touchSOS ? "SOS Pressed" : "Safe";
    dom.buzzer.textContent = state.buzzerOn ? "ON" : "OFF";

    setStatusClass(dom.temperature, state.temperature > 36 ? "is-warning" : "is-ok");
    setStatusClass(dom.humidity, state.humidity > 75 ? "is-warning" : "is-ok");
    setStatusClass(dom.ldr, state.ldrDark ? "is-warning" : "is-ok");
    setStatusClass(dom.flame, state.flameDetected ? "is-danger" : "is-ok");
    setStatusClass(dom.touch, state.touchSOS ? "is-danger" : "is-ok");
    setStatusClass(dom.buzzer, state.buzzerOn ? "is-warning" : "is-ok");

    if (dom.systemStatus) {
        if (state.flameDetected || state.touchSOS) {
            dom.systemStatus.textContent = "Alert Active";
            dom.systemStatus.style.background = "rgba(255, 95, 95, 0.16)";
            dom.systemStatus.style.borderColor = "rgba(255, 95, 95, 0.46)";
            dom.systemStatus.style.color = "#ffd2d2";
        } else {
            dom.systemStatus.textContent = "System Stable";
            dom.systemStatus.style.background = "rgba(45, 211, 155, 0.14)";
            dom.systemStatus.style.borderColor = "rgba(45, 211, 155, 0.4)";
            dom.systemStatus.style.color = "#b9fbe2";
        }
    }
}

function updateTrends() {
    const now = new Date();
    const label = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    trendData.labels.push(label);
    trendData.temperature.push(Number(state.temperature.toFixed(1)));
    trendData.humidity.push(Math.round(state.humidity));

    if (trendData.labels.length > MAX_POINTS) {
        trendData.labels.shift();
        trendData.temperature.shift();
        trendData.humidity.shift();
    }

    environmentChart.data.labels = trendData.labels;
    environmentChart.data.datasets[0].data = trendData.temperature;
    environmentChart.data.datasets[1].data = trendData.humidity;
    environmentChart.update();
}

function updateSafetyChart() {
    safetyChart.data.datasets[0].data = [
        state.ldrDark ? 1 : 0,
        state.flameDetected ? 1 : 0,
        state.touchSOS ? 1 : 0,
        state.buzzerOn ? 1 : 0,
    ];
    safetyChart.update();
}

function applySensorPayload(sensorData) {
    state.temperature = Number(sensorData.temperature ?? sensorData.temp ?? state.temperature);
    state.humidity = Number(sensorData.humidity ?? state.humidity);
    state.ldrDark = String(sensorData.ldr || "Day").toLowerCase() === "night";
    state.flameDetected = String(sensorData.flame || "Safe").toLowerCase() === "fire detected";
    state.touchSOS = String(sensorData.touch || "Safe").toLowerCase() === "sos pressed";
    state.buzzerOn = String(sensorData.buzzer || "OFF").toUpperCase() === "ON";

    updateSensorCards();
    updateTrends();
    updateSafetyChart();
}

async function fetchSensorData() {
    try {
        const response = await fetch(`${API_BASE_URL}/sensors`);
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const sensorData = await response.json();
        applySensorPayload(sensorData);

        if (!wasConnected) {
            pushEvent("Connected to backend sensor API.");
            wasConnected = true;
        }
    } catch (error) {
        if (wasConnected) pushEvent("Sensor API connection lost.");
        wasConnected = false;
        if (dom.systemStatus) dom.systemStatus.textContent = "Backend Offline";
    }
}

function createCharts() {
    const envCtx = document.getElementById("environmentChart");
    const safetyCtx = document.getElementById("safetyChart");

    environmentChart = new Chart(envCtx, {
        type: "line",
        data: {
            labels: trendData.labels,
            datasets: [
                {
                    label: "Temperature",
                    data: trendData.temperature,
                    borderColor: "#62d5ff",
                    backgroundColor: "rgba(98, 213, 255, 0.16)",
                    borderWidth: 2,
                    tension: 0.36,
                    fill: true,
                },
                {
                    label: "Humidity",
                    data: trendData.humidity,
                    borderColor: "#9fbcff",
                    backgroundColor: "rgba(159, 188, 255, 0.14)",
                    borderWidth: 2,
                    tension: 0.36,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#d5e7ff" } } },
            scales: {
                x: { ticks: { color: "#9db8df" }, grid: { color: "rgba(157, 184, 223, 0.15)" } },
                y: { ticks: { color: "#9db8df" }, grid: { color: "rgba(157, 184, 223, 0.15)" } },
            },
        },
    });

    safetyChart = new Chart(safetyCtx, {
        type: "bar",
        data: {
            labels: ["LDR Dark", "Flame", "Touch SOS", "Buzzer"],
            datasets: [{
                label: "State",
                data: [0, 0, 0, 0],
                backgroundColor: [
                    "rgba(255, 209, 102, 0.75)",
                    "rgba(255, 95, 95, 0.75)",
                    "rgba(255, 95, 95, 0.75)",
                    "rgba(87, 178, 255, 0.75)",
                ],
                borderRadius: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#9db8df" }, grid: { color: "rgba(157, 184, 223, 0.12)" } },
                y: { min: 0, max: 1, ticks: { stepSize: 1, color: "#9db8df" }, grid: { color: "rgba(157, 184, 223, 0.12)" } },
            },
        },
    });
}

async function initDashboard() {
    createCharts();
    updateSensorCards();
    updateTrends();
    updateSafetyChart();
    pushEvent("Waiting for backend sensor feed...");
    await fetchSensorData();
    setInterval(fetchSensorData, 2000);
}

initDashboard();