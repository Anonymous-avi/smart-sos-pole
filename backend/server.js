const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mqtt = require('mqtt');
const mongoose = require('mongoose');
require("dotenv").config();

// Fix for fetch in Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let sosActive = false; // Tracks if a manual SOS was triggered from the web dashboard

// --- 1. MongoDB Atlas Connection ---
const ATLAS_URI = "mongodb+srv://avikasrivastava16_db_user:As121620@pole.xk0m57x.mongodb.net/?appName=pole";

mongoose.connect(ATLAS_URI)
    .then(() => console.log("Connected to MongoDB Atlas (Cloud) ☁️✅"))
    .catch(err => console.error("MongoDB Atlas Connection Error ❌", err));

const sensorSchema = new mongoose.Schema({
    temperature: Number,
    humidity: Number,
    ldr: String,
    flame: String,
    touch: String,
    buzzer: String,
    timestamp: { type: Date, default: Date.now }
});

const SensorData = mongoose.model('SensorData', sensorSchema);

// --- 2. MQTT Client Setup (Local Mosquitto) ---
const mqttClient = mqtt.connect('mqtt://localhost:1883');

mqttClient.on('connect', () => {
    console.log("Backend connected to Mosquitto Broker 🚀");
    mqttClient.subscribe('pole/data');
});

// Capture data from Hardware and save to Cloud
mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        const newEntry = new SensorData({
            temperature: data.temp,
            humidity: data.hum || 0,
            ldr: data.light > 500 ? "Night" : "Day", 
            flame: data.sos ? "Fire Detected" : "Safe",
            touch: data.sos ? "SOS Pressed" : "Safe",
            buzzer: data.sos ? "ON" : "OFF"
        });

        await newEntry.save();
        console.log("MQTT Data Saved to Atlas 💾☁️");
    } catch (err) {
        console.error("MQTT Processing Error:", err);
    }
});

// --- 3. The SINGLE Correct API Endpoint ---
app.get("/api/sensors", async (req, res) => {
    try {
        // 1. Fetch the absolute latest reading from hardware (saved via MQTT)
        const latestData = await SensorData.findOne().sort({ timestamp: -1 });

        if (!latestData) {
            return res.status(404).json({ message: "Waiting for hardware data..." });
        }

        // 2. Pass the REAL hardware data through the ML Model
        let risk = "Stable";
        try {
            const mlUrl = `https://ml-environment-risk-api.onrender.com/predict?temperature=${latestData.temperature}&humidity=${latestData.humidity}`;
            const mlRes = await fetch(mlUrl);
            if (mlRes.ok) {
                const mlData = await mlRes.json();
                risk = mlData.risk ?? mlData.prediction ?? "Stable";
            }
        } catch (e) {
            risk = "ML Offline";
        }

        // 3. Send the final real-time payload to your website
        res.status(200).json({
            temperature: latestData.temperature,
            humidity: latestData.humidity,
            ldr: latestData.ldr,
            flame: latestData.flame,
            touch: latestData.touch,
            buzzer: latestData.buzzer,
            risk: risk,
            gps: "28.6139, 77.2090"
        });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "Cloud fetch failed" });
    }
});

// Trigger SOS from Dashboard
app.post("/api/sos", (req, res) => {
    mqttClient.publish('pole/commands', JSON.stringify({ action: "SOS_ON" }));
    res.status(200).json({ success: true, message: "SOS command sent to hardware" });
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});