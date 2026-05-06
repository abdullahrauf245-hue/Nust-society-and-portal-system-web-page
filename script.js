import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://snzbxtwltqysdpdirsce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4jzwMEIpRG1nFNSSyx35gQ_FhYBkebF";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const REVIEWABLE_TYPES = new Set(["workshop", "competition", "seminar"]);
const THEME_STORAGE_KEY = "nust-portal-theme";
const DATA_MODE_REMOTE = "remote";
const DATA_MODE_LOCAL = "local";

// ─── State ─────────────────────────────────────────────────────────────────────
let societies = [];
let events = [];
let students = [];
let dataMode = DATA_MODE_REMOTE;
let localState = createLocalState();
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
const refreshFeaturedBtn = document.getElementById("refreshFeaturedBtn");
const jumpStudentBtn = document.getElementById("jumpStudentBtn");
const jumpOrganizerBtn = document.getElementById("jumpOrganizerBtn");
const switchOrganizerViewBtn = document.getElementById("switchOrganizerViewBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
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
const organizerEventsList = document.getElementById("organizerEventsList");
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

function getStoredTheme() {
	try {
		const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
		if (savedTheme === "light" || savedTheme === "dark") {
			return savedTheme;
		}
	} catch {
		return null;
	}
	return null;
}

function getPreferredTheme() {
	const storedTheme = getStoredTheme();
	if (storedTheme) return storedTheme;
	const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
	return prefersLight ? "light" : "dark";
}

function updateThemeToggleUI(theme) {
	if (!themeToggleBtn) return;
	const isLight = theme === "light";
	themeToggleBtn.setAttribute("aria-pressed", String(isLight));
	themeToggleBtn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
	const label = themeToggleBtn.querySelector(".theme-toggle-label");
	if (label) {
		label.textContent = isLight ? "Light Mode" : "Dark Mode";
	}
}

function applyTheme(theme, persist = true) {
	const safeTheme = theme === "light" ? "light" : "dark";
	document.documentElement.setAttribute("data-theme", safeTheme);
	document.documentElement.style.colorScheme = safeTheme;
	updateThemeToggleUI(safeTheme);

	if (!persist) return;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
	} catch {
		// Ignore storage write errors and still apply the theme for this session.
	}
}

function initThemeToggle() {
	applyTheme(getPreferredTheme(), false);
	if (!themeToggleBtn) return;

	themeToggleBtn.addEventListener("click", () => {
		const currentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
		applyTheme(currentTheme === "light" ? "dark" : "light");
	});
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
		return raw;
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

function isFetchNetworkError(error) {
	const msg = String(error?.message || "").toLowerCase();
	return msg.includes("failed to fetch") || msg.includes("load failed") || msg.includes("networkerror");
}

function logSupabaseNetworkHint() {
	logLine("Cannot reach Supabase host. Check SUPABASE_URL, internet, DNS, or firewall settings.");
}

function formatDate(dateStr) {
	if (!dateStr) return "TBA";
	const raw = String(dateStr).trim();
	if (!raw) return "TBA";

	// Parse only ISO-like values from DB (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).
	// Human-readable labels like "Delayed - Originally ..." should be shown as-is.
	const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
	if (!isoMatch) return raw;

	const year = Number(isoMatch[1]);
	const month = Number(isoMatch[2]);
	const day = Number(isoMatch[3]);
	const d = new Date(Date.UTC(year, month - 1, day));
	if (isNaN(d.getTime())) return raw;

	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return d.getUTCDate() + "-" + months[d.getUTCMonth()] + "-" + d.getUTCFullYear();
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

function createLocalState() {
	return {
		societies: [
			{ id: "soc-001", name: "NUST Music Society", short_name: "NMS", password_hash: "nms123" },
			{ id: "soc-002", name: "RIC", short_name: "RIC", password_hash: "ric123" },
			{ id: "soc-003", name: "NEC", short_name: "NEC", password_hash: "nec123" },
			{ id: "soc-004", name: "ACM", short_name: "ACM", password_hash: "acm123" },
			{ id: "soc-005", name: "Vyro.ai", short_name: "VYRO", password_hash: "vyro123" },
			{ id: "soc-006", name: "IEEE", short_name: "IEEE", password_hash: "ieee123" },
			{ id: "soc-007", name: "SOULS", short_name: "SOULS", password_hash: "souls123" },
			{ id: "soc-008", name: "AND", short_name: "AND", password_hash: "and123" }
		],
		events: [
			{
				id: "evt-0001",
				title: "NUST Music Fest (NMF)",
				society_id: "soc-001",
				type: "concert",
				date: "2026-04-22",
				venue: "NBS Ground",
				seats: 350,
				description: "Flagship live music event.",
				status: "Scheduled",
				registration_link: null
			},
			{
				id: "evt-0002",
				title: "HAAMI 2026",
				society_id: "soc-002",
				type: "concert",
				date: "2026-04-03",
				venue: "H12 Campus",
				seats: 250,
				description: "Culture and community evening.",
				status: "Scheduled",
				registration_link: null
			},
			{
				id: "evt-0003",
				title: "AIcon 2026",
				society_id: "soc-003",
				type: "competition",
				date: "2026-04-30",
				venue: "SEECS",
				seats: 180,
				description: "AI and innovation challenge.",
				status: "Expected",
				registration_link: null
			},
			{
				id: "evt-0004",
				title: "VYROTHON 2026",
				society_id: "soc-005",
				type: "competition",
				date: "2026-04-18",
				venue: "NSTP",
				seats: 120,
				description: "Build and pitch AI products.",
				status: "Scheduled",
				registration_link: "https://vyrothon.vyro.ai/"
			}
		],
		students: [],
		registrations: [],
		reviews: [],
		eventCounter: 5,
		studentCounter: 1,
		reviewCounter: 1,
		registrationCounter: 1
	};
}

function isLocalMode() {
	return dataMode === DATA_MODE_LOCAL;
}

function toLocalId(prefix, num) {
	return prefix + "-" + String(num).padStart(4, "0");
}

function nextLocalEventId() {
	const id = toLocalId("evt", localState.eventCounter);
	localState.eventCounter += 1;
	return id;
}

function nextLocalStudentId() {
	const id = toLocalId("stu", localState.studentCounter);
	localState.studentCounter += 1;
	return id;
}

function nextLocalReviewId() {
	const id = toLocalId("rev", localState.reviewCounter);
	localState.reviewCounter += 1;
	return id;
}

function nextLocalRegistrationId() {
	const id = toLocalId("reg", localState.registrationCounter);
	localState.registrationCounter += 1;
	return id;
}

function syncLocalDerivedData() {
	if (!localState) return;

	societies = localState.societies;
	students = localState.students;
	events = localState.events.map((event) => {
		const regCount = localState.registrations.filter((r) => r.event_id === event.id && r.status === "active").length;
		const eventReviews = localState.reviews.filter((r) => r.event_id === event.id);
		const society = localState.societies.find((s) => s.id === event.society_id);

		return applyPinnedEventOverrides({
			...event,
			society: society?.name || "Unknown",
			societyShortName: society?.short_name || "",
			_registrationCount: regCount,
			_reviews: eventReviews
		});
	});
}

function setLocalMode() {
	if (!localState) localState = createLocalState();
	dataMode = DATA_MODE_LOCAL;
	syncLocalDerivedData();
}

// ─── Supabase Data Loading ─────────────────────────────────────────────────────
async function loadSocieties() {
	if (isLocalMode()) {
		syncLocalDerivedData();
		return true;
	}

	const { data, error } = await supabase.from("societies").select().order("name");
	if (error) {
		logLine("Error loading societies: " + error.message);
		if (isFetchNetworkError(error)) logSupabaseNetworkHint();
		return false;
	}
	societies = data || [];
	return true;
}

async function loadEvents() {
	if (isLocalMode()) {
		syncLocalDerivedData();
		return true;
	}

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
		if (isFetchNetworkError(error)) logSupabaseNetworkHint();
		return false;
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

	return true;
}

async function refreshAllData() {
	if (isLocalMode()) {
		syncLocalDerivedData();
		refreshAll();
		return true;
	}

	const results = await Promise.all([loadSocieties(), loadEvents()]);
	refreshAll();
	return results.every(Boolean);
}

// ─── Rendering ─────────────────────────────────────────────────────────────────
function updateTypeExtras() {
	const type = String(newEventType.value).toLowerCase();
	if (type === "workshop") {
		newEventExtra1.placeholder = "Duration";
		newEventExtra2.placeholder = "Prerequisite";
	} else if (type === "concert") {
		newEventExtra1.placeholder = "Performer";
		newEventExtra2.placeholder = "Genre";
	} else if (type === "competition") {
		newEventExtra1.placeholder = "Prize Pool";
		newEventExtra2.placeholder = "Team Size";
	} else if (type === "seminar") {
		newEventExtra1.placeholder = "Speaker";
		newEventExtra2.placeholder = "Topic";
	} else {
		newEventExtra1.placeholder = "Additional Detail 1 (optional)";
		newEventExtra2.placeholder = "Additional Detail 2 (optional)";
	}
}

function renderFilters() {
	const prevSoc = societyFilter.value;
	const names = [...new Set(events.map((e) => e.society))].sort();
	societyFilter.innerHTML = '<option value="all">All</option>' + names.map((n) => '<option value="' + n + '">' + n + '</option>').join("");
	if (names.includes(prevSoc)) {
		societyFilter.value = prevSoc;
	}

	const prevType = typeFilter.value;
	const types = [...new Set(events.map((e) => e.type))].sort();
	typeFilter.innerHTML = '<option value="all">All</option>' + types.map((t) => {
		const label = t.charAt(0).toUpperCase() + t.slice(1);
		return '<option value="' + t + '">' + label + '</option>';
	}).join("");
	if (types.includes(prevType)) {
		typeFilter.value = prevType;
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

	const totalEvents = events.length;
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
		'<article class="mini-widget">' +
			'<div class="widget-head">' +
				'<p class="widget-label">Total Events</p>' +
				'<span class="widget-note">Listed</span>' +
			'</div>' +
			'<div class="widget-value">' + String(totalEvents).padStart(2, "0") + '</div>' +
			'<p class="widget-note">All upcoming listings</p>' +
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
	const { data, error } = await supabase.auth.signUp({
		email: payload.email,
		password: payload.password,
		options: {
			data: {
				full_name: payload.name, 
				cms_id: payload.cmsId,
				section: payload.section
			}
		}
	});

	if (error) {
		toastMsg("Registration failed");
		logLine("Registration error: " + error.message);
		return;
	}

	if (data.user) {
		const newStudent = {
			id: data.user.id,
			name: payload.name,
			cms_id: payload.cmsId,
			email: payload.email,
			section: payload.section
		};
		students.push(newStudent);
		loggedInStudent = newStudent;
		updateStudentUI();
		toastMsg("Student registered");
		logLine("Registration successful! Welcome, " + payload.name + ".");
	}
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

	const myEvents = events.filter((e) => e.society_id === loggedInOrganizer.id);
	
	if (!myEvents.length) {
		organizerEventsList.innerHTML = '<p class="muted">You have no events yet.</p>';
	} else {
		organizerEventsList.innerHTML = `
			<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
				<thead>
					<tr>
						<th style="text-align: left; border-bottom: 1px solid var(--line); padding: 8px;">Title</th>
						<th style="text-align: left; border-bottom: 1px solid var(--line); padding: 8px;">Date</th>
						<th style="text-align: right; border-bottom: 1px solid var(--line); padding: 8px;">Manage</th>
					</tr>
				</thead>
				<tbody>
					${myEvents.map(e => `
						<tr>
							<td style="border-bottom: 1px dashed var(--line); padding: 8px;">${e.title}</td>
							<td style="border-bottom: 1px dashed var(--line); padding: 8px;">${formatDate(e.date)}</td>
							<td style="border-bottom: 1px dashed var(--line); padding: 8px; text-align: right;">
								<button type="button" class="delete-event" data-event-id="${e.id}" style="padding: 6px 12px; font-size: 0.8rem;">Delete</button>
							</td>
						</tr>
					`).join('')}
				</tbody>
			</table>
		`;
	}
	
	organizerEventsList.classList.remove("hidden");
	toastMsg("Showing your events");
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
	if (organizerEventsList && !organizerEventsList.classList.contains("hidden")) {
		showMyEvents();
	}
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

	const typeLower = type.toLowerCase();
	if (typeLower === "workshop") {
		payload.duration = extra1;
		payload.prerequisite = extra2;
	} else if (typeLower === "concert") {
		payload.performer = extra1;
		payload.genre = extra2;
	} else if (typeLower === "competition") {
		payload.prize_pool = extra1;
		payload.team_size = Number(extra2) || 1;
	} else if (typeLower === "seminar") {
		payload.speaker = extra1;
		payload.topic = extra2;
	} else {
		if (extra1 || extra2) {
			payload.description += "\n\nAdditional Info:\n" + (extra1 ? "- " + extra1 + "\n" : "") + (extra2 ? "- " + extra2 : "");
		}
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

	if (organizerEventsList) {
		organizerEventsList.addEventListener("click", (event) => {
			const deleteButton = event.target.closest(".delete-event");
			if (deleteButton) {
				deleteOrganizerEvent(deleteButton.dataset.eventId);
			}
		});
	}

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
	newEventType.addEventListener("input", updateTypeExtras);
	addEventForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		await addOrganizerEvent();
	});
}

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
	initThemeToggle();
	logLine("Connecting to Supabase...");
	const isConnected = await refreshAllData();
	if (isConnected) {
		logLine("Connected. Loaded " + societies.length + " societies and " + events.length + " events.");
	} else {
		logLine("Backend connection failed. Working with empty local state.");
	}

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
	initScrollReveal();
	initSideNavRipple();
	initCountUpObserver();
	initCardTilt();
}

// ─── Animation: Scroll Reveal ──────────────────────────────────────────────────
function initScrollReveal() {
	const revealElements = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
	if (!revealElements.length) return;

	// Respect reduced-motion preference
	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReducedMotion) {
		revealElements.forEach((el) => el.classList.add("is-visible"));
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.08, rootMargin: "20px 0px -20px 0px" }
	);

	// Use rAF to ensure the DOM has painted before observing
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			revealElements.forEach((el) => observer.observe(el));
		});
	});

	// Safety net: if any element is still hidden after 1.5s, force-reveal it
	setTimeout(() => {
		revealElements.forEach((el) => {
			if (!el.classList.contains("is-visible")) {
				el.classList.add("is-visible");
			}
		});
	}, 1500);
}

// ─── Animation: Side Nav Ripple Tracking ───────────────────────────────────────
function initSideNavRipple() {
	document.querySelectorAll(".side-nav-link").forEach((link) => {
		let rafId;
		link.addEventListener("mousemove", (e) => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				const rect = link.getBoundingClientRect();
				const x = ((e.clientX - rect.left) / rect.width) * 100;
				const y = ((e.clientY - rect.top) / rect.height) * 100;
				link.style.setProperty("--ripple-x", x + "%");
				link.style.setProperty("--ripple-y", y + "%");
			});
		});
	});
}

// ─── Animation: Count-Up for Widget Values ─────────────────────────────────────
function animateCountUp(element, targetValue, duration = 800) {
	const start = performance.now();
	const startValue = 0;

	function step(timestamp) {
		const elapsed = timestamp - start;
		const progress = Math.min(elapsed / duration, 1);
		// Ease-out cubic
		const eased = 1 - Math.pow(1 - progress, 3);
		const current = Math.round(startValue + (targetValue - startValue) * eased);
		element.textContent = String(current).padStart(2, "0");

		if (progress < 1) {
			requestAnimationFrame(step);
		}
	}

	requestAnimationFrame(step);
}

function initCountUpObserver() {
	const widgetValues = document.querySelectorAll(".widget-value");
	if (!widgetValues.length) return;

	const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReducedMotion) return;

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const el = entry.target;
					const rawText = el.textContent.trim();
					const numericValue = parseInt(rawText, 10);
					if (!isNaN(numericValue) && numericValue > 0) {
						animateCountUp(el, numericValue, 900);
					}
					observer.unobserve(el);
				}
			});
		},
		{ threshold: 0.5 }
	);

	widgetValues.forEach((el) => observer.observe(el));
}

// ─── Animation: Scroll Progress Bar ────────────────────────────────────────────
function initScrollProgressBar() {
	const bar = document.createElement("div");
	bar.id = "scrollProgressBar";
	document.body.prepend(bar);

	function updateBar() {
		const scrollTop = window.scrollY || document.documentElement.scrollTop;
		const docHeight = document.documentElement.scrollHeight - window.innerHeight;
		const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
		bar.style.width = pct.toFixed(2) + "%";
	}

	window.addEventListener("scroll", updateBar, { passive: true });
	updateBar();
}

// ─── Animation: Cursor Glow Orb ────────────────────────────────────────────────
function initCursorGlow() {
	if (window.matchMedia("(hover: none)").matches) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const orb = document.createElement("div");
	orb.id = "cursorGlow";
	document.body.appendChild(orb);

	let mouseX = -999, mouseY = -999;
	let orbX = -999, orbY = -999;
	let rafId = null;

	window.addEventListener("mousemove", (e) => {
		mouseX = e.clientX;
		mouseY = e.clientY;
		if (!rafId) {
			rafId = requestAnimationFrame(moveOrb);
		}
	}, { passive: true });

	function moveOrb() {
		rafId = null;
		orbX += (mouseX - orbX) * 0.10;
		orbY += (mouseY - orbY) * 0.10;
		orb.style.left = orbX + "px";
		orb.style.top = orbY + "px";
		if (Math.abs(mouseX - orbX) > 0.5 || Math.abs(mouseY - orbY) > 0.5) {
			rafId = requestAnimationFrame(moveOrb);
		}
	}
}

// ─── Animation: Button Click Ripple/Shockwave ──────────────────────────────────
function initButtonRipple() {
	document.addEventListener("click", (e) => {
		const btn = e.target.closest("button");
		if (!btn) return;

		const rect = btn.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height) * 1.8;
		const x = e.clientX - rect.left - size / 2;
		const y = e.clientY - rect.top - size / 2;

		const ripple = document.createElement("span");
		ripple.className = "btn-ripple-wave";
		ripple.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + x + "px;top:" + y + "px;";
		btn.appendChild(ripple);
		ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
	});
}

// ─── Animation: Enhanced 3D Card Tilt with Shine ──────────────────────────────
function initEnhancedCardTilt() {
	if (window.matchMedia("(hover: none)").matches) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	function attachTilt(card) {
		if (card.dataset.tiltV2) return;
		card.dataset.tiltV2 = "1";

		let shine = card.querySelector(".card-tilt-shine");
		if (!shine) {
			shine = document.createElement("div");
			shine.className = "card-tilt-shine";
			card.appendChild(shine);
		}

		card.addEventListener("mousemove", (e) => {
			const rect = card.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dx = (e.clientX - cx) / (rect.width / 2);
			const dy = (e.clientY - cy) / (rect.height / 2);
			const rotX = -dy * 7;
			const rotY = dx * 7;
			const shineX = ((e.clientX - rect.left) / rect.width) * 100;
			const shineY = ((e.clientY - rect.top) / rect.height) * 100;
			card.style.transform = "perspective(900px) rotateX(" + rotX + "deg) rotateY(" + rotY + "deg) scale3d(1.025, 1.025, 1.025)";
			card.style.setProperty("--shine-x", shineX + "%");
			card.style.setProperty("--shine-y", shineY + "%");
		});

		card.addEventListener("mouseleave", () => {
			card.style.transform = "";
		});
	}

	const cardObserver = new MutationObserver(() => {
		document.querySelectorAll(".event-card:not([data-tilt-v2])").forEach(attachTilt);
	});
	cardObserver.observe(document.body, { childList: true, subtree: true });
	document.querySelectorAll(".event-card").forEach(attachTilt);
}

// ─── Animation: Glitch Brand on Hover + Auto ──────────────────────────────────
function initGlitchBrand() {
	const brandMark = document.querySelector(".brand-mark");
	if (!brandMark) return;

	let glitchTimer = null;
	function triggerGlitch() {
		brandMark.classList.add("glitch-active");
		clearTimeout(glitchTimer);
		glitchTimer = setTimeout(() => brandMark.classList.remove("glitch-active"), 400);
	}

	brandMark.addEventListener("mouseenter", triggerGlitch);
	setInterval(triggerGlitch, 12000);
}

// ─── Animation: Mini-Card Mouse Glow Tracking ─────────────────────────────────
function initMiniCardGlow() {
	if (window.matchMedia("(hover: none)").matches) return;

	document.querySelectorAll(".mini-card").forEach((card) => {
		card.addEventListener("mousemove", (e) => {
			const rect = card.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 100;
			const y = ((e.clientY - rect.top) / rect.height) * 100;
			card.style.setProperty("--card-mx", x + "%");
			card.style.setProperty("--card-my", y + "%");
		});
	});
}

// ─── Animation: Widget Particle Sparks (dynamic) ──────────────────────────────
function spawnParticlesOnWidget(widget) {
	if (widget.dataset.particles) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	widget.dataset.particles = "1";

	const colors = [
		"rgba(129, 140, 248, 0.8)",
		"rgba(167, 139, 250, 0.8)",
		"rgba(56, 189, 248, 0.8)",
		"rgba(52, 211, 153, 0.7)",
		"rgba(251, 191, 36, 0.7)"
	];

	for (let i = 0; i < 6; i++) {
		const p = document.createElement("div");
		p.className = "widget-particle";
		const sz = 2 + Math.random() * 3;
		const color = colors[i % colors.length];
		const dur = 2.5 + Math.random() * 2.5;
		const delay = Math.random() * 5;
		const sx = 5 + Math.random() * 90;
		const sy = 55 + Math.random() * 35;
		const tx1 = (Math.random() - 0.5) * 40;
		const ty1 = -(8 + Math.random() * 18);
		const tx2 = tx1 + (Math.random() - 0.5) * 20;
		const ty2 = ty1 - (12 + Math.random() * 22);
		const tx3 = tx2 + (Math.random() - 0.5) * 12;
		const ty3 = ty2 - (10 + Math.random() * 18);

		p.style.cssText = [
			"width:" + sz + "px", "height:" + sz + "px",
			"background:" + color,
			"left:" + sx + "%", "top:" + sy + "%",
			"box-shadow:0 0 " + (sz * 3) + "px " + color,
			"--p-dur:" + dur + "s", "--p-delay:" + delay + "s",
			"--p-tx1:" + tx1 + "px", "--p-ty1:" + ty1 + "px",
			"--p-tx2:" + tx2 + "px", "--p-ty2:" + ty2 + "px",
			"--p-tx3:" + tx3 + "px", "--p-ty3:" + ty3 + "px"
		].join(";");

		widget.appendChild(p);
	}
}

function initWidgetParticles() {
	const statsGrid = document.getElementById("statsGrid");
	if (!statsGrid) return;

	const obs = new MutationObserver(() => {
		statsGrid.querySelectorAll(".mini-widget").forEach(spawnParticlesOnWidget);
	});
	obs.observe(statsGrid, { childList: true, subtree: true });
	statsGrid.querySelectorAll(".mini-widget").forEach(spawnParticlesOnWidget);
}

// ─── Animation: Typewriter Hero Subtitle ──────────────────────────────────────
function initTypewriterHero() {
	const subEl = document.querySelector(".topbar .sub");
	if (!subEl) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const fullText = subEl.textContent.trim();
	subEl.textContent = "";

	const cursor = document.createElement("span");
	cursor.className = "typewriter-cursor";
	subEl.appendChild(cursor);

	let i = 0;
	function typeNext() {
		if (i < fullText.length) {
			subEl.insertBefore(document.createTextNode(fullText[i]), cursor);
			i++;
			setTimeout(typeNext, 25 + Math.random() * 22);
		}
	}
	setTimeout(typeNext, 800);
}

// ─── Animation: 3D Card Tilt (old function kept for compatibility) ─────────────
function initCardTilt() {
	// Replaced by initEnhancedCardTilt — this is a no-op to avoid conflicts
}

init();

// ─── Boot all animation systems ────────────────────────────────────────────────
initScrollProgressBar();
initCursorGlow();
initButtonRipple();
initEnhancedCardTilt();
initGlitchBrand();
initMiniCardGlow();
initWidgetParticles();
initTypewriterHero();