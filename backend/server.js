
const express = require("express");
const cors = require("cors");
const http = require("http");
const mqtt = require("mqtt");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	},
});

const PORT = Number(process.env.PORT) || 5000;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://test.mosquitto.org";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "sos-smart-pole/sensors";
const SERIAL_PORT_PATH = process.env.SERIAL_PORT || "COM10";
const SERIAL_BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE) || 9600;
const SERIAL_RETRY_DELAY_MS = 5000;

let latestSensorData = null;
let activePort = PORT;

app.use(cors());
app.use(express.json());

// Parse one Arduino line like:
// TEMP:28,HUM:60,LDR:Night,FLAME:Safe,TOUCH:Safe,BUZZER:OFF
function parseSensorLine(line) {
	const result = {};
	const pairs = line.split(",");

	for (const pair of pairs) {
		const [rawKey, ...rawValueParts] = pair.split(":");
		if (!rawKey || rawValueParts.length === 0) {
			continue;
		}

		const key = rawKey.trim().toUpperCase();
		const value = rawValueParts.join(":").trim();

		if (key === "TEMP") {
			result.temperature = Number(value);
		} else if (key === "HUM") {
			result.humidity = Number(value);
		} else if (key === "LDR") {
			result.ldr = value;
		} else if (key === "FLAME") {
			result.flame = value;
		} else if (key === "TOUCH") {
			result.touch = value;
		} else if (key === "BUZZER") {
			result.buzzer = value;
		}
	}

	if (
		typeof result.temperature !== "number" ||
		Number.isNaN(result.temperature) ||
		typeof result.humidity !== "number" ||
		Number.isNaN(result.humidity)
	) {
		return null;
	}

	return result;
}

const mqttClient = mqtt.connect(MQTT_BROKER_URL);

let serialPort = null;
let serialParser = null;
let serialRetryTimer = null;
let activeSerialPortPath = null;

function normalizeSensorData(data) {
	const temperature = Number(data.temperature);
	const humidity = Number(data.humidity);

	if (Number.isNaN(temperature) || Number.isNaN(humidity)) {
		return null;
	}

	return {
		temperature,
		humidity,
		ldr: String(data.ldr || "Unknown"),
		flame: String(data.flame || "Safe"),
		touch: String(data.touch || "Safe"),
		buzzer: String(data.buzzer || "OFF"),
	};
}

function parseMqttPayload(payloadText) {
	// Accept both JSON and CSV payloads.
	try {
		const parsedJson = JSON.parse(payloadText);
		if (parsedJson && parsedJson.source === "backend-serial") {
			return null;
		}

		return normalizeSensorData(parsedJson || {});
	} catch (_error) {
		return parseSensorLine(payloadText);
	}
}

function handleSensorData(data, source = "serial") {
	latestSensorData = {
		...data,
		timestamp: new Date().toISOString(),
	};

	console.log("Sensor data received", latestSensorData);

	if (source !== "mqtt") {
		mqttClient.publish(
			MQTT_TOPIC,
			JSON.stringify({
				...latestSensorData,
				source: "backend-serial",
			})
		);
	}

	io.emit("sensorData", latestSensorData);
}

app.get("/", (_req, res) => {
	res.status(200).json({
		message: "SOS Smart Pole backend is running",
		port: activePort,
	});
});

app.get("/api/latest", (_req, res) => {
	if (!latestSensorData) {
		return res.status(404).json({
			message: "No sensor data received yet",
		});
	}

	return res.status(200).json(latestSensorData);
});

mqttClient.on("connect", () => {
	console.log("MQTT connected");
	mqttClient.subscribe(MQTT_TOPIC, (error) => {
		if (error) {
			console.error(`MQTT subscribe failed for ${MQTT_TOPIC}:`, error.message);
			return;
		}

		console.log(`MQTT subscribed to ${MQTT_TOPIC}`);
	});
});

mqttClient.on("message", (topic, messageBuffer) => {
	if (topic !== MQTT_TOPIC) {
		return;
	}

	const payloadText = messageBuffer.toString().trim();
	if (!payloadText) {
		return;
	}

	const parsedData = parseMqttPayload(payloadText);
	if (!parsedData) {
		return;
	}

	handleSensorData(parsedData, "mqtt");
});

mqttClient.on("error", (error) => {
	console.error("MQTT error:", error.message);
});

function isPortBusyError(error) {
	const message = String(error.message || "").toLowerCase();
	return error.code === "EACCES" || error.code === "EBUSY" || message.includes("access denied") || message.includes("busy");
}

function isArduinoCompatiblePort(portInfo) {
	const vendorId = String(portInfo.vendorId || "").toLowerCase().replace(/^0x/, "");
	const text = `${portInfo.path || ""} ${portInfo.manufacturer || ""} ${portInfo.friendlyName || ""} ${portInfo.pnpId || ""}`.toLowerCase();

	if (vendorId === "2341" || vendorId === "2a03") {
		return true;
	}

	return ["arduino", "usb serial", "wch", "ch340", "cp210", "silicon labs", "ftdi"].some((keyword) => text.includes(keyword));
}

function scheduleSerialReconnect() {
	if (serialRetryTimer) {
		return;
	}

	serialRetryTimer = setTimeout(() => {
		serialRetryTimer = null;
		connectArduinoSerial();
	}, SERIAL_RETRY_DELAY_MS);
}

async function resolveSerialPortPath() {
	const ports = await SerialPort.list();
	const preferredPath = SERIAL_PORT_PATH.toUpperCase();
	const preferredPort = ports.find((port) => String(port.path || "").toUpperCase() === preferredPath);

	if (preferredPort) {
		return preferredPort.path;
	}

	const compatiblePort = ports.find((port) => isArduinoCompatiblePort(port));
	if (compatiblePort) {
		console.log(`Configured port ${SERIAL_PORT_PATH} not found. Using ${compatiblePort.path} automatically.`);
		return compatiblePort.path;
	}

	return null;
}

function connectArduinoSerial() {
	resolveSerialPortPath()
		.then((selectedPortPath) => {
			if (!selectedPortPath) {
				console.warn("No Arduino-compatible COM port found. Retrying in 5 seconds...");
				scheduleSerialReconnect();
				return;
			}

			serialPort = new SerialPort({
				path: selectedPortPath,
				baudRate: SERIAL_BAUD_RATE,
				autoOpen: false,
			});

			serialParser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

			serialParser.on("data", (line) => {
				const cleanedLine = String(line).trim();

				if (!cleanedLine) {
					return;
				}

				const parsedData = parseSensorLine(cleanedLine);

				if (!parsedData) {
					console.warn("Ignoring malformed sensor line:", cleanedLine);
					return;
				}

				handleSensorData(parsedData);
			});

			serialPort.on("error", (error) => {
				if (isPortBusyError(error)) {
					console.error("COM port busy. Close Arduino IDE or Serial Monitor.");
				} else {
					console.error("Serial port error:", error.message);
				}

				scheduleSerialReconnect();
			});

			serialPort.on("close", () => {
				if (activeSerialPortPath) {
					console.warn(`Serial connection closed on ${activeSerialPortPath}. Retrying in 5 seconds...`);
				}
				activeSerialPortPath = null;
				scheduleSerialReconnect();
			});

			serialPort.open((error) => {
				if (error) {
					if (isPortBusyError(error)) {
						console.error("COM port busy. Close Arduino IDE or Serial Monitor.");
					} else {
						console.error(`Failed to open serial port ${selectedPortPath}:`, error.message);
					}

					scheduleSerialReconnect();
					return;
				}

				activeSerialPortPath = selectedPortPath;
				console.log(`Arduino connected on ${activeSerialPortPath}`);
			});
		})
		.catch((error) => {
			console.error("Failed to detect COM ports:", error.message);
			scheduleSerialReconnect();
		});
}

connectArduinoSerial();

io.on("connection", (socket) => {
	if (latestSensorData) {
		socket.emit("sensorData", latestSensorData);
	}
});

function startServer(portToTry) {
	const onListenError = (error) => {
		if (error.code === "EADDRINUSE") {
			if (portToTry === 5000) {
				console.log("Port 5000 already in use. Trying port 5001...");
			} else {
				console.log(`Port ${portToTry} already in use. Trying port ${portToTry + 1}...`);
			}

			startServer(portToTry + 1);
			return;
		}

		console.error("Server failed to start:", error.message);
		process.exit(1);
	};

	httpServer.once("error", onListenError);
	httpServer.listen(portToTry, () => {
		httpServer.removeListener("error", onListenError);
		activePort = portToTry;
		console.log(`Backend running on http://localhost:${activePort}`);
	});
}

startServer(PORT);