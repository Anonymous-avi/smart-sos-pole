const express = require("express");
const cors = require("cors");
const mqtt = require('mqtt');
const mongoose = require('mongoose');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// --- 1. MongoDB Atlas Connection ---
// Paste your connection string from the MongoDB Atlas Dashboard here
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

// --- 2. MQTT Client Setup (Port 1883 for local Mosquitto) ---
const mqttClient = mqtt.connect('mqtt://localhost:1883');

mqttClient.on('connect', () => {
    console.log("Backend connected to Mosquitto Broker 🚀");
    mqttClient.subscribe('pole/data');
});

// Handle incoming messages from the Arduino
mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        // Map Arduino JSON keys to your Database Schema
        const newEntry = new SensorData({
            temperature: data.temp,
            humidity: data.hum || 0,
            ldr: data.light > 500 ? "Night" : "Day", 
            flame: data.sos ? "Fire Detected" : "Safe",
            touch: data.sos ? "SOS Pressed" : "Safe",
            buzzer: data.sos ? "ON" : "OFF"
        });

        await newEntry.save();
        console.log("Real-time data saved to MongoDB Atlas 💾☁️");
    } catch (err) {
        console.error("Error processing MQTT message:", err);
    }
});

// --- 3. API Endpoints ---

app.get("/", (_req, res) => {
    res.status(200).send("SOS Smart Pole Backend: Cloud Connected");
});

// Fetch the LATEST sensor reading from Atlas
app.get("/api/sensors", async (_req, res) => {
    try {
        const latestData = await SensorData.findOne().sort({ timestamp: -1 });
        
        if (!latestData) {
            return res.status(404).json({ message: "No data in cloud yet" });
        }

        res.status(200).json(latestData);
    } catch (err) {
        res.status(500).json({ error: "Cloud fetch failed" });
    }
});

// Trigger SOS from website
app.post("/api/sos", (req, res) => {
    mqttClient.publish('pole/commands', JSON.stringify({ action: "SOS_ON" }));
    res.status(200).json({ success: true, message: "SOS command published" });
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});