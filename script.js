// Data: Acts like your ArrayList<Event>
let events = [
    { title: "VYROTHON 2026", type: "Competition", venue: "NSTP NUST", date: "April 18" },
    { title: "NUST Music Fest", type: "Concert", venue: "Amphitheatre", date: "Late April" }
];

// Switch between Dashboard and Admin
function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    document.getElementById('nav-' + sectionId).classList.add('active');
}

// Render Events to the Grid
function renderEvents() {
    const grid = document.getElementById('eventGrid');
    grid.innerHTML = ''; 

    events.forEach((ev) => {
        const card = document.createElement('div');
        card.className = `card ${ev.type.toLowerCase()}`;
        card.innerHTML = `
            <div>
                <span class="badge">${ev.type}</span>
                <h3>${ev.title}</h3>
                <p>${ev.venue} | ${ev.date}</p>
            </div>
            <button class="btn-submit" onclick="alert('Registered for ${ev.title}!')">Register</button>
        `;
        grid.appendChild(card);
    });
}

// Logic to add a new Event
function handleCreateEvent() {
    const title = document.getElementById('formTitle').value;
    const type = document.getElementById('formType').value;
    const venue = document.getElementById('formVenue').value;

    if(title && venue) {
        events.push({ title, type, venue, date: "TBD" });
        showSection('dashboard');
        renderEvents();
        document.getElementById('createEventForm').reset();
    } else {
        alert("Please fill in all fields.");
    }
}

// Start the app
renderEvents();