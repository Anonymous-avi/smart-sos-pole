const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let sosActive = false;

app.get("/", (_req, res) => {
	res.status(200).send("SOS Smart Pole Backend Running Successfully");
});

app.get("/api/sensors", (_req, res) => {
	const temperature = Number((Math.random() * (38 - 24) + 24).toFixed(1));
	const humidity = Number((Math.random() * (80 - 40) + 40).toFixed(1));
	const ldr = Math.random() > 0.5 ? "Day" : "Night";
	const flame = Math.random() > 0.85 ? "Fire Detected" : "Safe";
	const touch = sosActive || Math.random() > 0.9 ? "SOS Pressed" : "Safe";
	const buzzer = touch === "SOS Pressed" ? "ON" : "OFF";

	const payload = {
		temperature,
		humidity,
		ldr,
		flame,
		touch,
		gps: "28.6139, 77.2090",
		buzzer,
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

app.listen(PORT, () => {
	console.log(`SOS Smart Pole backend running on http://localhost:${PORT}`);
});
