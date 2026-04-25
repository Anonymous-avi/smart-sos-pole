const revealItems = document.querySelectorAll(".reveal");
const scene = document.getElementById("scene");
const modeLabel = document.getElementById("modeLabel");
const dayBtn = document.getElementById("dayBtn");
const nightBtn = document.getElementById("nightBtn");

let currentMode = "day";
let autoTimer;

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

function setMode(mode) {
	if (!scene || !modeLabel) {
		return;
	}

	currentMode = mode;
	scene.classList.toggle("day", mode === "day");
	scene.classList.toggle("night", mode === "night");
	modeLabel.classList.toggle("day", mode === "day");
	modeLabel.classList.toggle("night", mode === "night");
	modeLabel.textContent = mode === "day" ? "Day Mode: Light OFF" : "Night Mode: Light ON";
}

function restartAutoCycle() {
	clearInterval(autoTimer);
	autoTimer = setInterval(() => {
		setMode(currentMode === "day" ? "night" : "day");
	}, 3500);
}

if (dayBtn) {
	dayBtn.addEventListener("click", () => {
		setMode("day");
		restartAutoCycle();
	});
}

if (nightBtn) {
	nightBtn.addEventListener("click", () => {
		setMode("night");
		restartAutoCycle();
	});
}

setMode("day");
restartAutoCycle();
