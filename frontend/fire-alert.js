const revealItems = document.querySelectorAll(".reveal");
const modeLabel = document.getElementById("modeLabel");
const warningZone = document.getElementById("warningZone");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const safeBtn = document.getElementById("safeBtn");
const fireBtn = document.getElementById("fireBtn");
const steps = document.querySelectorAll("#stepsList li");

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

function resetSteps() {
	steps.forEach((step) => {
		step.classList.remove("active", "done");
	});
}

function setSafeMode() {
	modeLabel.textContent = "SAFE MODE";
	modeLabel.classList.remove("fire");
	modeLabel.classList.add("safe");
	warningZone.classList.remove("fire");
	warningZone.classList.add("safe");
	statusTitle.textContent = "No Fire Detected";
	statusText.textContent = "Environment stable. Flame sensor reading is within safe threshold.";
	resetSteps();
}

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function setFireMode() {
	modeLabel.textContent = "FIRE DETECTED";
	modeLabel.classList.remove("safe");
	modeLabel.classList.add("fire");
	warningZone.classList.remove("safe");
	warningZone.classList.add("fire");
	statusTitle.textContent = "Warning: Flame Detected";
	statusText.textContent = "Emergency fire alert active. Notify response teams immediately.";

	resetSteps();
	for (let index = 0; index < steps.length; index += 1) {
		steps[index].classList.add("active");
		await delay(420);
		steps[index].classList.remove("active");
		steps[index].classList.add("done");
	}
}

safeBtn.addEventListener("click", setSafeMode);
fireBtn.addEventListener("click", setFireMode);

setSafeMode();
