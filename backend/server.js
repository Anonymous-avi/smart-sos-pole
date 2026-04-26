
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const mqtt = require('mqtt');
const mongoose = require('mongoose');
require("dotenv").config();


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

app.get("/api/sensors", async (_req, res) => {
       const temperature = Number((Math.random() * (38 - 24) + 24).toFixed(1));
       const humidity = Number((Math.random() * (80 - 40) + 40).toFixed(1));
       const ldr = Math.random() > 0.5 ? "Day" : "Night";
       const flame = Math.random() > 0.85 ? "Fire Detected" : "Safe";
       const touch = sosActive || Math.random() > 0.9 ? "SOS Pressed" : "Safe";
       const buzzer = touch === "SOS Pressed" ? "ON" : "OFF";

       let risk = null;
	       try {
		       const mlUrl = `https://ml-environment-risk-api.onrender.com/predict?temperature=${temperature}&humidity=${humidity}`;
		       const mlRes = await fetch(mlUrl);
		       if (mlRes.ok) {
			       const mlData = await mlRes.json();
			       risk = mlData.risk ?? mlData.prediction ?? null;
		       }
	       } catch (e) {
		       risk = null;
	       }

       const payload = {
	       temperature,
	       humidity,
	       ldr,
	       flame,
	       touch,
	       gps: "28.6139, 77.2090",
	       buzzer,
	       risk,
       };

       res.status(200).json(payload);
});

app.post("/api/sos", (_req, res) => {
	sosActive = true;

	res.status(200).json({
		success: true,
		message: "SOS activated successfully",
	});
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

app.post("/api/feedback", async (req, res) => {
	const { name, email, message } = req.body;

	if (!name || !email || !message) {
		return res.status(400).json({
			success: false,
			message: "Name, email, and feedback message are required.",
		});
	}

	const { EMAIL_USER, EMAIL_PASS } = process.env;

	if (!EMAIL_USER || !EMAIL_PASS) {
		return res.status(500).json({
			success: false,
			message: "Email service is not configured on server.",
		});
	}

	try {
		const transporter = nodemailer.createTransport({
			service: "gmail",
			auth: {
				user: EMAIL_USER,
				pass: EMAIL_PASS,
			},
		});

		await transporter.sendMail({
			from: `"SOS Smart Pole" <${EMAIL_USER}>`,
			to: "jpothesis@gmail.com",
			subject: `New SOS Smart Pole Feedback from ${name}`,
			text: `Name: ${name}\nEmail: ${email}\nFeedback: ${message}`,
			replyTo: email,
		});

		return res.status(200).json({
			success: true,
			message: "Feedback email sent successfully.",
		});
	} catch (error) {
		console.error("Failed to send feedback email:", error.message);
		return res.status(500).json({
			success: false,
			message: "Failed to send feedback email.",
		});
	}
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});