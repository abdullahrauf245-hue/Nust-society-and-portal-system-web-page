const events = [
    {
        id: "nmf",
        title: "NUST Music Fest (NMF)",
        type: "concert",
        society: "NUST Music Society",
        status: "delayed",
        date: "Originally 21-22 April",
        venue: "NUST Main Campus",
        details: "Large-scale annual music celebration.",
        seats: 480
    },
    {
        id: "haami",
        title: "HAAMI 2026",
        type: "concert",
        society: "RIC",
        status: "delayed",
        date: "Originally 2-3 April",
        venue: "NUST Ground",
        details: "Hassan Raheem was announced. Event postponed due to Iran-US conflict.",
        seats: 320
    },
    {
        id: "aicon",
        title: "AIcon 2026",
        type: "competition",
        society: "NEC + ACM + Hack Club",
        status: "expected",
        date: "Expected end of April",
        venue: "SEECS, NUST",
        details: "AI-focused challenge and showcase for student teams.",
        seats: 240
    },
    {
        id: "vyrothon",
        title: "VYROTHON 2026",
        type: "competition",
        society: "Vyro.ai",
        status: "scheduled",
        date: "18 April",
        venue: "NSTP, NUST",
        details: "Approx. $5000 prize pool. More at vyrothon.vyro.ai",
        seats: 190,
        registrationUrl: "https://vyrothon.vyro.ai/"
    }
];

const societies = [
    { name: "NUST Music Society", password: "nms123" },
    { name: "RIC", password: "ric123" },
    { name: "NEC", password: "nec123" },
    { name: "ACM", password: "acm123" },
    { name: "Vyro.ai", password: "vyro123" },
    { name: "IEEE", password: "ieee123" },
    { name: "SOULS", password: "souls123" },
    { name: "AND", password: "and123" }
];

const roleContent = {
    guest: {
        heading: "Guest Access",
        text: "Browse all upcoming events, apply search/filter, and explore societies without login.",
        points: [
            "View event details and schedule status",
            "Search by title, venue, society, or event type",
            "Quick preview of campus activity"
        ]
    },
    student: {
        heading: "Student Access",
        text: "Students can register/login, join events, cancel registration, and submit reviews.",
        points: [
            "Account details: name, CMS ID, email, section",
            "Track registered events from personal profile",
            "Rate and review reviewable event types"
        ]
    },
    organizer: {
        heading: "Organizer Access",
        text: "Society organizers can authenticate, add events, and monitor attendee lists.",
        points: [
            "Create and manage society events",
            "View event-wise attendee lists",
            "Control active status and seat capacity"
        ]
    }
};

const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const eventGrid = document.getElementById("eventGrid");
const resultCounter = document.getElementById("resultCounter");
const toastEl = document.getElementById("toast");
const societyList = document.getElementById("societyList");
const rolePanel = document.getElementById("rolePanel");

let toastTimeout;

function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFilteredEvents() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const selectedStatus = statusFilter.value;

    return events.filter((event) => {
        const typeMatch = selectedType === "all" || event.type === selectedType;
        const statusMatch = selectedStatus === "all" || event.status === selectedStatus;
        const queryMatch =
            query.length === 0 ||
            event.title.toLowerCase().includes(query) ||
            event.society.toLowerCase().includes(query) ||
            event.venue.toLowerCase().includes(query) ||
            event.type.toLowerCase().includes(query);

        return typeMatch && statusMatch && queryMatch;
    });
}

function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2300);
}

function handleRegister(eventId) {
    const target = events.find((event) => event.id === eventId);

    if (!target) {
        showToast("Event not found.");
        return;
    }

    if (target.seats <= 0) {
        showToast("This event is full.");
        return;
    }

    target.seats -= 1;
    showToast("Registered for " + target.title + " successfully.");
    renderEvents();
}

function renderEvents() {
    const filteredEvents = getFilteredEvents();
    eventGrid.innerHTML = "";
    resultCounter.textContent = "Showing " + filteredEvents.length + " event" + (filteredEvents.length === 1 ? "" : "s");

    if (filteredEvents.length === 0) {
        eventGrid.innerHTML = '<article class="empty-state"><h3>No events found</h3><p>Try different filters or search terms.</p></article>';
        return;
    }

    filteredEvents.forEach((event, index) => {
        const card = document.createElement("article");
        card.className = "event-card" + (event.registrationUrl ? " has-link" : "");
        card.dataset.eventId = event.id;
        card.style.animationDelay = index * 40 + "ms";

        const typeLabel = titleCase(event.type);
        const statusLabel = titleCase(event.status);

        card.innerHTML =
            '<div class="event-meta">' +
                '<span class="chip type-' + event.type + '">' + typeLabel + '</span>' +
                '<span class="chip status-' + event.status + '">' + statusLabel + '</span>' +
            "</div>" +
            "<div>" +
                "<h3>" + event.title + "</h3>" +
                "<p>" + event.details + "</p>" +
            "</div>" +
            '<div class="event-details">' +
                "<span>Society: " + event.society + "</span>" +
                "<span>Date: " + event.date + "</span>" +
                "<span>Venue: " + event.venue + "</span>" +
            "</div>" +
            '<div class="event-bottom">' +
                '<span class="seats">Seats left: ' + event.seats + "</span>" +
                '<button type="button" class="primary-btn" data-register-id="' + event.id + '">Register</button>' +
            "</div>";

        eventGrid.appendChild(card);
    });
}

function renderSocieties() {
    societyList.innerHTML = societies
        .map((society) => {
            return (
                '<article class="society-tile">' +
                    "<p>" + society.name + "</p>" +
                    "<span>Password: " + society.password + "</span>" +
                "</article>"
            );
        })
        .join("");
}

function setRole(role) {
    const data = roleContent[role];
    if (!data) {
        return;
    }

    rolePanel.innerHTML =
        "<h3>" + data.heading + "</h3>" +
        "<p>" + data.text + "</p>" +
        "<ul>" + data.points.map((point) => "<li>" + point + "</li>").join("") + "</ul>";

    document.querySelectorAll(".role-tab").forEach((tab) => {
        const isActive = tab.dataset.role === role;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
}

function bindEvents() {
    searchInput.addEventListener("input", renderEvents);
    typeFilter.addEventListener("change", renderEvents);
    statusFilter.addEventListener("change", renderEvents);

    resetFiltersBtn.addEventListener("click", () => {
        searchInput.value = "";
        typeFilter.value = "all";
        statusFilter.value = "all";
        renderEvents();
    });

    document.querySelectorAll(".role-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            setRole(tab.dataset.role);
        });
    });

    eventGrid.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-register-id]");
        if (button) {
            handleRegister(button.dataset.registerId);
            return;
        }

        const card = event.target.closest(".event-card[data-event-id]");
        if (!card) {
            return;
        }

        const targetEvent = events.find((entry) => entry.id === card.dataset.eventId);
        if (targetEvent && targetEvent.registrationUrl) {
            window.open(targetEvent.registrationUrl, "_blank", "noopener");
        }
    });
}

bindEvents();
renderEvents();
renderSocieties();
setRole("guest");