// SOS Smart Pole Arduino sketch
// Serial output format expected by the Node.js backend:
// TEMP:28,HUM:60,LDR:Night,FLAME:Safe,TOUCH:Safe,BUZZER:OFF

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <WiFiS3.h>
#include <PubSubClient.h>

// -------------------- Hardware settings --------------------
// Change these pins if your wiring is different.
const int DHT_PIN = 2;
const int DHT_TYPE = DHT11;
const int LDR_PIN = A0;
const int FLAME_PIN = 4;
const int TOUCH_PIN = 5;
const int BUZZER_PIN = 6;
const int LED_PIN = 13;

// OLED display settings.
const int SCREEN_WIDTH = 128;
const int SCREEN_HEIGHT = 64;
const int OLED_RESET = -1;
const byte OLED_ADDRESS = 0x3C;

// Serial output interval.
const unsigned long SERIAL_INTERVAL_MS = 2000;

// MQTT / WiFi settings.
// Replace these with your WiFi credentials.
const char WIFI_SSID[] = "Airtel_Room209";
const char WIFI_PASSWORD[] = "air00486";
const char MQTT_BROKER[] = "test.mosquitto.org";
const int MQTT_PORT = 1883;
const char MQTT_TOPIC[] = "sos-smart-pole/sensors";
const unsigned long WIFI_RETRY_MS = 10000;
const unsigned long MQTT_RETRY_MS = 5000;

// Sensor thresholds.
const int LDR_NIGHT_THRESHOLD = 500;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSerialSend = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
bool systemOn = false;
bool previousTouchReading = HIGH;
bool wifiConnectedLogged = false;

void ensureWiFiConnected();
void ensureMqttConnected();
void buildSensorPayload(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive, char *buffer, size_t bufferSize);
void sendMqttData(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive);

void setup() {
	pinMode(FLAME_PIN, INPUT);
	pinMode(TOUCH_PIN, INPUT_PULLUP);
	pinMode(BUZZER_PIN, OUTPUT);
	pinMode(LED_PIN, OUTPUT);

	digitalWrite(BUZZER_PIN, LOW);
	digitalWrite(LED_PIN, LOW);

	Serial.begin(9600);
	dht.begin();
	mqttClient.setServer(MQTT_BROKER, MQTT_PORT);

	display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
	display.clearDisplay();
	display.setTextColor(SSD1306_WHITE);
	display.setTextSize(1);

	showStartupScreen();
}

void loop() {
	ensureWiFiConnected();
	ensureMqttConnected();
	mqttClient.loop();

	updateTouchState();

	int rawLdrValue = analogRead(LDR_PIN);
	bool isNight = rawLdrValue < LDR_NIGHT_THRESHOLD;
	digitalWrite(LED_PIN, isNight ? HIGH : LOW);

	bool flameDetected = digitalRead(FLAME_PIN) == LOW;
	if (flameDetected) {
		systemOn = true;
	}

	float temperature = dht.readTemperature();
	float humidity = dht.readHumidity();

	bool buzzerActive = systemOn || flameDetected;
	digitalWrite(BUZZER_PIN, buzzerActive ? HIGH : LOW);

	updateOled(temperature, humidity, isNight, flameDetected, systemOn, buzzerActive);

	unsigned long currentMillis = millis();
	if (currentMillis - lastSerialSend >= SERIAL_INTERVAL_MS) {
		lastSerialSend = currentMillis;
		sendSerialData(temperature, humidity, isNight, flameDetected, systemOn, buzzerActive);
		sendMqttData(temperature, humidity, isNight, flameDetected, systemOn, buzzerActive);
	}
}

void ensureWiFiConnected() {
	int status = WiFi.status();

	if (status == WL_CONNECTED) {
		wifiConnectedLogged = true;
		return;
	}

	wifiConnectedLogged = false;

	unsigned long currentMillis = millis();
	if (currentMillis - lastWifiAttempt < WIFI_RETRY_MS) {
		return;
	}

	lastWifiAttempt = currentMillis;
	WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void ensureMqttConnected() {
	if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) {
		return;
	}

	unsigned long currentMillis = millis();
	if (currentMillis - lastMqttAttempt < MQTT_RETRY_MS) {
		return;
	}

	lastMqttAttempt = currentMillis;

	String clientId = "SOSSmartPole-UNO-R4-" + String((uint32_t)millis(), HEX);
	mqttClient.connect(clientId.c_str());
}

void updateTouchState() {
	int touchReading = digitalRead(TOUCH_PIN);

	// Toggle the SOS system only on the button press edge.
	if (previousTouchReading == HIGH && touchReading == LOW) {
		systemOn = !systemOn;
	}

	previousTouchReading = touchReading;
}

void sendSerialData(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive) {
	char payload[128];
	buildSensorPayload(temperature, humidity, isNight, flameDetected, isPressed, buzzerActive, payload, sizeof(payload));
	Serial.println(payload);
}

void sendMqttData(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive) {
	if (!mqttClient.connected()) {
		return;
	}

	char payload[128];
	buildSensorPayload(temperature, humidity, isNight, flameDetected, isPressed, buzzerActive, payload, sizeof(payload));
	mqttClient.publish(MQTT_TOPIC, payload);
}

void buildSensorPayload(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive, char *buffer, size_t bufferSize) {
	int temperatureValue = (int)round(temperature);
	int humidityValue = (int)round(humidity);

	if (isnan(temperature) || isnan(humidity)) {
		temperatureValue = 0;
		humidityValue = 0;
	}

	snprintf(
		buffer,
		bufferSize,
		"TEMP:%d,HUM:%d,LDR:%s,FLAME:%s,TOUCH:%s,BUZZER:%s",
		temperatureValue,
		humidityValue,
		isNight ? "Night" : "Day",
		flameDetected ? "Fire Detected" : "Safe",
		isPressed ? "Pressed" : "Safe",
		buzzerActive ? "ON" : "OFF"
	);
}

void updateOled(float temperature, float humidity, bool isNight, bool flameDetected, bool isPressed, bool buzzerActive) {
	display.clearDisplay();
	display.setCursor(0, 0);
	display.println("SOS Smart Pole");
	display.println("---------------");

	display.print("Temp: ");
	if (isnan(temperature)) {
		display.println("--");
	} else {
		display.print(temperature, 0);
		display.println(" C");
	}

	display.print("Hum : ");
	if (isnan(humidity)) {
		display.println("--");
	} else {
		display.print(humidity, 0);
		display.println(" %");
	}

	display.print("LDR : ");
	display.println(isNight ? "Night" : "Day");

	display.print("Flame: ");
	display.println(flameDetected ? "Detected" : "Safe");

	display.print("Touch: ");
	display.println(isPressed ? "Pressed" : "Safe");

	display.print("Buzz : ");
	display.println(buzzerActive ? "ON" : "OFF");

	display.display();
}

void showStartupScreen() {
	display.clearDisplay();
	display.setCursor(0, 0);
	display.println("SOS Smart Pole");
	display.println("Backend format ready");
	display.display();
	delay(1000);
}
