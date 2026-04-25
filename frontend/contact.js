const revealItems = document.querySelectorAll(".reveal");
const feedbackForm = document.getElementById("feedbackForm");
const formMessage = document.getElementById("formMessage");

const observer = new IntersectionObserver(
	(entries, obs) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add("visible");
				obs.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.15 }
);

revealItems.forEach((item) => observer.observe(item));

if (feedbackForm && formMessage) {
	feedbackForm.addEventListener("submit", (event) => {
		event.preventDefault();
		formMessage.classList.remove("ok");
		formMessage.textContent = "Thank you. Your feedback has been submitted successfully.";
		formMessage.classList.add("ok");
		feedbackForm.reset();
	});
}
