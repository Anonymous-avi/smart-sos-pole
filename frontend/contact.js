const revealItems = document.querySelectorAll(".reveal");
const feedbackForm = document.getElementById("feedbackForm");
const formMessage = document.getElementById("formMessage");
const feedbackPopup = document.getElementById("feedbackPopup");
const feedbackApiUrl = "http://localhost:5000/api/feedback";

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

function showFeedbackPopup(message, type = "success") {
	if (!feedbackPopup) {
		return;
	}

	feedbackPopup.classList.remove("error", "show");
	feedbackPopup.querySelector("span").textContent = message;

	if (type === "error") {
		feedbackPopup.classList.add("error");
	}

	feedbackPopup.classList.add("show");
	feedbackPopup.setAttribute("aria-hidden", "false");

	window.setTimeout(() => {
		feedbackPopup.classList.remove("show");
		feedbackPopup.setAttribute("aria-hidden", "true");
	}, 2600);
}

if (feedbackForm && formMessage) {
	feedbackForm.addEventListener("submit", async (event) => {
		event.preventDefault();

		const submitButton = feedbackForm.querySelector("button[type='submit']");
		const originalButtonText = submitButton ? submitButton.textContent : "Send Feedback";
		const formData = new FormData(feedbackForm);
		const payload = {
			name: String(formData.get("name") || "").trim(),
			email: String(formData.get("email") || "").trim(),
			message: String(formData.get("message") || "").trim(),
		};

		if (!payload.name || !payload.email || !payload.message) {
			formMessage.classList.remove("ok");
			formMessage.textContent = "Please complete all fields before submitting.";
			showFeedbackPopup("Failed to send feedback. Please try again.", "error");
			return;
		}

		if (submitButton) {
			submitButton.disabled = true;
			submitButton.textContent = "Sending...";
		}

		formMessage.classList.remove("ok");

		try {
			const response = await fetch(feedbackApiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				throw new Error(data.message || "Request failed");
			}

			formMessage.textContent = "Thank you! Your feedback has been sent successfully.";
			formMessage.classList.add("ok");
			showFeedbackPopup("Thank you! Your feedback has been sent successfully.");
			feedbackForm.reset();
		} catch (_error) {
			formMessage.classList.remove("ok");
			formMessage.textContent = "Failed to send feedback. Please try again.";
			showFeedbackPopup("Failed to send feedback. Please try again.", "error");
		} finally {
			if (submitButton) {
				submitButton.disabled = false;
				submitButton.textContent = originalButtonText;
			}
		}
	});
}
