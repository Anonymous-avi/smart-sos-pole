const express = require("express");
const http = require("http");
const mqtt = require("mqtt");
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// --- Database & State ---
const ATLAS_URI = "mongodb+srv://avikasrivastava16_db_user:As121620@pole.xk0m57x.mongodb.net/?appName=pole";
mongoose.connect(ATLAS_URI).then(() => console.log("Cloud Connected ☁️✅"));

const SensorData = mongoose.model('SensorData', new mongoose.Schema({
    temperature: Number, humidity: Number, ldr: String,
    flame: String, touch: String, buzzer: String,
    timestamp: { type: Date, default: Date.now }
}));

let lastData = { temp: 25, hum: 50, light: 200, sos: false };
let lastUpdate = Date.now();

// --- MQTT ---
const mqttClient = mqtt.connect('mqtt://localhost:1883');
mqttClient.on('connect', () => mqttClient.subscribe('pole/data'));

mqttClient.on('message', (topic, message) => {
    try {
        lastData = JSON.parse(message.toString());
        lastUpdate = Date.now();
        broadcastData(lastData, "REAL");
    } catch (e) { console.log("MQTT Parse Error"); }
});

// --- Unified Broadcaster ---
async function broadcastData(rawData, source) {
    const payload = {
        temperature: Number((rawData.temp || rawData.temperature || 0).toFixed(1)),
        humidity: Number((rawData.hum || rawData.humidity || 0).toFixed(1)),
        ldr: (rawData.light > 500 || rawData.ldr === "Night") ? "Night" : "Day",
        flame: rawData.sos ? "Fire Detected" : "Safe",
        touch: rawData.sos ? "Pressed" : "Safe",
        buzzer: rawData.sos ? "ON" : "OFF"
    };

    // Save to DB
    try { await new SensorData(payload).save(); } catch (e) {}

    // Send to Frontend
    io.emit("sensorData", payload);
    console.log(`[${source}] Sent: ${payload.temperature}°C`);
}

// Watchdog: Generate fake data if MQTT is silent for 5 seconds
setInterval(() => {
    if (Date.now() - lastUpdate > 5000) {
        lastData.temp += (Math.random() - 0.5);
        lastData.hum += (Math.random() * 2 - 1);
        broadcastData(lastData, "SIMULATED");
    }
}, 3000);

httpServer.listen(5000, () => console.log("Backend on Port 5000"));