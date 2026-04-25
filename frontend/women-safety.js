const revealItems = document.querySelectorAll(".reveal");
const workflowItems = document.querySelectorAll("#workflowList li");
const sosButton = document.getElementById("sosButton");
const alertStatus = document.getElementById("alertStatus");
const buzzerStatus = document.getElementById("buzzerStatus");
const gpsStatus = document.getElementById("gpsStatus");

let workflowRunning = false;

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

function resetWorkflowVisuals() {
	workflowItems.forEach((item) => {
		item.classList.remove("active", "completed");
	});
}

function updateStatusChip(chip, message) {
	if (!chip) {
		return;
	}

	chip.textContent = message;
	chip.classList.add("ok");
}

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function runWorkflow() {
	if (workflowRunning) {
		return;
	}

	workflowRunning = true;
	resetWorkflowVisuals();

	alertStatus.textContent = "Alert not sent";
	buzzerStatus.textContent = "Buzzer inactive";
	gpsStatus.textContent = "GPS not shared";
	alertStatus.classList.remove("ok");
	buzzerStatus.classList.remove("ok");
	gpsStatus.classList.remove("ok");

	sosButton.classList.add("pulsing");
	sosButton.disabled = true;

	for (let index = 0; index < workflowItems.length; index += 1) {
		const stepItem = workflowItems[index];
		stepItem.classList.add("active");
		await delay(650);
		stepItem.classList.remove("active");
		stepItem.classList.add("completed");

		if (index === 1) {
			updateStatusChip(alertStatus, "Alert sent to control room");
		}

		if (index === 2) {
			updateStatusChip(buzzerStatus, "Buzzer active");
		}

		if (index === 3) {
			updateStatusChip(gpsStatus, "GPS shared: 28.6139, 77.2090");
		}
	}

	sosButton.classList.remove("pulsing");
	sosButton.disabled = false;
	workflowRunning = false;
}

if (sosButton) {
	sosButton.addEventListener("click", runWorkflow);
}