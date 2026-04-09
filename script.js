const REVIEWABLE_TYPES = new Set(["workshop", "competition", "seminar"]);
const SUPABASE_URL = "https://snzbxtwltqysdpdirsce.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuemJ4dHdsdHF5c2RwZGlyc2NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTcyNDksImV4cCI6MjA5MTMzMzI0OX0.akjrFaY5UNAdqZdJbzUm_D0pzdYG7sQegqD3jJzpj5g";
const ALLOWED_DOMAIN_HINT = "@*.nust.edu.pk or @seecs.edu.pk";
const ALLOWED_NUST_PATTERNS = [
    /^[^@\s]+@([a-z0-9-]+\.)*nust\.edu\.pk$/i,
    /^[^@\s]+@seecs\.edu\.pk$/i
];

let supabase = null;
let allSocieties = [];
let allEvents = [];
let registrationCounts = new Map();
let reviewAgg = new Map();

let loggedInStudentUser = null;
let loggedInStudentProfile = null;
let loggedInOrganizer = null;
let toastTimeout;

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const societyFilter = document.getElementById("societyFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const eventTableBody = document.getElementById("eventTableBody");
const resultCounter = document.getElementById("resultCounter");
const portalStats = document.getElementById("portalStats");
const consoleOutput = document.getElementById("consoleOutput");
const toastEl = document.getElementById("toast");

const studentOtpRequestForm = document.getElementById("studentOtpRequestForm");
const studentOtpVerifyForm = document.getElementById("studentOtpVerifyForm");
const studentProfileForm = document.getElementById("studentProfileForm");
const studentEmail = document.getElementById("studentEmail");
const studentOtpCode = document.getElementById("studentOtpCode");
const studentSessionLabel = document.getElementById("studentSessionLabel");
const studentActions = document.getElementById("studentActions");
const studentEventSelect = document.getElementById("studentEventSelect");
const reviewText = document.getElementById("reviewText");
const reviewRating = document.getElementById("reviewRating");

const profileName = document.getElementById("profileName");
const profileCmsId = document.getElementById("profileCmsId");
const profileSection = document.getElementById("profileSection");

const organizerLoginForm = document.getElementById("organizerLoginForm");
const organizerSocietySelect = document.getElementById("organizerSocietySelect");
const organizerSessionLabel = document.getElementById("organizerSessionLabel");
const organizerActions = document.getElementById("organizerActions");
const addEventForm = document.getElementById("addEventForm");
const newEventType = document.getElementById("newEventType");
const newEventExtra1 = document.getElementById("newEventExtra1");
const newEventExtra2 = document.getElementById("newEventExtra2");

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2200);
}

function isAllowedStudentEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    return ALLOWED_NUST_PATTERNS.some((pattern) => pattern.test(normalized));
}

function writeConsole(message) {
    const prefix = new Date().toLocaleTimeString();
    consoleOutput.textContent = "[" + prefix + "] " + message + "\n" + consoleOutput.textContent;
}

function setRole(role) {
    document.querySelectorAll(".role-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.role === role);
    });

    document.querySelectorAll(".role-panel").forEach((panel) => {
        panel.classList.remove("active");
    });

    if (role === "guest") document.getElementById("guestPanel").classList.add("active");
    if (role === "student") document.getElementById("studentPanel").classList.add("active");
    if (role === "organizer") document.getElementById("organizerPanel").classList.add("active");
}

function updateAddEventFieldHints() {
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

function getEventById(eventId) {
    return allEvents.find((event) => event.id === eventId) || null;
}

function getSocietyByName(name) {
    return allSocieties.find((society) => society.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function getAvailableSeats(event) {
    return Number(event.capacity || 0) - Number(registrationCounts.get(event.id) || 0);
}

function getAverageRating(eventId) {
    const metric = reviewAgg.get(eventId);
    if (!metric || !metric.count) {
        return 0;
    }
    return metric.sum / metric.count;
}

function getFilteredEvents() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const society = societyFilter.value;

    return allEvents.filter((event) => {
        const typeMatch = type === "all" || event.type === type;
        const societyMatch = society === "all" || event.society_name === society;
        const queryMatch =
            query.length === 0 ||
            event.title.toLowerCase().includes(query) ||
            event.society_name.toLowerCase().includes(query) ||
            event.type.toLowerCase().includes(query);

        return typeMatch && societyMatch && queryMatch;
    });
}

function renderStats(studentCount) {
    portalStats.innerHTML =
        '<div class="stat"><b>' + allSocieties.length + '</b><span>Societies</span></div>' +
        '<div class="stat"><b>' + allEvents.length + '</b><span>Events</span></div>' +
        '<div class="stat"><b>' + studentCount + '</b><span>Students</span></div>';
}

function renderSocietyFilter() {
    const previous = societyFilter.value;
    const societyNames = [...new Set(allEvents.map((event) => event.society_name))].sort();
    const options = ["<option value=\"all\">All</option>"];

    societyNames.forEach((name) => {
        options.push('<option value="' + name + '">' + name + "</option>");
    });

    societyFilter.innerHTML = options.join("");
    if (societyNames.includes(previous)) {
        societyFilter.value = previous;
    }
}

function renderStudentEventSelect() {
    const current = studentEventSelect.value;
    studentEventSelect.innerHTML = allEvents
        .map((event) => '<option value="' + event.id + '">' + event.title + " | " + event.type + "</option>")
        .join("");

    if (allEvents.some((event) => event.id === current)) {
        studentEventSelect.value = current;
    }
}

function renderOrganizerSocieties() {
    organizerSocietySelect.innerHTML = allSocieties
        .map((society) => '<option value="' + society.name + '">' + society.name + "</option>")
        .join("");
}

function renderEventTable() {
    const filtered = getFilteredEvents();
    resultCounter.textContent = "Showing " + filtered.length + " events";

    if (!filtered.length) {
        eventTableBody.innerHTML = '<tr><td colspan="9">No events found.</td></tr>';
        return;
    }

    eventTableBody.innerHTML = filtered
        .map((event, index) => {
            const average = REVIEWABLE_TYPES.has(event.type) ? getAverageRating(event.id).toFixed(2) : "N/A";
            const linkButton = event.registration_url
                ? '<button type="button" class="open-link-btn" data-link="' + event.registration_url + '">Open</button>'
                : "-";

            return (
                "<tr>" +
                    "<td>" + (index + 1) + "</td>" +
                    "<td>" + event.title + "</td>" +
                    "<td>" + event.society_name + "</td>" +
                    "<td><span class=\"pill\">" + event.type + "</span></td>" +
                    "<td><span class=\"pill status-" + event.status + "\">" + event.date + "</span></td>" +
                    "<td>" + event.venue + "</td>" +
                    "<td>" + getAvailableSeats(event) + "</td>" +
                    "<td>" + average + "</td>" +
                    "<td>" + linkButton + "</td>" +
                "</tr>"
            );
        })
        .join("");
}

function updateStudentSessionUI() {
    if (!loggedInStudentUser) {
        studentSessionLabel.textContent = "Not logged in";
        studentProfileForm.classList.add("hidden");
        studentActions.classList.add("hidden");
        return;
    }

    const identity = loggedInStudentProfile && loggedInStudentProfile.cms_id
        ? loggedInStudentProfile.name + " (" + loggedInStudentProfile.cms_id + ")"
        : loggedInStudentUser.email;

    studentSessionLabel.textContent = "Logged in: " + identity;

    if (loggedInStudentProfile && loggedInStudentProfile.cms_id && loggedInStudentProfile.name) {
        studentProfileForm.classList.add("hidden");
        studentActions.classList.remove("hidden");
    } else {
        studentProfileForm.classList.remove("hidden");
        studentActions.classList.add("hidden");
    }
}

function updateOrganizerSessionUI() {
    if (!loggedInOrganizer) {
        organizerSessionLabel.textContent = "Not logged in";
        organizerActions.classList.add("hidden");
        return;
    }

    organizerSessionLabel.textContent = "Logged in: " + loggedInOrganizer.name;
    organizerActions.classList.remove("hidden");
}

async function loadProfilesCount() {
    const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });

    if (error) {
        writeConsole("profiles count error: " + error.message);
        return 0;
    }
    return count || 0;
}

async function loadSocieties() {
    const { data, error } = await supabase
        .from("societies")
        .select("id, name, category, password")
        .order("name", { ascending: true });

    if (error) {
        throw error;
    }

    allSocieties = data || [];
}

async function loadEvents() {
    const { data, error } = await supabase
        .from("events")
        .select("id, title, type, date, venue, capacity, description, status, registration_url, details, society_id")
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    const societyMap = new Map(allSocieties.map((society) => [society.id, society.name]));
    allEvents = (data || []).map((event) => ({
        ...event,
        society_name: societyMap.get(event.society_id) || "Unknown"
    }));
}

async function loadMetrics() {
    const { data: registrations, error: regError } = await supabase
        .from("registrations")
        .select("event_id");

    if (regError) {
        throw regError;
    }

    registrationCounts = new Map();
    (registrations || []).forEach((row) => {
        registrationCounts.set(row.event_id, (registrationCounts.get(row.event_id) || 0) + 1);
    });

    const { data: reviews, error: reviewError } = await supabase
        .from("reviews")
        .select("event_id, rating");

    if (reviewError) {
        throw reviewError;
    }

    reviewAgg = new Map();
    (reviews || []).forEach((row) => {
        const existing = reviewAgg.get(row.event_id) || { sum: 0, count: 0 };
        existing.sum += Number(row.rating || 0);
        existing.count += 1;
        reviewAgg.set(row.event_id, existing);
    });
}

async function loadStudentProfile() {
    if (!loggedInStudentUser) {
        loggedInStudentProfile = null;
        return;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, cms_id, section, role")
        .eq("id", loggedInStudentUser.id)
        .maybeSingle();

    if (error) {
        writeConsole("profile load error: " + error.message);
        loggedInStudentProfile = null;
        return;
    }

    loggedInStudentProfile = data || null;

    if (!loggedInStudentProfile) {
        const payload = {
            id: loggedInStudentUser.id,
            email: loggedInStudentUser.email,
            name: "",
            cms_id: "",
            section: "",
            role: "student"
        };

        const { data: upserted, error: upsertError } = await supabase
            .from("profiles")
            .upsert(payload)
            .select("id, email, name, cms_id, section, role")
            .single();

        if (upsertError) {
            writeConsole("profile create error: " + upsertError.message);
            return;
        }

        loggedInStudentProfile = upserted;
    }
}

async function refreshViews() {
    try {
        await loadSocieties();
        await loadEvents();
        await loadMetrics();
        const studentCount = await loadProfilesCount();

        renderOrganizerSocieties();
        renderSocietyFilter();
        renderEventTable();
        renderStudentEventSelect();
        renderStats(studentCount);
    } catch (error) {
        writeConsole("Data load failed: " + error.message);
        showToast("Supabase table error. Run SQL setup file.");
    }
}

async function sendStudentOtp() {
    const email = studentEmail.value.trim().toLowerCase();
    if (!isAllowedStudentEmail(email)) {
        showToast("Use NUST school email: " + ALLOWED_DOMAIN_HINT);
        return;
    }

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
        writeConsole("OTP send failed: " + error.message);
        showToast("Could not send OTP");
        return;
    }

    writeConsole("OTP sent to " + email + ".");
    showToast("OTP sent");
}

async function verifyStudentOtp() {
    const email = studentEmail.value.trim().toLowerCase();
    const token = studentOtpCode.value.trim();

    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email"
    });

    if (error) {
        writeConsole("OTP verify failed: " + error.message);
        showToast("Invalid OTP");
        return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
        writeConsole("Could not fetch auth user after OTP.");
        showToast("Login failed");
        return;
    }

    loggedInStudentUser = userData.user;
    await loadStudentProfile();
    updateStudentSessionUI();

    writeConsole("Student login successful: " + loggedInStudentUser.email);
    showToast("Student logged in");
}

async function saveStudentProfile() {
    if (!loggedInStudentUser) {
        showToast("Login first");
        return;
    }

    const payload = {
        id: loggedInStudentUser.id,
        email: loggedInStudentUser.email,
        name: profileName.value.trim(),
        cms_id: profileCmsId.value.trim(),
        section: profileSection.value.trim(),
        role: "student"
    };

    const { data, error } = await supabase
        .from("profiles")
        .upsert(payload)
        .select("id, email, name, cms_id, section, role")
        .single();

    if (error) {
        writeConsole("Profile save failed: " + error.message);
        showToast("Could not save profile");
        return;
    }

    loggedInStudentProfile = data;
    updateStudentSessionUI();
    await refreshViews();

    writeConsole("Student profile saved for " + data.email + ".");
    showToast("Profile saved");
}

async function registerStudentForEvent() {
    if (!loggedInStudentProfile) {
        showToast("Complete student profile first");
        return;
    }

    const eventId = studentEventSelect.value;
    const event = getEventById(eventId);
    if (!event) {
        showToast("Select valid event");
        return;
    }

    if (getAvailableSeats(event) <= 0) {
        showToast("Event is full");
        return;
    }

    const { error } = await supabase
        .from("registrations")
        .insert({ event_id: eventId, student_id: loggedInStudentProfile.id });

    if (error) {
        writeConsole("Registration failed: " + error.message);
        showToast("Already registered or blocked by policy");
        return;
    }

    writeConsole(loggedInStudentProfile.name + " registered for " + event.title + ".");
    showToast("Registered successfully");
    await refreshViews();
}

async function cancelRegistration() {
    if (!loggedInStudentProfile) {
        showToast("Complete student profile first");
        return;
    }

    const eventId = studentEventSelect.value;
    const event = getEventById(eventId);
    if (!event) {
        showToast("Select valid event");
        return;
    }

    const { error } = await supabase
        .from("registrations")
        .delete()
        .eq("event_id", eventId)
        .eq("student_id", loggedInStudentProfile.id);

    if (error) {
        writeConsole("Cancel failed: " + error.message);
        showToast("Could not cancel registration");
        return;
    }

    writeConsole(loggedInStudentProfile.name + " removed from " + event.title + ".");
    showToast("Registration cancelled");
    await refreshViews();
}

async function submitReview() {
    if (!loggedInStudentProfile) {
        showToast("Complete student profile first");
        return;
    }

    const eventId = studentEventSelect.value;
    const event = getEventById(eventId);
    if (!event) {
        showToast("Select valid event");
        return;
    }

    if (!REVIEWABLE_TYPES.has(event.type)) {
        showToast("This event does not support reviews");
        return;
    }

    const rating = Number(reviewRating.value);
    if (rating < 1 || rating > 5) {
        showToast("Rating must be 1-5");
        return;
    }

    const payload = {
        event_id: eventId,
        student_id: loggedInStudentProfile.id,
        feedback: reviewText.value.trim(),
        rating
    };

    const { error } = await supabase
        .from("reviews")
        .upsert(payload, { onConflict: "event_id,student_id" });

    if (error) {
        writeConsole("Review failed: " + error.message);
        showToast("Could not submit review");
        return;
    }

    reviewText.value = "";
    reviewRating.value = "5";
    writeConsole("Review submitted for " + event.title + ".");
    showToast("Review submitted");
    await refreshViews();
}

async function viewReviewsForEvent() {
    const eventId = studentEventSelect.value;
    const event = getEventById(eventId);
    if (!event) {
        return;
    }

    if (!REVIEWABLE_TYPES.has(event.type)) {
        writeConsole("This event does not support reviews.");
        return;
    }

    const { data, error } = await supabase
        .from("reviews")
        .select("feedback, rating, student_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

    if (error) {
        writeConsole("Review fetch failed: " + error.message);
        return;
    }

    if (!data || !data.length) {
        writeConsole("No reviews yet for " + event.title + ".");
        return;
    }

    const lines = data.map((row, i) => "  " + (i + 1) + ". " + row.feedback + " | " + row.rating + "/5");
    writeConsole("Reviews for " + event.title + ":\n" + lines.join("\n"));
}

async function showProfile() {
    if (!loggedInStudentProfile) {
        showToast("Complete student profile first");
        return;
    }

    writeConsole(
        "Name: " + loggedInStudentProfile.name + "\n" +
        "CMS ID: " + loggedInStudentProfile.cms_id + "\n" +
        "Email: " + loggedInStudentProfile.email + "\n" +
        "Section: " + loggedInStudentProfile.section
    );
}

async function showUpcoming() {
    if (!loggedInStudentProfile) {
        showToast("Complete student profile first");
        return;
    }

    const { data, error } = await supabase
        .from("registrations")
        .select("event_id")
        .eq("student_id", loggedInStudentProfile.id);

    if (error) {
        writeConsole("Could not load upcoming events: " + error.message);
        return;
    }

    const eventIds = (data || []).map((row) => row.event_id);
    if (!eventIds.length) {
        writeConsole("You have no upcoming events.");
        return;
    }

    const lines = ["Your Upcoming Events:"];
    allEvents
        .filter((event) => eventIds.includes(event.id))
        .forEach((event) => {
            lines.push("  - " + event.title + " | " + event.date + " | " + event.venue);
        });

    writeConsole(lines.join("\n"));
}

async function organizerLogin(password) {
    const society = getSocietyByName(organizerSocietySelect.value);
    if (!society) {
        showToast("Society not found");
        return;
    }

    if (String(society.password) !== String(password)) {
        showToast("Invalid organizer password");
        writeConsole("Invalid organizer login for " + society.name + ".");
        return;
    }

    loggedInOrganizer = society;
    updateOrganizerSessionUI();
    writeConsole("Organizer login successful: " + society.name);
    showToast("Organizer logged in");
}

async function showMyEvents() {
    if (!loggedInOrganizer) {
        return;
    }

    const mine = allEvents.filter((event) => event.society_id === loggedInOrganizer.id);
    if (!mine.length) {
        writeConsole(loggedInOrganizer.name + " has no events yet.");
        return;
    }

    const lines = ["Events by " + loggedInOrganizer.name + ":"];
    mine.forEach((event, i) => {
        lines.push("  " + (i + 1) + ". " + event.title + " | " + event.date + " | seats: " + getAvailableSeats(event));
    });
    writeConsole(lines.join("\n"));
}

async function showAttendees() {
    if (!loggedInOrganizer) {
        return;
    }

    const myEventIds = allEvents
        .filter((event) => event.society_id === loggedInOrganizer.id)
        .map((event) => event.id);

    if (!myEventIds.length) {
        writeConsole("Your society has no events yet.");
        return;
    }

    const { data: regs, error: regError } = await supabase
        .from("registrations")
        .select("event_id, student_id")
        .in("event_id", myEventIds);

    if (regError) {
        writeConsole("Could not load attendees: " + regError.message);
        return;
    }

    const studentIds = [...new Set((regs || []).map((row) => row.student_id))];
    let profiles = [];

    if (studentIds.length) {
        const { data: profileRows, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, cms_id, email")
            .in("id", studentIds);

        if (profileError) {
            writeConsole("Could not load attendee profiles: " + profileError.message);
            return;
        }

        profiles = profileRows || [];
    }

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const lines = [];

    allEvents
        .filter((event) => myEventIds.includes(event.id))
        .forEach((event) => {
            lines.push("Attendees for " + event.title + ":");
            const attendees = (regs || []).filter((row) => row.event_id === event.id);
            if (!attendees.length) {
                lines.push("  No attendees yet.");
                return;
            }
            attendees.forEach((row, i) => {
                const profile = profileMap.get(row.student_id);
                if (profile) {
                    lines.push("  " + (i + 1) + ". " + profile.name + " (" + profile.cms_id + ") | " + profile.email);
                }
            });
        });

    writeConsole(lines.join("\n"));
}

async function addOrganizerEvent() {
    if (!loggedInOrganizer) {
        showToast("Login as organizer first");
        return;
    }

    const type = newEventType.value;
    const title = document.getElementById("newEventTitle").value.trim();
    const date = document.getElementById("newEventDate").value.trim();
    const venue = document.getElementById("newEventVenue").value.trim();
    const capacityRaw = Number(document.getElementById("newEventCapacity").value.trim());
    const description = document.getElementById("newEventDescription").value.trim();
    const capacity = Number.isFinite(capacityRaw) && capacityRaw > 0 ? capacityRaw : 50;
    const extra1 = newEventExtra1.value.trim();
    const extra2 = newEventExtra2.value.trim();

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

    const payload = {
        title,
        type,
        society_id: loggedInOrganizer.id,
        date,
        venue,
        capacity,
        description,
        status: "scheduled",
        details,
        registration_url: ""
    };

    const { error } = await supabase
        .from("events")
        .insert(payload);

    if (error) {
        writeConsole("Add event failed: " + error.message);
        showToast("Could not add event");
        return;
    }

    addEventForm.reset();
    updateAddEventFieldHints();
    await refreshViews();
    writeConsole('Event "' + payload.title + '" added successfully.');
    showToast("Event added");
}

async function handleStudentLogout() {
    await supabase.auth.signOut();
    loggedInStudentUser = null;
    loggedInStudentProfile = null;
    updateStudentSessionUI();
    showToast("Student logged out");
}

function handleOrganizerLogout() {
    loggedInOrganizer = null;
    updateOrganizerSessionUI();
    showToast("Organizer logged out");
}

async function restoreStudentSession() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        writeConsole("Session restore error: " + error.message);
        return;
    }

    if (data.user) {
        loggedInStudentUser = data.user;
        studentEmail.value = data.user.email || "";
        await loadStudentProfile();
        if (loggedInStudentProfile) {
            profileName.value = loggedInStudentProfile.name || "";
            profileCmsId.value = loggedInStudentProfile.cms_id || "";
            profileSection.value = loggedInStudentProfile.section || "";
        }
    }
}

function bindEvents() {
    searchInput.addEventListener("input", renderEventTable);
    typeFilter.addEventListener("change", renderEventTable);
    societyFilter.addEventListener("change", renderEventTable);

    resetFiltersBtn.addEventListener("click", () => {
        searchInput.value = "";
        typeFilter.value = "all";
        societyFilter.value = "all";
        renderEventTable();
    });

    document.querySelectorAll(".role-tab").forEach((tab) => {
        tab.addEventListener("click", () => setRole(tab.dataset.role));
    });

    eventTableBody.addEventListener("click", (event) => {
        const button = event.target.closest(".open-link-btn");
        if (!button) {
            return;
        }
        window.open(button.dataset.link, "_blank", "noopener");
    });

    studentOtpRequestForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await sendStudentOtp();
    });

    studentOtpVerifyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await verifyStudentOtp();
        await refreshViews();
    });

    studentProfileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveStudentProfile();
    });

    document.getElementById("registerEventBtn").addEventListener("click", registerStudentForEvent);
    document.getElementById("cancelEventBtn").addEventListener("click", cancelRegistration);
    document.getElementById("submitReviewBtn").addEventListener("click", submitReview);
    document.getElementById("viewReviewsBtn").addEventListener("click", viewReviewsForEvent);
    document.getElementById("profileBtn").addEventListener("click", showProfile);
    document.getElementById("upcomingBtn").addEventListener("click", showUpcoming);
    document.getElementById("studentLogoutBtn").addEventListener("click", handleStudentLogout);

    organizerLoginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(organizerLoginForm);
        const password = String(formData.get("password") || "").trim();
        await organizerLogin(password);
        organizerLoginForm.reset();
    });

    document.getElementById("myEventsBtn").addEventListener("click", showMyEvents);
    document.getElementById("attendeesBtn").addEventListener("click", showAttendees);
    document.getElementById("organizerLogoutBtn").addEventListener("click", handleOrganizerLogout);

    newEventType.addEventListener("change", updateAddEventFieldHints);

    addEventForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await addOrganizerEvent();
    });
}

async function bootstrap() {
    bindEvents();
    updateAddEventFieldHints();
    setRole("guest");

    if (!window.supabase || !window.supabase.createClient) {
        writeConsole("Supabase SDK failed to load.");
        showToast("Supabase SDK missing");
        return;
    }

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    await restoreStudentSession();
    updateStudentSessionUI();
    updateOrganizerSessionUI();

    await refreshViews();
    writeConsole("Supabase connected. Run SQL setup if tables are missing.");
}

bootstrap();
