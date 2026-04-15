import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xargsubmycnxehyiypxy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcmdzdWJteWNueGVoeWl5cHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTc5OTMsImV4cCI6MjA5MTgzMzk5M30.tz5ql4lNz8x8LMmY4BLyGj_zo51YHoP6ryNdJW_Vb3Y";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REVIEWABLE_TYPES = new Set(["workshop", "competition", "seminar"]);

// ─── State ─────────────────────────────────────────────────────────────────────
let societies = [];
let events = [];
let students = [];
let loggedInStudent = null;
let loggedInOrganizer = null;
let toastTimer = null;
let scrollSpyEnabled = true;

// ─── DOM refs ──────────────────────────────────────────────────────────────────
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
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");
const sidebarDrawer = document.getElementById("sidebarDrawer");
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

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isMobileDrawerActive() {
	return window.matchMedia("(max-width: 900px)").matches;
}

function setMobileMenuState(isOpen) {
	if (!mobileMenuBtn || !mobileMenuBackdrop || !sidebarDrawer) return;
	const open = Boolean(isOpen) && isMobileDrawerActive();
	const sidebarFirstLink = sidebarDrawer.querySelector(".side-nav-link");
	document.body.classList.toggle("mobile-menu-open", open);
	mobileMenuBtn.classList.toggle("is-open", open);
	mobileMenuBtn.setAttribute("aria-expanded", String(open));
	mobileMenuBackdrop.classList.toggle("show", open);
	sidebarDrawer.classList.toggle("is-open", open);
	if (open && sidebarFirstLink) sidebarFirstLink.focus();
	if (!open) mobileMenuBtn.focus();
}

function closeMobileMenu() {
	setMobileMenuState(false);
}

function toggleMobileMenu() {
	const currentlyOpen = document.body.classList.contains("mobile-menu-open");
	setMobileMenuState(!currentlyOpen);
}

function findSocietyById(id) {
	return societies.find((s) => s.id === id) || null;
}

function findEventById(id) {
	return events.find((e) => e.id === id) || null;
}

function availableSeats(event) {
	return event.seats - (event._registrationCount || 0);
}

function averageRating(event) {
	if (!event._reviews || !event._reviews.length) return 0;
	const total = event._reviews.reduce((sum, r) => sum + r.rating, 0);
	return total / event._reviews.length;
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

function formatDate(dateStr) {
	if (!dateStr) return "TBA";
	const d = new Date(dateStr);
	if (isNaN(d)) return dateStr;
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return d.getDate() + "-" + months[d.getMonth()] + "-" + d.getFullYear();
}

function normalizeEventTitle(title) {
	return String(title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getPinnedEventOverride(title) {
	const key = normalizeEventTitle(title);

	if (key === "nmf" || key.includes("nustmusicfest")) {
		return {
			date: "Delayed - Originally 21-23 April 2026",
			status: "Delayed",
			venue: "NBS GROUND",
			descriptionSuffix: "Currently delayed."
		};
	}

	if (key.includes("haami")) {
		return {
			date: "Delayed - Originally 2-3 April 2026",
			status: "Delayed",
			venue: "H12 Campus",
			descriptionSuffix: "Currently delayed."
		};
	}

	if (key.includes("aicon") || key.includes("alcon")) {
		return {
			date: "Expected: End of April 2026",
			status: "Expected",
			venue: "SEECS"
		};
	}

	if (key.includes("vyrothon") || key === "vyro") {
		return {
			date: "18 April 2026",
			status: "Scheduled",
			venue: "NSTP",
			registration_link: "",
			_registrationClosed: true,
			descriptionSuffix: "Registrations are closed for now."
		};
	}

	return null;
}

function applyPinnedEventOverrides(event) {
	const override = getPinnedEventOverride(event?.title);
	if (!override) return event;

	const { descriptionSuffix, ...fields } = override;
	const updated = { ...event, ...fields };

	if (descriptionSuffix) {
		const current = String(updated.description || "");
		if (!current.toLowerCase().includes(descriptionSuffix.toLowerCase())) {
			updated.description = current ? current + " " + descriptionSuffix : descriptionSuffix;
		}
	}

	return updated;
}

// ─── Supabase Data Loading ─────────────────────────────────────────────────────
async function loadSocieties() {
	const { data, error } = await supabase.from("societies").select().order("name");
	if (error) {
		logLine("Error loading societies: " + error.message);
		return;
	}
	societies = data || [];
}

async function loadEvents() {
	const { data, error } = await supabase
		.from("events")
		.select(`
			*,
			societies (
				name,
				short_name
			)
		`)
		.order("date", { ascending: true });

	if (error) {
		logLine("Error loading events: " + error.message);
		return;
	}

	events = (data || []).map((e) => ({
		...e,
		society: e.societies?.name || "Unknown",
		societyShortName: e.societies?.short_name || "",
	})).map((evt) => applyPinnedEventOverrides(evt));

	// Load registration counts and reviews for each event
	await Promise.all(events.map(async (evt) => {
		const { count } = await supabase
			.from("registrations")
			.select("*", { count: "exact", head: true })
			.eq("event_id", evt.id)
			.eq("status", "active");
		evt._registrationCount = count || 0;

		const { data: reviews } = await supabase
			.from("reviews")
			.select()
			.eq("event_id", evt.id);
		evt._reviews = reviews || [];
	}));
}

async function refreshAllData() {
	await Promise.all([loadSocieties(), loadEvents()]);
	refreshAll();
}

// ─── Rendering ─────────────────────────────────────────────────────────────────
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
	return events.reduce((sum, event) => sum + (event._registrationCount || 0), 0);
}

function scrollToSection(sectionId) {
	const section = document.getElementById(sectionId);
	if (section) {
		scrollSpyEnabled = false;
		section.scrollIntoView({ behavior: "smooth", block: "start" });
		setTimeout(() => { scrollSpyEnabled = true; }, 800);
	}
}

function setActiveSideNav(target) {
	sideNavLinks.forEach((link) => {
		link.classList.toggle("active", link.dataset.target === target);
	});
}

function renderDashboardStats() {
	if (!statsGrid) return;

	const liveEvents = events.length;
	const societyCount = new Set(events.map((event) => event.society)).size;
	const registrations = totalRegistrations();
	const totalCapacity = events.reduce((sum, event) => sum + Number(event.seats || 0), 0);
	const registrationFill = totalCapacity > 0 ? Math.min(100, Math.round((registrations / totalCapacity) * 100)) : 0;

	const societyEventCount = {};
	events.forEach((event) => {
		societyEventCount[event.society] = (societyEventCount[event.society] || 0) + 1;
	});

	const sparkValues = Object.values(societyEventCount).sort((a, b) => b - a).slice(0, 7);
	const normalizedSparkValues = sparkValues.length ? sparkValues : [0, 0, 0, 0, 0, 0, 0];
	const maxSparkValue = Math.max(...normalizedSparkValues, 1);
	const sparklineMarkup = normalizedSparkValues.map((value) => {
		const height = value === 0 ? 18 : Math.max(24, Math.round((value / maxSparkValue) * 100));
		return '<span class="sparkline-bar" style="height:' + height + '%"></span>';
	}).join("");

	statsGrid.innerHTML =
		'<article class="mini-widget tone-live">' +
			'<div class="widget-head">' +
				'<p class="widget-label">Live Events</p>' +
				'<span class="live-pill"><span class="live-dot"></span>Live</span>' +
			'</div>' +
			'<div class="widget-value">' + String(liveEvents).padStart(2, "0") + '</div>' +
			'<p class="widget-note">Active and upcoming listings</p>' +
		'</article>' +
		'<article class="mini-widget">' +
			'<div class="widget-head">' +
				'<p class="widget-label">Registrations</p>' +
				'<span class="widget-note">' + registrationFill + '%</span>' +
			'</div>' +
			'<div class="widget-value">' + String(registrations).padStart(2, "0") + '</div>' +
			'<div class="widget-progress"><div class="widget-progress-fill" style="width:' + registrationFill + '%"></div></div>' +
			'<p class="widget-note">' + registrations + ' out of ' + totalCapacity + ' available seats</p>' +
		'</article>' +
		'<article class="mini-widget">' +
			'<div class="widget-head">' +
				'<p class="widget-label">Active Societies</p>' +
				'<span class="widget-note">Trend</span>' +
			'</div>' +
			'<div class="widget-value">' + String(societyCount).padStart(2, "0") + '</div>' +
			'<div class="sparkline">' + sparklineMarkup + '</div>' +
			'<p class="widget-note">Based on event volume by society</p>' +
		'</article>' +
		'<article class="mini-widget">' +
			'<div class="widget-head">' +
				'<p class="widget-label">Student Accounts</p>' +
				'<span class="widget-note">Directory</span>' +
			'</div>' +
			'<div class="widget-value">' + String(students.length).padStart(2, "0") + '</div>' +
			'<p class="widget-note">Registered users who can enroll and review</p>' +
		'</article>';

	if (liveCounter) {
		liveCounter.textContent = events.length + (events.length === 1 ? " event live" : " events live");
	}
}

function featuredScore(event) {
	const statusScore = { scheduled: 3, expected: 2, delayed: 1 }[event.status?.toLowerCase()] || 0;
	const linkScore = event.registration_link ? 1 : 0;
	return statusScore * 10 + linkScore;
}

function renderFeaturedEvents() {
	if (!featuredEventsGrid) return;

	const featured = [...events]
		.sort((a, b) => {
			const scoreDelta = featuredScore(b) - featuredScore(a);
			if (scoreDelta !== 0) return scoreDelta;
			return new Date(b.date) - new Date(a.date);
		})
		.slice(0, 3);

	if (!featured.length) {
		featuredEventsGrid.innerHTML = '<p class="muted">No events available yet.</p>';
		return;
	}

	featuredEventsGrid.innerHTML = featured.map((event, index) => {
		const avg = REVIEWABLE_TYPES.has(event.type) ? averageRating(event).toFixed(1) : "N/A";
		const largeClass = index === 0 ? "event-card-large" : "";
		const linkMarkup = event.registration_link
			? '<button type="button" class="open-link" data-link="' + event.registration_link + '">Open</button>'
			: '<span class="muted">No registration link</span>';

		return (
			'<article class="event-card ' + largeClass + '">' +
				'<div class="event-card-head">' +
					'<span class="pill">' + event.type + '</span>' +
					'<span class="pill status-' + (event.status || "").toLowerCase() + '">' + event.status + '</span>' +
				'</div>' +
				'<h3>' + event.title + '</h3>' +
				'<p class="muted">' + event.society + '</p>' +
				'<div class="event-card-meta">' +
					'<div><span>Date</span><strong>' + formatDate(event.date) + '</strong></div>' +
					'<div><span>Venue</span><strong>' + event.venue + '</strong></div>' +
					'<div><span>Seats</span><strong>' + availableSeats(event) + '</strong></div>' +
					'<div><span>Avg Rating</span><strong>' + avg + '</strong></div>' +
				'</div>' +
				'<p class="event-card-copy">' + (event.description || "") + '</p>' +
				'<div class="event-card-footer">' + linkMarkup + '</div>' +
			'</article>'
		);
	}).join("");
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

function renderEventsTable() {
	const rows = filteredEvents();
	resultCount.textContent = "Showing " + rows.length + " events";

	if (!rows.length) {
		eventsTbody.innerHTML = '<tr><td colspan="10">No events found.</td></tr>';
		return;
	}

	eventsTbody.innerHTML = rows.map((e, i) => {
		const avg = REVIEWABLE_TYPES.has(e.type) ? averageRating(e).toFixed(1) : "N/A";
		const link = e.registration_link ? '<button type="button" class="open-link" data-link="' + e.registration_link + '">Open</button>' : "-";
		const canDelete = Boolean(loggedInOrganizer) && e.society_id === loggedInOrganizer.id;
		const manage = canDelete ? '<button type="button" class="delete-event" data-event-id="' + e.id + '">Delete</button>' : "-";
		return (
			"<tr>" +
				"<td data-label=\"#\">" + (i + 1) + "</td>" +
				"<td data-label=\"Title\">" + e.title + "</td>" +
				"<td data-label=\"Society\">" + e.society + "</td>" +
				"<td data-label=\"Type\"><span class=\"pill\">" + e.type + "</span></td>" +
				"<td data-label=\"Date\"><span class=\"pill status-" + (e.status || "").toLowerCase() + "\">" + formatDate(e.date) + "</span></td>" +
				"<td data-label=\"Venue\">" + e.venue + "</td>" +
				"<td data-label=\"Seats\">" + availableSeats(e) + "</td>" +
				"<td data-label=\"Avg Rating\">" + avg + "</td>" +
				"<td data-label=\"Link\">" + link + "</td>" +
				"<td data-label=\"Manage\">" + manage + "</td>" +
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
	studentSession.textContent = "Logged in: " + loggedInStudent.name + " (" + loggedInStudent.cms_id + ")";
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

// ─── Auth Operations ───────────────────────────────────────────────────────────
async function registerStudentAccount(payload) {
	const { data, error } = await supabase
		.from("students")
		.insert({
			name: payload.name,
			cms_id: payload.cmsId,
			email: payload.email,
			password_hash: payload.password,
			section: payload.section,
		})
		.select()
		.single();

	if (error) {
		if (error.code === "23505") {
			toastMsg("CMS ID or email already exists");
			logLine("CMS ID or email already registered.");
			return;
		}
		toastMsg("Registration failed");
		logLine("Registration error: " + error.message);
		return;
	}

	students.push(data);
	toastMsg("Student registered");
	logLine("Registration successful! Welcome, " + payload.name + ".");
}

async function loginStudent(cmsId, password) {
	const { data, error } = await supabase
		.from("students")
		.select()
		.eq("cms_id", cmsId)
		.eq("password_hash", password)
		.single();

	if (error || !data) {
		toastMsg("Invalid student credentials");
		logLine("Invalid CMS ID or password.");
		return;
	}

	loggedInStudent = data;
	updateStudentUI();
	toastMsg("Student login successful");
	logLine("Login successful! Welcome back, " + data.name + ".");
}

async function loginOrganizer(societyName, password) {
	const { data, error } = await supabase
		.from("societies")
		.select()
		.eq("name", societyName)
		.eq("password_hash", password)
		.single();

	if (error || !data) {
		toastMsg("Invalid organizer credentials");
		logLine("Invalid society name or password.");
		return;
	}

	loggedInOrganizer = data;
	updateOrganizerUI();
	toastMsg("Organizer login successful");
	logLine("Login successful! Welcome, " + data.name + ".");
}

// ─── Event Registration ────────────────────────────────────────────────────────
async function registerForEvent() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = findEventById(studentEventSelect.value);
	if (!event) {
		toastMsg("Invalid event selection");
		return;
	}
	if (event._registrationClosed) {
		toastMsg("Registration is closed");
		logLine("Registrations for " + event.title + " are closed for now.");
		return;
	}
	if (availableSeats(event) <= 0) {
		toastMsg("Event is full");
		logLine("Sorry, " + event.title + " is full.");
		return;
	}

	const { data: existing } = await supabase
		.from("registrations")
		.select()
		.eq("event_id", event.id)
		.eq("student_id", loggedInStudent.id)
		.eq("status", "active")
		.single();

	if (existing) {
		toastMsg("Already registered");
		logLine(loggedInStudent.name + " is already registered.");
		return;
	}

	const { error } = await supabase
		.from("registrations")
		.insert({ event_id: event.id, student_id: loggedInStudent.id, status: "active" });

	if (error) {
		toastMsg("Registration failed");
		logLine("Registration error: " + error.message);
		return;
	}

	event._registrationCount = (event._registrationCount || 0) + 1;
	refreshAll();
	toastMsg("Registered");
	logLine(loggedInStudent.name + " successfully registered for " + event.title + ".");
}

async function cancelEventRegistration() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = findEventById(studentEventSelect.value);
	if (!event) {
		toastMsg("Invalid event selection");
		return;
	}

	const { error } = await supabase
		.from("registrations")
		.update({ status: "cancelled" })
		.eq("event_id", event.id)
		.eq("student_id", loggedInStudent.id)
		.eq("status", "active");

	if (error) {
		toastMsg("Cancellation failed");
		logLine("Cancellation error: " + error.message);
		return;
	}

	event._registrationCount = Math.max(0, (event._registrationCount || 0) - 1);
	refreshAll();
	toastMsg("Registration cancelled");
	logLine(loggedInStudent.name + " removed from " + event.title + ".");
}

// ─── Reviews ───────────────────────────────────────────────────────────────────
async function submitReview() {
	if (!loggedInStudent) {
		toastMsg("Login as student first");
		return;
	}
	const event = findEventById(studentEventSelect.value);
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

	const { data, error } = await supabase
		.from("reviews")
		.upsert({
			event_id: event.id,
			student_id: loggedInStudent.id,
			rating,
			feedback: reviewText.value.trim(),
		}, { onConflict: "event_id,student_id" })
		.select()
		.single();

	if (error) {
		toastMsg("Review submission failed");
		logLine("Review error: " + error.message);
		return;
	}

	// Update local cache
	const existingIdx = (event._reviews || []).findIndex((r) => r.student_id === loggedInStudent.id);
	if (existingIdx >= 0) {
		event._reviews[existingIdx] = data;
	} else {
		if (!event._reviews) event._reviews = [];
		event._reviews.push(data);
	}

	reviewText.value = "";
	reviewRating.value = "5";
	refreshAll();
	toastMsg("Review submitted");
	logLine("Review added for " + event.title + ".");
}

function showEventReviews() {
	const event = findEventById(studentEventSelect.value);
	if (!event) return;
	if (!REVIEWABLE_TYPES.has(event.type)) {
		logLine("This event does not support reviews.");
		return;
	}
	if (!event._reviews || !event._reviews.length) {
		logLine("No reviews yet for " + event.title + ".");
		return;
	}

	const lines = event._reviews.map((r, i) => "  " + (i + 1) + ". " + (r.feedback || "No feedback") + " | Rating: " + r.rating + "/5");
	logLine("Reviews for " + event.title + ":\n" + lines.join("\n"));
}

async function showStudentProfile() {
	if (!loggedInStudent) return;

	const { count } = await supabase
		.from("registrations")
		.select("*", { count: "exact", head: true })
		.eq("student_id", loggedInStudent.id)
		.eq("status", "active");

	const lines = [
		"Name: " + loggedInStudent.name,
		"CMS ID: " + loggedInStudent.cms_id,
		"Email: " + loggedInStudent.email,
		"Section: " + loggedInStudent.section,
		"Registered Events: " + (count || 0)
	];
	logLine(lines.join("\n"));
}

async function showUpcoming() {
	if (!loggedInStudent) return;

	const { data, error } = await supabase
		.from("registrations")
		.select(`
			*,
			events (
				id, title, type, date, venue, status
			)
		`)
		.eq("student_id", loggedInStudent.id)
		.eq("status", "active");

	if (error || !data || !data.length) {
		logLine("You have no upcoming events.");
		return;
	}

	const lines = ["Your Upcoming Events:"];
	data.forEach((r) => {
		if (!r.events) return;
		const evt = applyPinnedEventOverrides(r.events);
		if (evt) {
			lines.push("  - " + evt.title + " | " + formatDate(evt.date) + " | " + evt.venue);
		}
	});
	logLine(lines.join("\n"));
}

// ─── Organizer Operations ──────────────────────────────────────────────────────
async function showMyEvents() {
	if (!loggedInOrganizer) return;

	const { data, error } = await supabase
		.from("events")
		.select()
		.eq("society_id", loggedInOrganizer.id)
		.order("date", { ascending: true });

	if (error) {
		logLine("Error loading events: " + error.message);
		return;
	}

	if (!data || !data.length) {
		logLine(loggedInOrganizer.name + " has no events yet.");
		return;
	}

	const lines = ["Events by " + loggedInOrganizer.name + ":"];
	data.forEach((raw, i) => {
		const e = applyPinnedEventOverrides(raw);
		lines.push("  " + (i + 1) + ". " + e.title + " | " + formatDate(e.date));
	});
	logLine(lines.join("\n"));
}

async function showAttendees() {
	if (!loggedInOrganizer) return;

	const { data: myEvents, error: e1 } = await supabase
		.from("events")
		.select()
		.eq("society_id", loggedInOrganizer.id);

	if (e1 || !myEvents || !myEvents.length) {
		logLine("Your society has no events yet.");
		return;
	}

	const lines = [];
	for (const event of myEvents) {
		const { data: regs, error: e2 } = await supabase
			.from("registrations")
			.select(`
				*,
				students (
					id, name, cms_id, email, section
				)
			`)
			.eq("event_id", event.id)
			.eq("status", "active")
			.order("registered_at", { ascending: false });

		lines.push("Attendees for " + event.title + ":");
		if (e2 || !regs || !regs.length) {
			lines.push("  No attendees yet.");
			continue;
		}
		regs.forEach((r, i) => {
			const s = r.students;
			if (s) {
				lines.push("  " + (i + 1) + ". " + s.name + " (" + s.cms_id + ") | " + s.email);
			}
		});
	}
	logLine(lines.join("\n"));
}

async function deleteOrganizerEvent(eventId) {
	if (!loggedInOrganizer) {
		toastMsg("Login as organizer first");
		return;
	}

	const event = findEventById(eventId);
	if (!event) {
		toastMsg("Event not found");
		return;
	}

	if (event.society_id !== loggedInOrganizer.id) {
		toastMsg("You can only delete your own events");
		return;
	}

	if (!window.confirm('Delete event "' + event.title + '"?')) {
		return;
	}

	const { error } = await supabase.from("events").delete().eq("id", eventId);
	if (error) {
		toastMsg("Delete failed");
		logLine("Delete error: " + error.message);
		return;
	}

	events = events.filter((e) => e.id !== eventId);
	refreshAll();
	toastMsg("Event deleted");
	logLine('Event "' + event.title + '" deleted by ' + loggedInOrganizer.name + '.');
}

async function addOrganizerEvent() {
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

	const payload = {
		title,
		society_id: loggedInOrganizer.id,
		type,
		date,
		venue,
		seats: Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 50,
		description,
		status: "Scheduled",
		registration_link: registrationUrl || null,
	};

	if (type === "workshop") {
		payload.duration = extra1;
		payload.prerequisite = extra2;
	}
	if (type === "concert") {
		payload.performer = extra1;
		payload.genre = extra2;
	}
	if (type === "competition") {
		payload.prize_pool = extra1;
		payload.team_size = Number(extra2) || 1;
	}
	if (type === "seminar") {
		payload.speaker = extra1;
		payload.topic = extra2;
	}

	const { data, error } = await supabase.from("events").insert(payload).select().single();

	if (error) {
		toastMsg("Event creation failed");
		logLine("Event creation error: " + error.message);
		return;
	}

	const society = findSocietyById(loggedInOrganizer.id);
	events.push({
		...data,
		society: society?.name || "Unknown",
		societyShortName: society?.short_name || "",
		_registrationCount: 0,
		_reviews: [],
	});

	addEventForm.reset();
	updateTypeExtras();
	searchInput.value = "";
	typeFilter.value = "all";
	societyFilter.value = "all";
	refreshAll();
	setActiveSideNav("events");
	scrollToSection("events");
	toastMsg("Event added");
	logLine('Event "' + title + '" added successfully!');
}

// ─── Scroll Spy ────────────────────────────────────────────────────────────────
function initScrollSpy() {
	const sectionTargetMap = {
		overview: "overview",
		statsGrid: "overview",
		events: "events",
		roles: "roles",
		console: "roles"
	};

	const sectionIds = Object.keys(sectionTargetMap);

	function updateActiveNavFromScroll() {
		if (!scrollSpyEnabled) return;

		const activationLine = 180;
		let activeId = "overview";

		for (const id of sectionIds) {
			const section = document.getElementById(id);
			if (!section) continue;
			if (section.getBoundingClientRect().top <= activationLine) {
				activeId = id;
			}
		}

		setActiveSideNav(sectionTargetMap[activeId]);
	}

	window.addEventListener("scroll", updateActiveNavFromScroll, { passive: true });
	window.addEventListener("resize", updateActiveNavFromScroll);
	updateActiveNavFromScroll();
}

// ─── Event Bindings ────────────────────────────────────────────────────────────
function bind() {
	searchInput.addEventListener("input", renderEventsTable);
	typeFilter.addEventListener("change", renderEventsTable);
	societyFilter.addEventListener("change", renderEventsTable);

	document.addEventListener("keydown", (event) => {
		if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
			event.preventDefault();
			searchInput.focus();
			searchInput.select();
		}
		if (event.key === "Escape") {
			closeMobileMenu();
		}
	});

	if (mobileMenuBtn) {
		mobileMenuBtn.addEventListener("click", toggleMobileMenu);
	}
	if (mobileMenuBackdrop) {
		mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
	}
	window.addEventListener("resize", () => {
		if (!isMobileDrawerActive()) closeMobileMenu();
	});

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
			const enableOrganizerMode = switchOrganizerViewBtn.getAttribute("aria-pressed") !== "true";
			switchOrganizerViewBtn.setAttribute("aria-pressed", String(enableOrganizerMode));
			switchOrganizerViewBtn.classList.toggle("is-organizer", enableOrganizerMode);
			const toggleText = switchOrganizerViewBtn.querySelector(".toggle-text");
			if (toggleText) {
				toggleText.textContent = enableOrganizerMode ? "Organizer Mode" : "Guest Mode";
			}
			switchTab(enableOrganizerMode ? "organizer" : "guest");
			setActiveSideNav("roles");
			scrollToSection("roles");
		});
	}

	sideNavLinks.forEach((link) => {
		link.addEventListener("click", () => {
			const target = link.dataset.target;
			setActiveSideNav(target);
			scrollToSection(target);
			closeMobileMenu();
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

	studentRegisterForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const fd = new FormData(studentRegisterForm);
		await registerStudentAccount({
			name: String(fd.get("name") || "").trim(),
			cmsId: String(fd.get("cmsId") || "").trim(),
			email: String(fd.get("email") || "").trim(),
			password: String(fd.get("password") || "").trim(),
			section: String(fd.get("section") || "").trim()
		});
		studentRegisterForm.reset();
	});

	studentLoginForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const fd = new FormData(studentLoginForm);
		await loginStudent(String(fd.get("cmsId") || "").trim(), String(fd.get("password") || "").trim());
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

	organizerLoginForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const fd = new FormData(organizerLoginForm);
		await loginOrganizer(organizerSocietySelect.value, String(fd.get("password") || "").trim());
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
	addEventForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		await addOrganizerEvent();
	});
}

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
	logLine("Connecting to Supabase...");
	await refreshAllData();
	logLine("Connected. Loaded " + societies.length + " societies and " + events.length + " events.");

	bind();
	updateTypeExtras();
	switchTab("guest");
	setActiveSideNav("overview");

	if (switchOrganizerViewBtn) {
		switchOrganizerViewBtn.setAttribute("aria-pressed", "false");
		switchOrganizerViewBtn.classList.remove("is-organizer");
		const toggleText = switchOrganizerViewBtn.querySelector(".toggle-text");
		if (toggleText) {
			toggleText.textContent = "Guest Mode";
		}
	}

	const searchShortcutKey = document.getElementById("searchShortcutKey");
	if (searchShortcutKey) {
		const isApplePlatform = /Mac|iPhone|iPad/i.test(window.navigator.platform);
		searchShortcutKey.textContent = isApplePlatform ? "CMD + K" : "CTRL + K";
	}

	updateStudentUI();
	updateOrganizerUI();
	refreshAll();
	initScrollSpy();
}

init()