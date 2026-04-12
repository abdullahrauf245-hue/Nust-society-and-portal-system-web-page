               My first ever Web Page Deployment

# NUST Events & Society Portal — Web Frontend

A browser-based companion to the Java OOP terminal project. Built with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies.

---

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure — event table, role tabs, console output |
| `style.css` | Dark theme, layout, table, pills, toast |
| `script.js` | All logic — events, students, societies, filters |

---

## How to Run

Download all three files into the same folder, then open `index.html` in any browser. No server or install needed.

---

## Features

### Events Table
- Live search by title, society, or type
- Filter by event type (Workshop / Concert / Competition / Seminar)
- Filter by society
- Status pills — Scheduled, Expected, Delayed
- Seats remaining, average rating, external registration link

### Guest
Browse and filter all events without an account.

### Student
- Register an account (Name, CMS ID, Email, Password, Section)
- Login / Logout
- Register or cancel registration for any event
- Submit and view reviews (Workshop, Competition, Seminar only)
- View profile summary
- View upcoming registered events

### Organizer
- Login with society name and password
- View all events belonging to your society
- View attendee list per event
- Add new events — Workshop, Concert, Competition, Seminar
  - Type-specific fields update automatically (e.g. Performer/Genre for Concert, Prize Pool/Team Size for Competition)

### Console Output
Every action prints a timestamped log line to the on-screen console panel.

---

## Preloaded Events

| Event | Society | Type | Status |
|---|---|---|---|
| NUST Music Fest (NMF) | NUST Music Society | Concert | Delayed — orig. 21-22 Apr 2026 |
| HAAMI 2026 | RIC | Concert | Delayed — orig. 2-3 Apr 2026 |
| AIcon 2026 | NEC | Competition | Expected end of April 2026 |
| VYROTHON 2026 | Vyro.ai | Competition | 18-Apr-2026 — [Register here](https://vyrothon.vyro.ai/) |

---

## Organizer Credentials

| Society | Password |
|---|---|
| NUST Music Society | nms123 |
| RIC | ric123 |
| NEC | nec123 |
| ACM | acm123 |
| Vyro.ai | vyro123 |
| IEEE | ieee123 |
| SOULS | souls123 |
| AND | and123 |

---

## Logic Notes

- Reviews are only supported on Workshop, Competition, and Seminar — not Concert (matches Java `Reviewable` interface design)
- A student can only review an event once; submitting again updates their existing review
- Event IDs are auto-generated as `evt-0001`, `evt-0002`, etc.
- All state is in-memory — refreshing the page resets to the 4 preloaded events

---

## OOP Concepts Mirrored

| Java Concept | JavaScript Equivalent |
|---|---|
| `Registerable` interface | `availableSeats()`, `registerForEvent()`, `cancelEventRegistration()` |
| `Reviewable` interface | `REVIEWABLE_TYPES` set — only allowed types can be reviewed |
| Abstract `Event` class | Shared event object shape with type-specific `details` field |
| `Logic.java` methods | Functions in `script.js` — `registerStudentAccount`, `loginStudent`, `loginOrganizer`, etc. |
| `Student.java` | Student objects with `registeredEventIds` array |
| `Society.java` | Society objects with `eventIds` array |

---

## Course Info

**Course:** CS-202-Object Oriented Programming  
**Project:** End Semester Project — NUST Events & Society Portal  
**Campus:** SEECS, NUST H-12 Islamabad
