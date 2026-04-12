const REVIEWABLE_TYPES = new Set(["workshop", "competition", "seminar"]);

const societies = [
	{ name: "NUST Music Society", category: "Cultural", password: "nms123", eventIds: [] },
	{ name: "RIC", category: "Fundraiser", password: "ric123", eventIds: [] },
	{ name: "NEC", category: "Technical", password: "nec123", eventIds: [] },
	{ name: "ACM", category: "Technical", password: "acm123", eventIds: [] },
	{ name: "Vyro.ai", category: "Technical", password: "vyro123", eventIds: [] },
	{ name: "IEEE", category: "Technical", password: "ieee123", eventIds: [] },
	{ name: "SOULS", category: "Cultural", password: "souls123", eventIds: [] },
	{ name: "AND", category: "Technical", password: "and123", eventIds: [] }
];

const events = [];
const students = [];

let loggedInStudent = null;
let loggedInOrganizer = null;
let eventCounter = 1;
let toastTimer = null;
let scrollSpyEnabled = true; // flag to pause spy when user clicks a nav link

const resultCount = document.getElementById("resultCount");
const eventsTbody = document.getElementById("eventsTbody");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const societyFilter = document.getElementById("societyFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const statsGrid = document.getElementById("statsGrid");
const featuredEventsGrid = document.getElementById("featuredEventsGrid");
const liveCounter = document.getElementById("liveCounter");
const refreshFeaturedBtn = document.getElementById("refreshFeaturedBtn");
const jumpStudentBtn = document.getElementById("jumpStudentBtn");
const jumpOrganizerBtn = document.getElementById("jumpOrganizerBtn");
const switchOrganizerViewBtn = document.getElementById("switchOrganizerViewBtn");
const sideNavLinks = document.querySelectorAll(".side-nav-link");
const consoleBox = document.getElementById("consoleBox");
const toast = document.getElementById("toast");

const studentRegisterForm = document.getElementById("studentRegisterForm");
const studentLoginForm = document.getElementById("studentLoginForm");
const studentSession = document.getElementById("studentSession");
const studentActions = document.getElementById("studentActions");
const studentEventSelect = document.getElementById("studentEventSelect");
const reviewText = document.getElementById("reviewText");
const reviewRating = document.getElementById("reviewRating");

const organizerLoginForm = document.getElementById("organizerLoginForm");
const organizerSocietySelect = document.getElementById("organizerSocietySelect");
const organizerSession = document.getElementById("organizerSession");
const organizerActions = document.getElementById("organizerActions");
const addEventForm = document.getElementById("addEventForm");
const newEventType = document.getElementById("newEventType");
const newEventRegistrationUrl = document.getElementById("newEventRegistrationUrl");
const newEventExtra1 = document.getElementById("newEventExtra1");
const newEventExtra2 = document.getElementById("newEventExtra2");

function createId() {
	const id = "evt-" + String(eventCounter).padStart(4, "0");
	eventCounter += 1;
	return id;
}

function bySociety(name) {
	return societies.find((s) => s.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function byEvent(id) {
	return events.find((e) => e.id === id) || null;
}

function availableSeats(event) {
	return event.capacity - event.registeredCmsIds.length;
}

function averageRating(event) {
	if (!event.reviews.length) return 0;
	const total = event.reviews.reduce((sum, r) => sum + r.rating, 0);
	return total / event.reviews.length;
}

function normalizeRegistrationUrl(rawUrl) {
	const raw = String(rawUrl || "").trim();
	if (!raw) return "";

	const withProtocol = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
	try {
		return new URL(withProtocol).toString();
	} catch {
		return null;
	}
}

function logLine(message) {
	const stamp = new Date().toLocaleTimeString();
	consoleBox.textContent = "[" + stamp + "] " + message + "\n" + consoleBox.textContent;
}

function toastMsg(message) {
	toast.textContent = message;
	toast.classList.add("show");

	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast.classList.remove("show");
	}, 2000);
}

function updateTypeExtras() {
	const type = newEventType.value;
	if (type === "workshop") {
		newEventExtra1.placeholder = "Duration";
		newEventExtra2.placeholder = "Prerequisite";
	}
	if (type === "concert") {
		newEventExtra1.placeholder = "Performer";
		newEventExtra2.placeholder = "Genre";
	}
	if (type === "competition") {
		newEventExtra1.placeholder = "Prize Pool";
		newEventExtra2.placeholder = "Team Size";
	}
	if (type === "seminar") {
		newEventExtra1.placeholder = "Speaker";
		newEventExtra2.placeholder = "Topic";
	}
}

function seedRealEvents() {
	const initial = [
		{
			title: "NUST Music Fest (NMF)",
			type: "concert",
			society: "NUST Music Society",
			date: "DELAYED - Originally 21-22 Apr 2026",
			venue: "NBS GROUND, NUST H-12",
			capacity: 500,
			description: "NUST annual music festival. Currently delayed.",
			status: "delayed",
			registrationUrl: "",
			details: { performer: "Various Artists", genre: "Live Music / Multi-Genre" }
		},
		{
			title: "HAAMI 2026",
			type: "concert",
			society: "RIC",
			date: "DELAYED - Originally 2-3 Apr 2026",
			venue: "NUST Main Campus",
			capacity: 1000,
			description: "Fundraiser with Hassan Raheem. Postponed.",
			status: "delayed",
			registrationUrl: "",
			details: { performer: "Hassan Raheem", genre: "Pop / R&B" }
		},
		{
			title: "AIcon 2026",
			type: "competition",
			society: "NEC",
			date: "Expected: End of April 2026",
			venue: "SEECS, NUST",
			capacity: 150,
			description: "AI-focused hackathon by NEC, ACM, Hack Club.",
			status: "expected",
			registrationUrl: "",
			details: { prizePool: "TBA", teamSize: 3 }
		},
		{
			title: "VYROTHON 2026",
			type: "competition",
			society: "Vyro.ai",
			date: "18-Apr-2026",
			venue: "Vyro Office, NSTP NUST H-12",
			capacity: 100,
			description: "In-house hackathon with around $5000 prize pool.",
			status: "scheduled",
			registrationUrl: "https://vyrothon.vyro.ai/",
			details: { prizePool: "~$5,000 USD", teamSize: 3 }
		}
	];

	initial.forEach((e) => {
		const id = createId();
		const evt = {
			id,
			...e,
			createdBy: e.society,
			registeredCmsIds: [],
			reviews: []
		};
		events.push(evt);
		const host = bySociety(e.society);
		if (host) {
			host.eventIds.push(id);
		}
	});
}

function filteredEvents() {
	const q = searchInput.value.trim().toLowerCase();
	const t = typeFilter.value;
	const s = societyFilter.value;

	return events.filter((e) => {
		const qOk = !q || e.title.toLowerCase().includes(q) || e.society.toLowerCase().includes(q) || e.type.includes(q);
		const tOk = t === "all" || e.type === t;
		const sOk = s === "all" || e.society === s;
		return qOk && tOk && sOk;
	});
}

function renderFilters() {
	const prev = societyFilter.value;
	const names = [...new Set(events.map((e) => e.society))].sort();
	societyFilter.innerHTML = '<option value="all">All</option>' + names.map((n) => '<option value="' + n + '">' + n + '</option>').join("");
	if (names.includes(prev)) {
		societyFilter.value = prev;
	}
}

function renderEventSelect() {
	const prev = studentEventSelect.value;
	studentEventSelect.innerHTML = events.map((e) => '<option value="' + e.id + '">' + e.title + ' | ' + e.type + '</option>').join("");
	if (events.some((e) => e.id === prev)) {
		studentEventSelect.value = prev;
	}
}

function renderOrganizerSelect() {
	organizerSocietySelect.innerHTML = societies.map((s) => '<option value="' + s.name + '">' + s.name + '</option>').join("");
}

function totalRegistrations() {
	return events.reduce((sum, event) => sum + event.registeredCmsIds.length, 0);
}

function scrollToSection(sectionId) {
	const section = document.getElementById(sectionId);
	if (section) {
		// Pause scroll spy briefly so clicking doesn't flicker the nav
		scrollSpyEnabled = false;
		section.scrollIntoView({ behavior: "smooth", block: "start" });
		setTimeout(() => {
			scrollSpyEnabled = true;
		}, 800);
	}
}

function setActiveSideNav(target) {
	sideNavLinks.forEach((link) => {
		link.classList.toggle("active", link.dataset.target === target);
	});
}

function renderDashboardStats() {
	if (!statsGrid) return;

	const societyCount = new Set(events.map((event) => event.society)).size;
	const stats = [
		{
			label: "Live Events",
			value: String(events.length).padStart(2, "0"),
			note: "Active and upcoming listings",
			tone: "tone-a"
		},
		{
			label: "Societies",
			value: String(societyCount).padStart(2, "0"),
			note: "Hosts represented in the portal",
			tone: "tone-b"
		},
		{
			label: "Students",
			value: String(students.length).padStart(2, "0"),
			note: "Registered student accounts",
			tone: "tone-c"
		},
		{
			label: "Registrations",
			value: String(totalRegistrations()).padStart(2, "0"),
			note: "Seat bookings across events",
			tone: "tone-d"
		}
	];

	statsGrid.innerHTML = stats.map((stat) => {
		return (
			'<article class="stat-card ' + stat.tone + '">' +
				'<p class="stat-label">' + stat.label + '</p>' +
				'<div class="stat-value">' + stat.value + '</div>' +
				'<p class="stat-note">' + stat.note + '</p>' +
			'</article>'
		);
	}).join("");

	if (liveCounter) {
		liveCounter.textContent = events.length + (events.length === 1 ? " event live" : " events live");
	}
}

function featuredScore(event) {
	const statusScore = { scheduled: 3, expected: 2, delayed: 1 }[event.status] || 0;
	const linkScore = event.registrationUrl ? 1 : 0;
	return statusScore * 10 + linkScore;
}

function renderFeaturedEvents() {
	if (!featuredEventsGrid) return;

	const featured = [...events]
		.sort((a, b) => {
			const scoreDelta = featuredScore(b) - featuredScore(a);
			if (scoreDelta !== 0) return scoreDelta;
			const bOrder = Number(String(b.id).split("-")[1] || 0);
			const aOrder = Number(String(a.id).split("-")[1] || 0);
			return bOrder - aOrder;
		})
		.slice(0, 3);

	if (!featured.length) {
		featuredEventsGrid.innerHTML = '<p class="muted">No events available yet.</p>';
		return;
	}

	featuredEventsGrid.innerHTML = featured.map((event, index) => {
		const avg = REVIEWABLE_TYPES.has(event.type) ? averageRating(event).toFixed(2) : "N/A";
		const largeClass = index === 0 ? "event-card-large" : "";
		const linkMarkup = event.registrationUrl
			? '<button type="button" class="open-link" data-link="' + event.registrationUrl + '">Open</button>'
			: '<span class="muted">No registration link</span>';

		return (
			'<article class="event-card ' + largeClass + '">' +
				'<div class="event-card-head">' +
					'<span class="pill">' + event.type + '</span>' +
					'<span class="pill status-' + event.status + '">' + event.status + '</span>' +
				'</div>' +
				'<h3>' + event.title + '</h3>' +
				'<p class="muted">' + event.society + '</p>' +
				'<div class="event-card-meta">' +
					'<div><span>Date</span><strong>' + event.date + '</strong></div>' +
					'<div><span>Venue</span><strong>' + event.venue + '</strong></div>' +
					'<div><span>Seats</span><strong>' + availableSeats(event) + '</strong></div>' +
					'<div><span>Avg Rating</span><strong>' + avg + '</strong></div>' +
				'</div>' +
				'<p class="event-card-copy">' + event.description + '</p>' +
				'<div class="event-card-footer">' + linkMarkup + '</div>' +
			'</article>'
		);
	}).join("");
}

function renderEventsTable() {
	const rows = filteredEvents();
	resultCount.textContent = "Showing " + rows.length + " events";

	if (!rows.length) {
		eventsTbody.innerHTML = '<tr><td colspan="10">No events found.</td></tr>';
		return;
	}

	eventsTbody.innerHTML = rows.map((e, i) => {
		const avg = REVIEWABLE_TYPES.has(e.type) ? averageRating(e).toFixed(2) : "N/A";
		const link = e.registrationUrl ? '<button type="button" class="open-link" data-link="' + e.registrationUrl + '">Open</button>' : "-";
		const canDelete = Boolean(loggedInOrganizer) && e.createdBy === loggedInOrganizer.name;
		const manage = canDelete ? '<button type="button" class="delete-event" data-event-id="' + e.id + '">Delete</button>' : "";
		return (
			"<tr>" +
				"<td>" + (i + 1) + "</td>" +
				"<td>" + e.title + "</td>" +
				"<td>" + e.society + "</td>" +
				"<td><span class=\"pill\">" + e.type + "</span></td>" +
				"<td><span class=\"pill status-" + e.status + "\">" + e.date + "</span></td>" +
				"<td>" + e.venue + "</td>" +
				"<td>" + availableSeats(e) + "</td>" +
				"<td>" + avg + "</td>" +
				"<td>" + link + "</td>" +
				"<td>" + manage + "</td>" +
			"</tr>"
		);
	}).join("");
}

function refreshAll() {
	renderDashboardStats();
	renderFeaturedEvents();
	renderFilters();
	renderEventSelect();
	renderOrganizerSelect();
	renderEventsTable();
}

function switchTab(role) {
	document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === role));
	document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
	document.getElementById("panel-" + role).classList.add("active");
}

function updateStudentUI() {
	if (!loggedInStudent) {
		studentSession.textContent = "Not logged in";
		studentActions.classList.add("hidden");
		return;
	}
	studentSession.textContent = "Logged in: " + loggedInStudent.name + " (" + loggedInStudent.cmsId + ")";
	studentActions.classList.remove("hidden");
}

function updateOrganizerUI() {
	if (!loggedInOrganizer) {
		organizerSession.textContent = "Not logged in";
		organizerActions.classList.add("hidden");
		return;
	}
	organizerSession.textContent = "Logged in: " + loggedInOrganizer.name;
	organizerActions.classList.remove("hidden");
}

function registerStudentAccount(payload) {
	if (students.some((s) => s.cmsId === payload.cmsId)) {
		toastMsg("CMS ID already registered");
		logLine("CMS ID already registered.");
		return;
	}

	students.push({
		name: payload.name,
		cmsId: payload.cmsId,
		email: payload.email,
		password: payload.password,
		section: payload.section,
		registeredEventIds: []
	});

	toastMsg("Student registered");
	logLine("Registration successful! Welcome, " + payload.name + ".");
}

function loginStudent(cmsId, password) {
	const student = students.find((s) => s.cmsId === cmsId && s.password === password) || null;
	if (!student) {
		toastMsg("Invalid student credentials");
		logLine("Invalid CMS ID or password.");
		return;
	}

	loggedInStudent = student;
	updateStudentUI();
	toastMsg("Student login successful");
	logLine("Login successful! Welcome back, " + student.name + ".");
}

function loginOrganizer(societyName, password) {
	const society = societies.find((s) => s.name === societyName && s.password === password) || null;
	if (!society) {
		toastMsg("Invalid organizer credentials");
		logLine("Invalid society name or password.");
		return;
	}

	loggedInOrganizer = society;
	updateOrganizerUI();
	toastMsg("Organizer login successful");
	logLine("Login successful! Welcome, " + society.name + ".");
}

function registerForEvent() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = byEvent(studentEventSelect.value);
	if (!event) {
		toastMsg("Invalid event selection");
		return;
	}
	if (availableSeats(event) <= 0) {
		toastMsg("Event is full");
		logLine("Sorry, " + event.title + " is full.");
		return;
	}
	if (event.registeredCmsIds.includes(loggedInStudent.cmsId)) {
		toastMsg("Already registered");
		logLine(loggedInStudent.name + " is already registered.");
		return;
	}

	event.registeredCmsIds.push(loggedInStudent.cmsId);
	loggedInStudent.registeredEventIds.push(event.id);
	refreshAll();
	toastMsg("Registered");
	logLine(loggedInStudent.name + " successfully registered for " + event.title + ".");
}

function cancelEventRegistration() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = byEvent(studentEventSelect.value);
	if (!event) {
		toastMsg("Invalid event selection");
		return;
	}

	const before = event.registeredCmsIds.length;
	event.registeredCmsIds = event.registeredCmsIds.filter((id) => id !== loggedInStudent.cmsId);
	loggedInStudent.registeredEventIds = loggedInStudent.registeredEventIds.filter((id) => id !== event.id);

	if (before === event.registeredCmsIds.length) {
		toastMsg("Not registered in this event");
		logLine(loggedInStudent.name + " was not registered.");
		return;
	}

	refreshAll();
	toastMsg("Registration cancelled");
	logLine(loggedInStudent.name + " removed from " + event.title + ".");
}

function submitReview() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = byEvent(studentEventSelect.value);
	if (!event) {
		toastMsg("Invalid event selection");
		return;
	}
	if (!REVIEWABLE_TYPES.has(event.type)) {
		toastMsg("This event does not support reviews");
		return;
	}

	const rating = Number(reviewRating.value);
	if (rating < 1 || rating > 5) {
		toastMsg("Rating must be 1-5");
		return;
	}

	const existing = event.reviews.find((r) => r.cmsId === loggedInStudent.cmsId) || null;
	if (existing) {
		existing.feedback = reviewText.value.trim();
		existing.rating = rating;
	} else {
		event.reviews.push({ cmsId: loggedInStudent.cmsId, feedback: reviewText.value.trim(), rating });
	}

	reviewText.value = "";
	reviewRating.value = "5";
	refreshAll();
	toastMsg("Review submitted");
	logLine("Review added for " + event.title + ".");
}

function showEventReviews() {
	const event = byEvent(studentEventSelect.value);
	if (!event) return;
	if (!REVIEWABLE_TYPES.has(event.type)) {
		logLine("This event does not support reviews.");
		return;
	}
	if (!event.reviews.length) {
		logLine("No reviews yet for " + event.title + ".");
		return;
	}

	const lines = event.reviews.map((r, i) => "  " + (i + 1) + ". " + r.feedback + " | Rating: " + r.rating + "/5");
	logLine("Reviews for " + event.title + ":\n" + lines.join("\n"));
}

function showStudentProfile() {
	if (!loggedInStudent) return;
	const lines = [
		"Name: " + loggedInStudent.name,
		"CMS ID: " + loggedInStudent.cmsId,
		"Email: " + loggedInStudent.email,
		"Section: " + loggedInStudent.section,
		"Registered Events: " + loggedInStudent.registeredEventIds.length
	];
	logLine(lines.join("\n"));
}

function showUpcoming() {
	if (!loggedInStudent) return;
	if (!loggedInStudent.registeredEventIds.length) {
		logLine("You have no upcoming events.");
		return;
	}

	const lines = ["Your Upcoming Events:"];
	loggedInStudent.registeredEventIds.forEach((id) => {
		const event = byEvent(id);
		if (event) {
			lines.push("  - " + event.title + " | " + event.date + " | " + event.venue);
		}
	});
	logLine(lines.join("\n"));
}

function showMyEvents() {
	if (!loggedInOrganizer) return;
	const mine = events.filter((e) => e.society === loggedInOrganizer.name);
	if (!mine.length) {
		logLine(loggedInOrganizer.name + " has no events yet.");
		return;
	}
	const lines = ["Events by " + loggedInOrganizer.name + ":"];
	mine.forEach((e, i) => lines.push("  " + (i + 1) + ". " + e.title + " | " + e.date));
	logLine(lines.join("\n"));
}

function showAttendees() {
	if (!loggedInOrganizer) return;
	const mine = events.filter((e) => e.society === loggedInOrganizer.name);
	if (!mine.length) {
		logLine("Your society has no events yet.");
		return;
	}

	const lines = [];
	mine.forEach((event) => {
		lines.push("Attendees for " + event.title + ":");
		if (!event.registeredCmsIds.length) {
			lines.push("  No attendees yet.");
			return;
		}
		event.registeredCmsIds.forEach((cmsId, i) => {
			const student = students.find((s) => s.cmsId === cmsId);
			if (student) {
				lines.push("  " + (i + 1) + ". " + student.name + " (" + student.cmsId + ") | " + student.email);
			}
		});
	});
	logLine(lines.join("\n"));
}

function deleteOrganizerEvent(eventId) {
	if (!loggedInOrganizer) {
		toastMsg("Login as organizer first");
		return;
	}

	const event = byEvent(eventId);
	if (!event) {
		toastMsg("Event not found");
		return;
	}

	if (event.createdBy !== loggedInOrganizer.name) {
		toastMsg("You can only delete your own events");
		return;
	}

	if (!window.confirm('Delete event "' + event.title + '"?')) {
		return;
	}

	const eventIndex = events.findIndex((e) => e.id === eventId);
	if (eventIndex === -1) {
		toastMsg("Event not found");
		return;
	}

	events.splice(eventIndex, 1);
	students.forEach((student) => {
		student.registeredEventIds = student.registeredEventIds.filter((id) => id !== eventId);
	});

	const hostSociety = bySociety(event.society);
	if (hostSociety) {
		hostSociety.eventIds = hostSociety.eventIds.filter((id) => id !== eventId);
	}

	if (loggedInOrganizer) {
		loggedInOrganizer.eventIds = loggedInOrganizer.eventIds.filter((id) => id !== eventId);
	}

	refreshAll();
	toastMsg("Event deleted");
	logLine('Event "' + event.title + '" deleted by ' + loggedInOrganizer.name + '.');
}

function addOrganizerEvent() {
	if (!loggedInOrganizer) {
		toastMsg("Login as organizer first");
		return;
	}

	const type = newEventType.value;
	const title = document.getElementById("newEventTitle").value.trim();
	const date = document.getElementById("newEventDate").value.trim();
	const venue = document.getElementById("newEventVenue").value.trim();
	const capRaw = Number(document.getElementById("newEventCapacity").value.trim());
	const description = document.getElementById("newEventDescription").value.trim();
	const registrationUrl = normalizeRegistrationUrl(newEventRegistrationUrl.value);
	const extra1 = newEventExtra1.value.trim();
	const extra2 = newEventExtra2.value.trim();

	if (registrationUrl === null) {
		toastMsg("Invalid registration URL");
		logLine("Please provide a valid URL or leave it empty.");
		return;
	}

	const details = {};
	if (type === "workshop") {
		details.duration = extra1;
		details.prerequisite = extra2;
	}
	if (type === "concert") {
		details.performer = extra1;
		details.genre = extra2;
	}
	if (type === "competition") {
		details.prizePool = extra1;
		details.teamSize = Number(extra2) || 1;
	}
	if (type === "seminar") {
		details.speaker = extra1;
		details.topic = extra2;
	}

	const event = {
		id: createId(),
		title,
		type,
		society: loggedInOrganizer.name,
		date,
		venue,
		capacity: Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 50,
		description,
		createdBy: loggedInOrganizer.name,
		status: "scheduled",
		registrationUrl,
		details,
		registeredCmsIds: [],
		reviews: []
	};

	events.push(event);
	loggedInOrganizer.eventIds.push(event.id);
	addEventForm.reset();
	updateTypeExtras();
	searchInput.value = "";
	typeFilter.value = "all";
	societyFilter.value = "all";
	refreshAll();
	setActiveSideNav("events");
	scrollToSection("events");
	toastMsg("Event added");
	logLine('Event "' + event.title + '" added successfully!');
}

// ─── Scroll Spy ───────────────────────────────────────────────────────────────
function initScrollSpy() {
	// Map each section ID to its matching sidebar nav target
	const sectionTargetMap = {
		"overview": "overview",
		"statsGrid": "overview",   // stats are part of overview visually
		"events": "events",
		"roles": "roles",
		"console": "roles"         // console is merged under Portal Roles & Console
	};

	const sectionIds = Object.keys(sectionTargetMap);
	const sections = sectionIds
		.map((id) => document.getElementById(id))
		.filter(Boolean);

	// Track which sections are currently visible
	const visibleSections = new Set();

	const observer = new IntersectionObserver(
		(entries) => {
			if (!scrollSpyEnabled) return;

			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					visibleSections.add(entry.target.id);
				} else {
					visibleSections.delete(entry.target.id);
				}
			});

			// Pick the topmost visible section in document order
			for (const id of sectionIds) {
				if (visibleSections.has(id)) {
					const navTarget = sectionTargetMap[id];
					setActiveSideNav(navTarget);
					break;
				}
			}
		},
		{
			root: null,
			// Section is "active" when it crosses into the top 60% of the viewport
			rootMargin: "0px 0px -40% 0px",
			threshold: 0
		}
	);

	sections.forEach((section) => observer.observe(section));
}

// ─── Event Bindings ───────────────────────────────────────────────────────────
function bind() {
	searchInput.addEventListener("input", renderEventsTable);
	typeFilter.addEventListener("change", renderEventsTable);
	societyFilter.addEventListener("change", renderEventsTable);

	resetFiltersBtn.addEventListener("click", () => {
		searchInput.value = "";
		typeFilter.value = "all";
		societyFilter.value = "all";
		renderEventsTable();
	});

	if (refreshFeaturedBtn) {
		refreshFeaturedBtn.addEventListener("click", () => {
			setActiveSideNav("events");
			scrollToSection("events");
		});
	}

	if (jumpStudentBtn) {
		jumpStudentBtn.addEventListener("click", () => {
			switchTab("student");
			setActiveSideNav("roles");
			scrollToSection("roles");
		});
	}

	if (jumpOrganizerBtn) {
		jumpOrganizerBtn.addEventListener("click", () => {
			switchTab("organizer");
			setActiveSideNav("roles");
			scrollToSection("roles");
		});
	}

	if (switchOrganizerViewBtn) {
		switchOrganizerViewBtn.addEventListener("click", () => {
			switchTab("organizer");
			setActiveSideNav("roles");
			scrollToSection("roles");
		});
	}

	sideNavLinks.forEach((link) => {
		link.addEventListener("click", () => {
			const target = link.dataset.target;
			setActiveSideNav(target);
			scrollToSection(target);
		});
	});

	document.querySelectorAll(".tab").forEach((tab) => {
		tab.addEventListener("click", () => switchTab(tab.dataset.tab));
	});

	eventsTbody.addEventListener("click", (event) => {
		const deleteButton = event.target.closest(".delete-event");
		if (deleteButton) {
			deleteOrganizerEvent(deleteButton.dataset.eventId);
			return;
		}

		const openButton = event.target.closest(".open-link");
		if (!openButton) return;
		window.open(openButton.dataset.link, "_blank", "noopener");
	});

	if (featuredEventsGrid) {
		featuredEventsGrid.addEventListener("click", (event) => {
			const button = event.target.closest(".open-link");
			if (!button) return;
			window.open(button.dataset.link, "_blank", "noopener");
		});
	}

	studentRegisterForm.addEventListener("submit", (event) => {
		event.preventDefault();
		const fd = new FormData(studentRegisterForm);
		registerStudentAccount({
			name: String(fd.get("name") || "").trim(),
			cmsId: String(fd.get("cmsId") || "").trim(),
			email: String(fd.get("email") || "").trim(),
			password: String(fd.get("password") || "").trim(),
			section: String(fd.get("section") || "").trim()
		});
		studentRegisterForm.reset();
	});

	studentLoginForm.addEventListener("submit", (event) => {
		event.preventDefault();
		const fd = new FormData(studentLoginForm);
		loginStudent(String(fd.get("cmsId") || "").trim(), String(fd.get("password") || "").trim());
		studentLoginForm.reset();
	});

	document.getElementById("registerEventBtn").addEventListener("click", registerForEvent);
	document.getElementById("cancelEventBtn").addEventListener("click", cancelEventRegistration);
	document.getElementById("submitReviewBtn").addEventListener("click", submitReview);
	document.getElementById("showReviewsBtn").addEventListener("click", showEventReviews);
	document.getElementById("profileBtn").addEventListener("click", showStudentProfile);
	document.getElementById("upcomingBtn").addEventListener("click", showUpcoming);
	document.getElementById("studentLogoutBtn").addEventListener("click", () => {
		loggedInStudent = null;
		updateStudentUI();
		toastMsg("Logged out");
	});

	organizerLoginForm.addEventListener("submit", (event) => {
		event.preventDefault();
		const fd = new FormData(organizerLoginForm);
		loginOrganizer(organizerSocietySelect.value, String(fd.get("password") || "").trim());
		organizerLoginForm.reset();
	});

	document.getElementById("myEventsBtn").addEventListener("click", showMyEvents);
	document.getElementById("attendeesBtn").addEventListener("click", showAttendees);
	document.getElementById("organizerLogoutBtn").addEventListener("click", () => {
		loggedInOrganizer = null;
		updateOrganizerUI();
		toastMsg("Logged out");
	});

	newEventType.addEventListener("change", updateTypeExtras);
	addEventForm.addEventListener("submit", (event) => {
		event.preventDefault();
		addOrganizerEvent();
	});
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
	seedRealEvents();
	bind();
	updateTypeExtras();
	switchTab("guest");
	setActiveSideNav("overview");
	updateStudentUI();
	updateOrganizerUI();
	refreshAll();
	initScrollSpy();
	logLine("Portal initialized with 4 real upcoming events.");
}

init();