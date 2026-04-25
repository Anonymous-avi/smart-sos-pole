const revealItems = document.querySelectorAll(".reveal");
const feedClock = document.getElementById("feedClock");
const syncText = document.getElementById("syncText");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const feedElement = document.querySelector(".cctv-feed");

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

function updateClock() {
	if (!feedClock) {
		return;
	}

	feedClock.textContent = new Date().toLocaleTimeString();
}

function updateSyncText() {
	if (!syncText) {
		return;
	}

	syncText.textContent = "Last synced few seconds ago";
}

async function toggleFullscreen() {
	if (!feedElement) {
		return;
	}

	if (!document.fullscreenElement) {
		await feedElement.requestFullscreen();
		return;
	}

	await document.exitFullscreen();
}

if (fullscreenBtn) {
	fullscreenBtn.addEventListener("click", () => {
		toggleFullscreen().catch(() => {
			// Ignore fullscreen errors from unsupported contexts.
		});
	});
}

updateClock();
updateSyncText();
setInterval(updateClock, 1000);
setInterval(updateSyncText, 5000);
