
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

require("dotenv").config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let sosActive = false;

app.get("/", (_req, res) => {
	res.status(200).send("SOS Smart Pole Backend Running Successfully");
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
	console.log(`SOS Smart Pole backend running on http://localhost:${PORT}`);
});
