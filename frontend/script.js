const siteHeader = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navAnchors = document.querySelectorAll(".nav-links a");
const inPageAnchors = document.querySelectorAll('a[href^="#"]');
const pageAnchors = document.querySelectorAll('a[href]:not([href^="#"])');
const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll(".counter");
const hoverCards = document.querySelectorAll(".feature-card, .stat-card, .women-panel");
const interactiveButtons = document.querySelectorAll(".btn");

document.body.classList.add("page-enter");
requestAnimationFrame(() => {
	requestAnimationFrame(() => {
		document.body.classList.add("page-ready");
	});
});

function closeMenu() {
	if (!navLinks || !menuToggle) {
		return;
	}

	navLinks.classList.remove("open");
	menuToggle.classList.remove("open");
	document.body.classList.remove("menu-open");
	menuToggle.setAttribute("aria-expanded", "false");
}

if (menuToggle && navLinks) {
	menuToggle.addEventListener("click", () => {
		const isOpen = navLinks.classList.toggle("open");
		menuToggle.classList.toggle("open", isOpen);
		document.body.classList.toggle("menu-open", isOpen);
		menuToggle.setAttribute("aria-expanded", String(isOpen));
	});

	document.addEventListener("click", (event) => {
		const clickTarget = event.target;
		if (!(clickTarget instanceof Node)) {
			return;
		}

		if (!navLinks.contains(clickTarget) && !menuToggle.contains(clickTarget)) {
			closeMenu();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeMenu();
		}
	});
}

navAnchors.forEach((anchor) => {
	anchor.addEventListener("click", () => {
		closeMenu();
	});
});

function easeInOutCubic(progress) {
	if (progress < 0.5) {
		return 4 * progress * progress * progress;
	}

	return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function smoothScrollTo(targetY, duration = 700) {
	const startY = window.scrollY;
	const distance = targetY - startY;
	const startTime = performance.now();

	function step(now) {
		const elapsed = now - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const easedProgress = easeInOutCubic(progress);
		window.scrollTo(0, startY + distance * easedProgress);

		if (progress < 1) {
			requestAnimationFrame(step);
		}
	}

	requestAnimationFrame(step);
}

inPageAnchors.forEach((anchor) => {
	anchor.addEventListener("click", (event) => {
		const href = anchor.getAttribute("href");
		if (!href || href === "#") {
			return;
		}

		const section = document.querySelector(href);
		if (!section) {
			return;
		}

		event.preventDefault();
		const headerOffset = siteHeader ? siteHeader.offsetHeight : 0;
		const sectionTop = section.getBoundingClientRect().top + window.scrollY;
		smoothScrollTo(sectionTop - headerOffset + 2);
	});
});

pageAnchors.forEach((anchor) => {
	anchor.addEventListener("click", (event) => {
		const href = anchor.getAttribute("href");
		if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
			return;
		}

		if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
			return;
		}

		const targetUrl = new URL(href, window.location.href);
		if (targetUrl.origin !== window.location.origin) {
			return;
		}

		event.preventDefault();
		document.body.classList.add("page-exit");
		setTimeout(() => {
			window.location.href = targetUrl.href;
		}, 280);
	});
});

const revealObserver = new IntersectionObserver(
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

revealItems.forEach((item) => revealObserver.observe(item));

function animateCounter(counterEl) {
	const target = Number(counterEl.dataset.target || "0");
	const prefix = counterEl.dataset.prefix || "";
	const suffix = counterEl.dataset.suffix || "";
	const duration = 1400;
	const startTime = performance.now();

	function update(now) {
		const elapsed = now - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const eased = 1 - Math.pow(1 - progress, 3);
		const currentValue = Math.round(target * eased);
		counterEl.textContent = `${prefix}${currentValue}${suffix}`;

		if (progress < 1) {
			requestAnimationFrame(update);
		}
	}

	requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver(
	(entries, obs) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				animateCounter(entry.target);
				obs.unobserve(entry.target);
			}
		});
	},
	{ threshold: 0.6 }
);

counters.forEach((counterEl) => counterObserver.observe(counterEl));

hoverCards.forEach((card) => {
	card.addEventListener("mousemove", (event) => {
		const rect = card.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const rotateX = ((y / rect.height) - 0.5) * -8;
		const rotateY = ((x / rect.width) - 0.5) * 8;

		card.style.transform = `perspective(700px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
		card.style.transition = "transform 0.12s ease-out";
	});

	card.addEventListener("mouseleave", () => {
		card.style.transform = "";
		card.style.transition = "transform 0.35s ease";
	});
});

interactiveButtons.forEach((button) => {
	button.addEventListener("mousemove", (event) => {
		const rect = button.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		button.style.setProperty("--mx", `${x}px`);
		button.style.setProperty("--my", `${y}px`);
	});
});

window.addEventListener("scroll", () => {
	if (!siteHeader) {
		return;
	}

	if (window.scrollY > 18) {
		siteHeader.classList.add("scrolled");
	} else {
		siteHeader.classList.remove("scrolled");
	}
});
