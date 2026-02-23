from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .models import Base, Category, FieldValue

# Resolve DB path relative to this file's location
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "media_tracker.db"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    # SQLite only allows one thread to use a connection by default.
    # FastAPI can serve requests from multiple threads, so this must be False.
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

BUILTIN_CATEGORIES = [
    {"name": "Movies",   "icon": "🎬", "color": "#ef4444", "is_system": 1},
    {"name": "TV Shows", "icon": "📺", "color": "#f97316", "is_system": 1},
    {"name": "Books",    "icon": "📚", "color": "#22c55e", "is_system": 1},
    {"name": "Games",    "icon": "🎮", "color": "#3b82f6", "is_system": 1},
    {"name": "Albums",   "icon": "🎵", "color": "#a855f7", "is_system": 1},
]

# Per-category genre seeds  {category_name: [values]}
GENRE_SEEDS = {
    "Movies":   ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
                 "Drama", "Fantasy", "Horror", "Musical", "Romance", "Sci-Fi",
                 "Thriller", "Western"],
    "TV Shows": ["Action", "Anime", "Comedy", "Crime", "Documentary", "Drama",
                 "Fantasy", "Horror", "Reality", "Sci-Fi", "Thriller"],
    "Books":    ["Biography", "Fantasy", "Fiction", "Graphic Novel", "History",
                 "Horror", "Mystery", "Non-Fiction", "Romance", "Sci-Fi",
                 "Self-Help", "Thriller", "Travel"],
    "Games":    ["Action", "Adventure", "Fighting", "FPS", "Horror", "MMORPG",
                 "Platformer", "Puzzle", "Racing", "RPG", "Simulation",
                 "Sports", "Strategy"],
    "Albums":   ["Blues", "Classical", "Country", "Electronic", "Folk", "Hip-Hop",
                 "Jazz", "Metal", "Pop", "Punk", "R&B", "Reggae", "Rock", "Soul"],
}

# Per-category sub-genre seeds (Albums only for now)
SUB_GENRE_SEEDS = {
    "Albums": ["Ambient", "Bebop", "Classic Rock", "Death Metal", "Deep House",
               "Drum & Bass", "Funk", "Gospel", "Hard Rock", "Hardcore",
               "House", "Indie Pop", "Indie Rock", "Lo-fi", "New Wave",
               "Post-Rock", "Progressive Rock", "Synthpop", "Techno", "Trip-Hop"],
}

# Shared (category_id=NULL) field value seeds  {field_type: [values]}
SHARED_SEEDS = {
    "author":       ["Unknown Author"],
    "publisher":    ["Penguin Random House", "HarperCollins", "Simon & Schuster",
                     "Macmillan", "Hachette", "Self-Published"],
    "format_book":  ["Hardcover", "Paperback", "eBook", "Audiobook", "Large Print"],
    "director":     ["Unknown Director"],
    "studio":       ["Warner Bros.", "Universal Pictures", "Sony Pictures",
                     "Paramount Pictures", "Walt Disney Studios", "A24",
                     "Netflix", "Amazon Studios", "Apple TV+", "HBO"],
    "format_movie": ["Blu-ray", "DVD", "Digital", "Streaming", "4K UHD", "VHS"],
    "developer":    ["Unknown Developer", "Nintendo", "Valve", "CD Projekt Red",
                     "Rockstar Games", "Naughty Dog", "FromSoftware",
                     "Bethesda", "Ubisoft", "EA", "Activision", "Capcom"],
    "platform":     ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X",
                     "Xbox One", "Nintendo Switch", "Nintendo 3DS", "iOS",
                     "Android", "Steam Deck"],
    "format_game":  ["Physical", "Digital", "Cartridge", "Disc"],
    "artist":       ["Unknown Artist"],
    "label":        ["Unknown Label", "Columbia Records", "Universal Music",
                     "Warner Music", "Sony Music", "Republic Records",
                     "Atlantic Records", "Def Jam", "Sub Pop", "Domino Records"],
    "format_album": ["Vinyl", "CD", "Cassette", "Digital", "Streaming", "8-Track"],
    "cast":         [],
}


def _seed_field_values(db):
    """Seed default field values if the field_values table is empty."""
    existing = db.query(FieldValue).count()
    if existing > 0:
        # Guard makes seeding idempotent — safe to call on every app startup
        # without risking duplicate rows.
        return

    # Category-scoped genre + sub_genre
    cats = {c.name: c.id for c in db.query(Category).all()}

    for cat_name, genres in GENRE_SEEDS.items():
        cat_id = cats.get(cat_name)
        if cat_id is None:
            continue
        for i, g in enumerate(genres):
            db.add(FieldValue(field_type="genre", category_id=cat_id, value=g, sort_order=i))

    for cat_name, sub_genres in SUB_GENRE_SEEDS.items():
        cat_id = cats.get(cat_name)
        if cat_id is None:
            continue
        for i, sg in enumerate(sub_genres):
            db.add(FieldValue(field_type="sub_genre", category_id=cat_id, value=sg, sort_order=i))

    # Shared (global) field values
    for field_type, values in SHARED_SEEDS.items():
        for i, v in enumerate(values):
            db.add(FieldValue(field_type=field_type, category_id=None, value=v, sort_order=i))

    db.commit()


def init_db():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # WAL (Write-Ahead Log) mode lets readers and one writer run concurrently
        # without blocking each other, which is important for a web server.
        conn.execute(text("PRAGMA journal_mode=WAL"))
        # SQLite does NOT enforce foreign keys by default; this pragma enables
        # ondelete="CASCADE" to actually work on every connection.
        conn.execute(text("PRAGMA foreign_keys=ON"))

    # Seed built-in categories if none exist
    with SessionLocal() as db:
        if db.query(Category).count() == 0:
            for cat_data in BUILTIN_CATEGORIES:
                db.add(Category(**cat_data))
            db.commit()

        # Seed default field values
        _seed_field_values(db)


def purge_orphaned_uploads() -> None:
    """Delete upload files that are no longer referenced by any media item.

    Runs at server startup so files left behind by cancelled edits, mid-edit
    image replacements, or previous bugs are cleaned up before the app begins
    serving requests.
    """
    # Collect the bare filename portion of every /uploads/... URL in the DB.
    with SessionLocal() as db:
        rows = db.execute(
            text("SELECT cover_image_url FROM media_items WHERE cover_image_url LIKE '/uploads/%'")
        ).fetchall()
    referenced = {row[0].removeprefix("/uploads/") for row in rows}

    for f in UPLOADS_DIR.iterdir():
        if f.is_file() and f.name not in referenced:
            try:
                f.unlink(missing_ok=True)
            except OSError:
                pass  # Best-effort; a locked or missing file is not fatal


def get_db():
    """FastAPI dependency that provides a database session per request.

    The try/finally generator pattern guarantees the session is always closed,
    even if the route handler raises an exception. FastAPI calls next() to run
    the route, then resumes here after the response is sent.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
