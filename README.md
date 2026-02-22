# Media Tracker

A self-hosted media tracking application for managing your personal collection of Movies, TV Shows, Books, Games, and Albums. Built with a FastAPI backend and a vanilla JavaScript single-page frontend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.x, SQLite |
| Frontend | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| Server | Uvicorn (ASGI) |

---

## Installation & Running

### Prerequisites
- Python 3.13+

### Steps

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server
python run.py
```

The app will be available at **http://127.0.0.1:8765**

The SQLite database is created automatically at `data/media_tracker.db` on first run, with built-in categories and default field list values pre-seeded.

---

## Features

- **5 built-in media categories**: Movies, TV Shows, Books, Games, Albums
- **Custom categories**: Add your own with custom icon and color
- **Status tracking**: Wishlist / Owned
- **Letter-grade ratings**: F, D−, D, D+, C−, C, C+, B−, B, B+, A−, A, A+
- **Tags**: Fully user-managed, color-coded, multi-tag support
- **User-defined field lists**: All metadata dropdowns (Genre, Director, Platform, etc.) are backed by user-managed pick-lists
- **Per-category Genres**: Each category has its own genre list
- **Albums Sub-Genre**: Albums have an additional sub-genre field
- **Cast list**: Shared multi-value field list for Movies and TV Shows
- **Field Lists management**: Dedicated Settings page — organized into Genre, Sub-Genre, Format (shared), Cast (shared), and Unique Lists sections
- **Cover images**: File upload (JPG, PNG, GIF, WebP) served from local storage
- **Search**: Full-text search across titles and notes
- **Filters**: Filter by status and letter-grade rating
- **Sort**: Multiple sort options (newest, oldest, A–Z, highest rated, etc.)
- **Grid and list views** — category-aware image shapes (square for Albums, portrait for others); full image visible; richer metadata per entry
- **Dashboard**: Stats overview with item counts by status and category

---

## Project Structure

```
media-tracker/
├── backend/
│   ├── main.py            # FastAPI app, router registration, static file serving
│   ├── database.py        # SQLAlchemy engine, session, DB init, data seeding
│   ├── models.py          # SQLAlchemy ORM models
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── crud.py            # Database CRUD operations
│   └── routers/
│       ├── media.py       # Media item endpoints
│       ├── categories.py  # Category endpoints
│       ├── tags.py        # Tag endpoints
│       ├── stats.py       # Dashboard stats endpoints
│       └── field_values.py # Field list value endpoints
├── frontend/
│   ├── index.html
│   ├── css/
│   │   ├── main.css       # Layout, sidebar, base styles
│   │   └── components.css # Buttons, cards, forms, modal, settings page
│   └── js/
│       ├── app.js         # Router, sidebar, init
│       ├── state.js       # Shared state (categories, tags) and event bus
│       ├── api.js         # All fetch() wrappers for backend API
│       └── views/
│           ├── dashboard.js
│           ├── library.js
│           ├── categories.js
│           └── settings.js  # Field Lists management page
│       └── components/
│           ├── modal.js     # Add/Edit Media modal form
│           ├── rating.js    # Star rating widget
│           └── toast.js     # Notification toasts
├── data/                  # SQLite database (auto-created)
├── requirements.txt
└── run.py                 # Server launcher
```

---

## Change History

### 2026-02-22

#### Feature: Improved Tile and Row Display

**Category-Aware Image Shapes**
- Grid cards and list thumbnails now use category-specific aspect ratios: square (1:1) for Albums/Music categories, portrait (2:3) for all others (Movies, Books, Games, TV Shows, custom categories)
- Images changed from `object-fit: cover` (cropped) to `object-fit: contain` (full image visible, letterboxed against the card background) — ensures no part of the uploaded cover is cut off

**Richer Metadata in Grid Cards**
- Creator line added below the title — shows the most relevant creator field: Artist (Albums), Author (Books), Director (Movies), Developer (Games)
- Secondary info line shows Year and Genre beneath the status/rating row
- Tag chips (up to 3) displayed at the bottom of the card body, coloured to match each tag
- Grid minimum card width increased from 160 px to 175 px to accommodate the extra lines

**Richer Metadata in List Rows**
- Subtitle now shows: `Category · Creator · Year · Genre` instead of just category name
- Tag chips (up to 3) displayed below the subtitle within the title cell
- Thumbnail column widened to 48 px to fit the larger square Album thumbnails

**Files changed:** `frontend/js/views/library.js`, `frontend/css/components.css`

---

### 2026-02-21

#### Feature: Add Media Form & Field Lists Redesign

**Rating System**
- Star ratings (1–5) replaced with letter-grade system: F, D−, D, D+, C−, C, C+, B−, B, B+, A−, A, A+
- `rating` DB column changed from Integer to String; Pydantic schemas updated accordingly
- Rating filter sidebar updated to grade-based exact-match filter
- Dashboard rating distribution updated to show all 13 grade buckets

**Cover Image Upload**
- Cover Image field changed from URL text input to file upload (JPG, PNG, GIF, WebP)
- New backend endpoint: `POST /api/upload/cover` — saves file to `data/uploads/`, returns `{ url }`
- New static mount: `/uploads` serves uploaded cover images
- Existing `cover_image_url` DB column unchanged — now stores `/uploads/filename` path

**Movies Form Changes**
- Language field removed
- Cast field added — multi-value `<select multiple>` backed by new shared "Cast" Field List
- Cast values stored as a JSON array in `metadata.cast`

**TV Shows Form Changes**
- Network, Studio, Language, and Seasons fields removed
- Format field added — dropdown backed by the shared `format_movie` Field List (same as Movies)
- Cast field added — multi-value `<select multiple>` backed by the shared "Cast" Field List
- Year field was already present; retained

**Books Form Changes**
- Year field added
- Pages field removed

**Games Form Changes**
- Year field added
- Format field added — dropdown backed by new `format_game` Field List

**Albums Form Changes**
- Format field added — dropdown backed by new `format_album` Field List
- Label Code field added — plain text input

**Field Lists Seeds**
- New shared seeds: `format_game` (Physical, Digital, Cartridge, Disc), `format_album` (Vinyl, CD, Cassette, Digital, Streaming, 8-Track), `cast` (empty — user-populated)
- Removed seeds: `language`, `network`

**Field Lists Settings Page Reorganization**
- New nav group structure:
  - **Genre (per category)** — one entry per category (unchanged)
  - **Sub-Genre** — Albums only (unchanged)
  - **Format (shared)** — four sub-entries: Movies & TV Shows (`format_movie`), Books (`format_book`), Games (`format_game`), Albums (`format_album`)
  - **Cast (shared)** — single list used by Movies and TV Shows
  - **Unique Lists** — Directors, Studios (Movies); Authors (Books); Publishers (Books + Games); Developers, Platforms (Games); Artists, Record Labels (Albums)

### 2026-02-19

#### Bug Fixes
- **Fixed Field Lists page showing Dashboard instead of field lists** — Root cause was a circular ES module dependency: `settings.js` imported from `app.js`, which imported from `settings.js`. This was resolved by extracting shared state into a new `state.js` module. All views now import `state` and `bus` from `state.js` instead of `app.js`.
- **Fixed Dashboard showing blank/missing status stat cards** — `dashboard.js` still had the old four-status labels (`in_progress`, `completed`, `dropped`) which the backend no longer returns. Updated to `wishlist` and `owned` only.
- **Fixed "Recently Completed" section always empty** — Backend `get_recent_completed()` was filtering by `status == "completed"` which no longer exists. Changed to filter by `status == "owned"`. Section renamed to "Recently Owned".

#### New Files
- `frontend/js/state.js` — Dedicated module for shared application state (`state`, `bus`) to prevent circular import issues.

---

#### Feature: User-Defined Field Lists, Genre, Sub-Genre & Status Changes

**Status**
- Replaced the four status options (Wishlist, In Progress, Completed, Dropped) with two: **Wishlist** and **Owned**
- Date Started / Date Finished fields removed from the Add Media form
- Status filter sidebar updated to Wishlist / Owned only
- Dashboard stat cards updated

**Genre on every category**
- Every built-in category (Movies, TV Shows, Books, Games, Albums) now has a Genre dropdown in the Add Media form
- Genre values are per-category (Movies has its own genre list, Games has its own, etc.)
- Default genres are pre-seeded for all five built-in categories

**Albums Sub-Genre**
- Albums now has an additional Sub-Genre dropdown
- Default sub-genres pre-seeded (Indie Rock, Classic Rock, House, Techno, Bebop, etc.)

**User-Defined Field Lists**
- All "enterable" metadata fields are now backed by user-managed pick-lists instead of free-text inputs
- Fields still using plain inputs (exempt from pick-lists): ISBN, Pages, Seasons, Year, Runtime, Notes/Review
- New dropdown fields per category:
  - **Books**: Author, Publisher, Format (Hardcover/eBook/etc.), Genre
  - **Movies**: Director, Studio, Language, Format (Blu-ray/Stream/etc.), Genre
  - **Games**: Developer, Publisher, Platform, Genre
  - **Albums**: Artist, Label, Genre, Sub-Genre
  - **TV Shows**: Network, Studio, Language, Genre
- Default values pre-seeded for all shared lists (common studios, platforms, networks, etc.)

**Field Lists Settings Page**
- New "Field Lists" link in the Settings sidebar section
- Dedicated page to manage all field list values
- Sections: Genre (per category), Sub-Genre (Albums), and all shared lists
- Per-value actions: Add new value, Rename (inline), Delete

**Backend**
- New `field_values` database table (`id`, `field_type`, `category_id`, `value`, `sort_order`)
- New API endpoints: `GET/POST /api/field-values`, `PUT/DELETE /api/field-values/{id}`
- Pydantic schemas: `FieldValueCreate`, `FieldValueUpdate`, `FieldValueRead`
- `requirements.txt`: `pydantic==2.7.1` → `pydantic>=2.9.0`, `sqlalchemy==2.0.30` → `sqlalchemy>=2.0.36` (Python 3.13 compatibility)
