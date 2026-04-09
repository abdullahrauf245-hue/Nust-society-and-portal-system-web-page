const REVIEWABLE_TYPES = new Set(["workshop", "competition", "seminar"]);

const allSocieties = [
    { name: "NUST Music Society", category: "Cultural", password: "nms123", eventIds: [] },
    { name: "RIC", category: "Fundraiser", password: "ric123", eventIds: [] },
    { name: "NEC", category: "Technical", password: "nec123", eventIds: [] },
    { name: "ACM", category: "Technical", password: "acm123", eventIds: [] },
    { name: "Vyro.ai", category: "Technical", password: "vyro123", eventIds: [] },
    { name: "IEEE", category: "Technical", password: "ieee123", eventIds: [] },
    { name: "SOULS", category: "Cultural", password: "souls123", eventIds: [] },
    { name: "AND", category: "Technical", password: "and123", eventIds: [] }
];

const allStudents = [];
const allEvents = [];

let eventCounter = 1;
let loggedInStudent = null;
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

const studentRegisterForm = document.getElementById("studentRegisterForm");
const studentLoginForm = document.getElementById("studentLoginForm");
const studentSessionLabel = document.getElementById("studentSessionLabel");
const studentActions = document.getElementById("studentActions");
const studentEventSelect = document.getElementById("studentEventSelect");
const reviewText = document.getElementById("reviewText");
const reviewRating = document.getElementById("reviewRating");

const organizerLoginForm = document.getElementById("organizerLoginForm");
const organizerSocietySelect = document.getElementById("organizerSocietySelect");
const organizerSessionLabel = document.getElementById("organizerSessionLabel");
const organizerActions = document.getElementById("organizerActions");
const addEventForm = document.getElementById("addEventForm");
const newEventType = document.getElementById("newEventType");
const newEventExtra1 = document.getElementById("newEventExtra1");
const newEventExtra2 = document.getElementById("newEventExtra2");

function uid() {
    const id = "evt-" + String(eventCounter).padStart(4, "0");
    eventCounter += 1;
    return id;
}

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2000);
}

function writeConsole(message) {
    const prefix = new Date().toLocaleTimeString();
    const line = "[" + prefix + "] " + message;
    consoleOutput.textContent = line + "\n" + consoleOutput.textContent;
}

function getEventById(eventId) {
    return allEvents.find((event) => event.id === eventId) || null;
}

function getSocietyByName(name) {
    return allSocieties.find((society) => society.name.toLowerCase() === name.toLowerCase()) || null;
}

function getStudentByCms(cmsId) {
    return allStudents.find((student) => student.cmsId === cmsId) || null;
}

function getAvailableSeats(event) {
    return event.capacity - event.registeredStudentIds.length;
}

function isFull(event) {
    return getAvailableSeats(event) <= 0;
}

function canReview(event) {
    return REVIEWABLE_TYPES.has(event.type);
}

function getAverageRating(event) {
    if (!event.reviews.length) {
        return 0;
    }
    const sum = event.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / event.reviews.length;
}

function addEvent(event, owningSocietyName) {
    allEvents.push(event);
    const owner = getSocietyByName(owningSocietyName);
    if (owner && !owner.eventIds.includes(event.id)) {
        owner.eventIds.push(event.id);
    }
}

function seedEvents() {
    addEvent(
        {
            id: uid(),
            type: "concert",
            title: "NUST Music Fest (NMF)",
            society: "NUST Music Society",
            date: "DELAYED - Originally 21-22 Apr 2026",
            venue: "NUST Amphitheatre",
            status: "delayed",
            capacity: 500,
            description: "NUST annual music festival. Currently delayed.",
            registrationUrl: "",
            details: { performer: "Various Artists", genre: "Live Music / Multi-Genre" },
            registeredStudentIds: [],
            reviews: []
        },
        "NUST Music Society"
    );

    addEvent(
        {
            id: uid(),
            type: "concert",
            title: "HAAMI 2026",
            society: "RIC",
            date: "DELAYED - Originally 2-3 Apr 2026",
            venue: "NUST Main Campus",
            status: "delayed",
            capacity: 1000,
            description: "Fundraiser with Hassan Raheem. Postponed.",
            registrationUrl: "",
            details: { performer: "Hassan Raheem", genre: "Pop / R&B" },
            registeredStudentIds: [],
            reviews: []
        },
        "RIC"
    );

    addEvent(
        {
            id: uid(),
            type: "competition",
            title: "AIcon 2026",
            society: "NEC",
            date: "Expected: End of April 2026",
            venue: "SEECS, NUST",
            status: "expected",
            capacity: 150,
            description: "AI-focused hackathon by NEC with ACM and Hack Club NUST.",
            registrationUrl: "",
            details: { prizePool: "TBA", teamSize: 3 },
            registeredStudentIds: [],
            reviews: []
        },
        "NEC"
    );

    addEvent(
        {
            id: uid(),
            type: "competition",
            title: "VYROTHON 2026",
            society: "Vyro.ai",
            date: "18-Apr-2026",
            venue: "Vyro Office, NSTP NUST H-12",
            status: "scheduled",
            capacity: 100,
            description: "In-house hackathon with around $5000 prize pool.",
            registrationUrl: "https://vyrothon.vyro.ai/",
            details: { prizePool: "~$5,000 USD", teamSize: 3 },
            registeredStudentIds: [],
            reviews: []
        },
        "Vyro.ai"
    );
}

function renderStats() {
    portalStats.innerHTML =
        '<div class="stat"><b>' + allSocieties.length + '</b><span>Societies</span></div>' +
        '<div class="stat"><b>' + allEvents.length + '</b><span>Events</span></div>' +
        '<div class="stat"><b>' + allStudents.length + '</b><span>Students</span></div>';
}

function getFilteredEvents() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const society = societyFilter.value;

    return allEvents.filter((event) => {
        const typeMatch = type === "all" || event.type === type;
        const societyMatch = society === "all" || event.society === society;
        const queryMatch =
            query.length === 0 ||
            event.title.toLowerCase().includes(query) ||
            event.society.toLowerCase().includes(query) ||
            event.type.toLowerCase().includes(query);
        return typeMatch && societyMatch && queryMatch;
    });
}

function renderSocietyFilter() {
    const previous = societyFilter.value;
    const options = ["<option value=\"all\">All</option>"];
    const societyNames = [...new Set(allEvents.map((event) => event.society))].sort();
    societyNames.forEach((name) => {
        options.push('<option value="' + name + '">' + name + "</option>");
    });
    societyFilter.innerHTML = options.join("");
    if (societyNames.includes(previous)) {
        societyFilter.value = previous;
    }
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
            const avg = canReview(event) ? getAverageRating(event).toFixed(2) : "N/A";
            const linkButton = event.registrationUrl
                ? '<button type="button" class="open-link-btn" data-link="' + event.registrationUrl + '">Open</button>'
                : "-";

            return (
                "<tr>" +
                    "<td>" + (index + 1) + "</td>" +
                    "<td>" + event.title + "</td>" +
                    "<td>" + event.society + "</td>" +
                    "<td><span class=\"pill\">" + event.type + "</span></td>" +
                    "<td><span class=\"pill status-" + event.status + "\">" + event.date + "</span></td>" +
                    "<td>" + event.venue + "</td>" +
                    "<td>" + getAvailableSeats(event) + "</td>" +
                    "<td>" + avg + "</td>" +
                    "<td>" + linkButton + "</td>" +
                "</tr>"
            );
        })
        .join("");
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

function refreshViews() {
    renderStats();
    renderSocietyFilter();
    renderEventTable();
    renderStudentEventSelect();
}

function registerStudentAccount(name, cmsId, email, password, section) {
    if (getStudentByCms(cmsId)) {
        writeConsole("CMS ID already registered.");
        showToast("CMS ID already registered");
        return false;
    }

    allStudents.push({
        name,
        cmsId,
        email,
        password,
        section,
        registeredEventIds: []
    });
    writeConsole("Registration successful. Welcome, " + name + ".");
    showToast("Student registered");
    refreshViews();
    return true;
}

function loginStudent(cmsId, password) {
    const student = allStudents.find((item) => item.cmsId === cmsId && item.password === password) || null;
    if (!student) {
        writeConsole("Invalid CMS ID or password.");
        showToast("Invalid student credentials");
        return null;
    }
    return student;
}

function loginOrganizer(name, password) {
    const society =
        allSocieties.find((item) => item.name.toLowerCase() === name.toLowerCase() && item.password === password) || null;
    if (!society) {
        writeConsole("Invalid society name or password.");
        showToast("Invalid organizer credentials");
        return null;
    }
    return society;
}

function registerStudentForEvent(student, eventId) {
    const event = getEventById(eventId);
    if (!event) {
        writeConsole("Invalid event selection.");
        showToast("Event not found");
        return;
    }
    if (isFull(event)) {
        writeConsole("Sorry, " + event.title + " is full.");
        showToast("Event is full");
        return;
    }
    if (event.registeredStudentIds.includes(student.cmsId)) {
        writeConsole(student.name + " is already registered in " + event.title + ".");
        showToast("Already registered");
        return;
    }

    event.registeredStudentIds.push(student.cmsId);
    if (!student.registeredEventIds.includes(event.id)) {
        student.registeredEventIds.push(event.id);
    }
    writeConsole(student.name + " registered for " + event.title + ".");
    showToast("Registered successfully");
    refreshViews();
}

function cancelRegistration(student, eventId) {
    const event = getEventById(eventId);
    if (!event) {
        writeConsole("Invalid event selection.");
        showToast("Event not found");
        return;
    }

    const before = event.registeredStudentIds.length;
    event.registeredStudentIds = event.registeredStudentIds.filter((cmsId) => cmsId !== student.cmsId);
    student.registeredEventIds = student.registeredEventIds.filter((id) => id !== event.id);

    if (before === event.registeredStudentIds.length) {
        writeConsole(student.name + " was not registered in " + event.title + ".");
        showToast("Student not registered in event");
        return;
    }

    writeConsole(student.name + " removed from " + event.title + ".");
    showToast("Registration cancelled");
    refreshViews();
}

function submitReview(eventId, feedback, rating) {
    const event = getEventById(eventId);
    if (!event) {
        writeConsole("Invalid event selection.");
        showToast("Event not found");
        return;
    }
    if (!canReview(event)) {
        writeConsole("This event does not support reviews.");
        showToast("Reviews not allowed for this event");
        return;
    }
    if (rating < 1 || rating > 5) {
        writeConsole("Rating must be between 1 and 5.");
        showToast("Rating must be 1-5");
        return;
    }

    event.reviews.push({ feedback, rating });
    writeConsole("Review added for " + event.title + ".");
    showToast("Review submitted");
    refreshViews();
}

function displayReviews(eventId) {
    const event = getEventById(eventId);
    if (!event) {
        writeConsole("Invalid event selection.");
        return;
    }
    if (!canReview(event)) {
        writeConsole("This event does not support reviews.");
        return;
    }
    if (!event.reviews.length) {
        writeConsole("No reviews yet for " + event.title + ".");
        return;
    }

    const lines = event.reviews.map((review, i) => "  " + (i + 1) + ". " + review.feedback + " | " + review.rating + "/5");
    writeConsole("Reviews for " + event.title + ":\n" + lines.join("\n"));
}

function showProfile(student) {
    const lines = [
        "Name: " + student.name,
        "CMS ID: " + student.cmsId,
        "Email: " + student.email,
        "Section: " + student.section,
        "Registered Events: " + student.registeredEventIds.length
    ];
    if (student.registeredEventIds.length) {
        student.registeredEventIds.forEach((eventId) => {
            const event = getEventById(eventId);
            if (event) {
                lines.push("  - " + event.title + " | " + event.date);
            }
        });
    }
    writeConsole(lines.join("\n"));
}

function showUpcoming(student) {
    if (!student.registeredEventIds.length) {
        writeConsole("You have no upcoming events.");
        return;
    }
    const lines = ["Your Upcoming Events:"];
    student.registeredEventIds.forEach((eventId) => {
        const event = getEventById(eventId);
        if (event) {
            lines.push("  - " + event.title + " | " + event.date + " | " + event.venue);
        }
    });
    writeConsole(lines.join("\n"));
}

function updateStudentSessionUI() {
    if (!loggedInStudent) {
        studentSessionLabel.textContent = "Not logged in";
        studentActions.classList.add("hidden");
        return;
    }
    studentSessionLabel.textContent = "Logged in: " + loggedInStudent.name + " (" + loggedInStudent.cmsId + ")";
    studentActions.classList.remove("hidden");
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

function setRole(role) {
    document.querySelectorAll(".role-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.role === role);
    });

    document.querySelectorAll(".role-panel").forEach((panel) => {
        panel.classList.remove("active");
    });

    if (role === "guest") {
        document.getElementById("guestPanel").classList.add("active");
    }
    if (role === "student") {
        document.getElementById("studentPanel").classList.add("active");
    }
    if (role === "organizer") {
        document.getElementById("organizerPanel").classList.add("active");
    }
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

    studentRegisterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(studentRegisterForm);
        registerStudentAccount(
            String(formData.get("name") || "").trim(),
            String(formData.get("cmsId") || "").trim(),
            String(formData.get("email") || "").trim(),
            String(formData.get("password") || "").trim(),
            String(formData.get("section") || "").trim()
        );
        studentRegisterForm.reset();
    });

    studentLoginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(studentLoginForm);
        const cmsId = String(formData.get("cmsId") || "").trim();
        const password = String(formData.get("password") || "").trim();
        const student = loginStudent(cmsId, password);
        if (student) {
            loggedInStudent = student;
            writeConsole("Login successful. Welcome back, " + student.name + ".");
            showToast("Student login successful");
        }
        updateStudentSessionUI();
        studentLoginForm.reset();
    });

    document.getElementById("registerEventBtn").addEventListener("click", () => {
        if (!loggedInStudent) {
            showToast("Login as student first");
            return;
        }
        registerStudentForEvent(loggedInStudent, studentEventSelect.value);
    });

    document.getElementById("cancelEventBtn").addEventListener("click", () => {
        if (!loggedInStudent) {
            showToast("Login as student first");
            return;
        }
        cancelRegistration(loggedInStudent, studentEventSelect.value);
    });

    document.getElementById("submitReviewBtn").addEventListener("click", () => {
        if (!loggedInStudent) {
            showToast("Login as student first");
            return;
        }
        submitReview(studentEventSelect.value, reviewText.value.trim(), Number(reviewRating.value));
        reviewText.value = "";
        reviewRating.value = "5";
    });

    document.getElementById("viewReviewsBtn").addEventListener("click", () => {
        displayReviews(studentEventSelect.value);
    });

    document.getElementById("profileBtn").addEventListener("click", () => {
        if (loggedInStudent) {
            showProfile(loggedInStudent);
        }
    });

    document.getElementById("upcomingBtn").addEventListener("click", () => {
        if (loggedInStudent) {
            showUpcoming(loggedInStudent);
        }
    });

    document.getElementById("studentLogoutBtn").addEventListener("click", () => {
        loggedInStudent = null;
        updateStudentSessionUI();
        showToast("Student logged out");
    });

    organizerLoginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(organizerLoginForm);
        const societyName = organizerSocietySelect.value;
        const password = String(formData.get("password") || "").trim();
        const society = loginOrganizer(societyName, password);
        if (society) {
            loggedInOrganizer = society;
            writeConsole("Organizer login successful. Welcome, " + society.name + ".");
            showToast("Organizer login successful");
        }
        updateOrganizerSessionUI();
        organizerLoginForm.reset();
    });

    document.getElementById("myEventsBtn").addEventListener("click", () => {
        if (!loggedInOrganizer) {
            return;
        }
        if (!loggedInOrganizer.eventIds.length) {
            writeConsole(loggedInOrganizer.name + " has no events yet.");
            return;
        }
        const lines = ["Events by " + loggedInOrganizer.name + ":"];
        loggedInOrganizer.eventIds.forEach((eventId, i) => {
            const event = getEventById(eventId);
            if (event) {
                lines.push("  " + (i + 1) + ". " + event.title + " | " + event.date);
            }
        });
        writeConsole(lines.join("\n"));
    });

    document.getElementById("attendeesBtn").addEventListener("click", () => {
        if (!loggedInOrganizer) {
            return;
        }
        if (!loggedInOrganizer.eventIds.length) {
            writeConsole("Your society has no events yet.");
            return;
        }

        const lines = [];
        loggedInOrganizer.eventIds.forEach((eventId) => {
            const event = getEventById(eventId);
            if (!event) {
                return;
            }
            lines.push("Attendees for " + event.title + ":");
            if (!event.registeredStudentIds.length) {
                lines.push("  No attendees yet.");
                return;
            }
            event.registeredStudentIds.forEach((cmsId, i) => {
                const student = getStudentByCms(cmsId);
                if (student) {
                    lines.push("  " + (i + 1) + ". " + student.name + " (" + student.cmsId + ") | " + student.email);
                }
            });
        });
        writeConsole(lines.join("\n"));
    });

    document.getElementById("organizerLogoutBtn").addEventListener("click", () => {
        loggedInOrganizer = null;
        updateOrganizerSessionUI();
        showToast("Organizer logged out");
    });

    newEventType.addEventListener("change", updateAddEventFieldHints);

    addEventForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!loggedInOrganizer) {
            showToast("Login as organizer first");
            return;
        }

        const type = newEventType.value;
        const title = document.getElementById("newEventTitle").value.trim();
        const date = document.getElementById("newEventDate").value.trim();
        const venue = document.getElementById("newEventVenue").value.trim();
        const capacity = Number(document.getElementById("newEventCapacity").value.trim());
        const description = document.getElementById("newEventDescription").value.trim();
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

        const newEvent = {
            id: uid(),
            type,
            title,
            society: loggedInOrganizer.name,
            date,
            venue,
            status: "scheduled",
            capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 50,
            description,
            registrationUrl: "",
            details,
            registeredStudentIds: [],
            reviews: []
        };

        addEvent(newEvent, loggedInOrganizer.name);
        refreshViews();
        addEventForm.reset();
        updateAddEventFieldHints();
        writeConsole('Event "' + newEvent.title + '" added successfully.');
        showToast("Event added");
    });
}

seedEvents();
renderOrganizerSocieties();
refreshViews();
bindEvents();
updateAddEventFieldHints();
updateStudentSessionUI();
updateOrganizerSessionUI();
setRole("guest");
writeConsole("Portal initialized with 8 societies and 4 events.");