DROP TABLE IF EXISTS Gallery;
DROP TABLE IF EXISTS Image;
DROP TABLE IF EXISTS Element;
DROP TABLE IF EXISTS InpaintImage;

CREATE TABLE Gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);
INSERT INTO Gallery (id, name) VALUES (0, 'default');

CREATE TABLE Image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_id INTEGER NOT NULL,

    name TEXT NOT NULL,
    data BLOB NOT NULL,
    FOREIGN KEY (gallery_id) REFERENCES Gallery (id) ON DELETE CASCADE
);

CREATE TABLE Element (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,

    top REAL NOT NULL,
    left REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    angle REAL NOT NULL,
    -- category: text, underlay, title, logo
    category TEXT NOT NULL, 
    content TEXT NOT NULL,
    FOREIGN KEY (image_id) REFERENCES Image (id) ON DELETE CASCADE
);

CREATE TABLE InpaintImage (
    image_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    data BLOB NOT NULL,
    FOREIGN KEY (image_id) REFERENCES Image (id)
);

