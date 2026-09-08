import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import sharp from 'sharp';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'uncle_jims_estate_secret_key_2026';
const PORT = process.env.PORT || 3001;

// Ensure storage directories exist
let STORAGE_ROOT = process.env.STORAGE_ROOT;
if (!STORAGE_ROOT) {
  // Auto-detect Render persistent disk if the user forgot to set the Env Var
  if (fs.existsSync('/opt/render/project/src/uploads') && process.env.RENDER) {
    STORAGE_ROOT = '/opt/render/project/src/uploads';
  } else {
    STORAGE_ROOT = __dirname;
  }
}

const DATA_DIR = path.join(STORAGE_ROOT, 'data');
const UPLOADS_DIR = path.join(STORAGE_ROOT, 'uploads');
const FULL_UPLOADS_DIR = path.join(UPLOADS_DIR, 'full');
const THUMB_UPLOADS_DIR = path.join(UPLOADS_DIR, 'thumbs');

[DATA_DIR, UPLOADS_DIR, FULL_UPLOADS_DIR, THUMB_UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize SQLite Database
const dbPath = path.join(DATA_DIR, 'estate.db');
const db = new sqlite3.Database(dbPath);

// Helper for promise-based DB queries
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Initialize Schema and Seed Data
async function initDatabase() {
  db.serialize(async () => {
    db.run(`CREATE TABLE IF NOT EXISTS estates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      estate_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'reviewer',
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      estate_id TEXT,
      name TEXT NOT NULL,
      icon TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      estate_id TEXT,
      parent_id TEXT,
      item_number TEXT,
      title TEXT NOT NULL,
      category_id TEXT,
      location_in_house TEXT,
      condition TEXT,
      dimensions TEXT,
      weight TEXT,
      special_handling_notes TEXT,
      description TEXT,
      value TEXT,
      status TEXT DEFAULT 'draft',
      is_high_value INTEGER DEFAULT 0,
      release_batch_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS item_photos (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS item_stories (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      story_text TEXT NOT NULL,
      provenance_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS interests (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      recorded_by_user_id TEXT,
      interest_level TEXT DEFAULT 'interested',
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, user_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      item_id TEXT UNIQUE NOT NULL,
      recipient_user_id TEXT,
      destination_type TEXT DEFAULT 'family',
      destination_name TEXT,
      is_locked INTEGER DEFAULT 1,
      assigned_by_user_id TEXT,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS fulfillments (
      id TEXT PRIMARY KEY,
      item_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'not_ready',
      carrier TEXT,
      tracking_number TEXT,
      recipient_address TEXT,
      shipped_at DATETIME,
      delivered_at DATETIME,
      notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      estate_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure 'value', 'institutional_candidate', and 'institutional_name' columns exist on items table
    db.run(`ALTER TABLE items ADD COLUMN value TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN institutional_candidate TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN institutional_name TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS draft_order (
      estate_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      PRIMARY KEY (estate_id, order_index)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS draft_picks (
      id TEXT PRIMARY KEY,
      estate_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      pick_number INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_title TEXT NOT NULL,
      item_value TEXT,
      picked_by_user_id TEXT NOT NULL,
      is_reversed INTEGER DEFAULT 0,
      reversed_by_user_id TEXT,
      reversed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed Estate
    const estate = await dbGet(`SELECT * FROM estates WHERE id = 'estate_uncle_jim'`);
    if (!estate) {
      await dbRun(`INSERT INTO estates (id, name, display_name, description) VALUES (?, ?, ?, ?)`, [
        'estate_uncle_jim',
        'Uncle Jim Estate',
        "Uncle Jim's Estate",
        "Preserving possessions, photographs, and memories from Uncle Jim's home."
      ]);
    }

    // Seed Categories
    const catCount = await dbGet(`SELECT COUNT(*) as count FROM categories`);
    if (catCount.count === 0) {
      const cats = [
        ['cat_1', 'estate_uncle_jim', 'Furniture', '🛋️'],
        ['cat_2', 'estate_uncle_jim', 'Maritime Objects & Models', '⚓'],
        ['cat_3', 'estate_uncle_jim', 'Books & Documents', '📚'],
        ['cat_4', 'estate_uncle_jim', 'Artwork & Framed Prints', '🎨'],
        ['cat_5', 'estate_uncle_jim', 'Memorabilia & Keepsakes', '💎'],
        ['cat_6', 'estate_uncle_jim', 'Household & Kitchenware', '🍽️']
      ];
      for (const [id, eId, name, icon] of cats) {
        await dbRun(`INSERT INTO categories (id, estate_id, name, icon) VALUES (?, ?, ?, ?)`, [id, eId, name, icon]);
      }
    }

    // Seed Users
    const userCount = await dbGet(`SELECT COUNT(*) as count FROM users`);
    if (userCount.count === 0) {
      const defaultPasswordHash = await bcrypt.hash('password123', 10);
      const seedUsers = [
        ['user_dan', 'estate_uncle_jim', 'Dan Robinson', 'dan@unclejim.estate', defaultPasswordHash, 'admin', '555-0100', 'Verona, NJ'],
        ['user_frank', 'estate_uncle_jim', 'Frank Robinson (Executor)', 'frank@unclejim.estate', defaultPasswordHash, 'admin', '555-0101', 'Ithaca, NY'],
        ['user_sarah', 'estate_uncle_jim', 'Cousin Sarah', 'sarah@unclejim.estate', defaultPasswordHash, 'contributor', '555-0102', 'Madison, WI'],
        ['user_jean', 'estate_uncle_jim', 'Aunt Jean', 'jean@unclejim.estate', defaultPasswordHash, 'reviewer', '555-0103', 'Manitowish Waters, WI'],
        ['user_tim', 'estate_uncle_jim', 'Tim Robinson', 'tim@unclejim.estate', defaultPasswordHash, 'reviewer', '555-0104', 'Chicago, IL'],
        ['user_susan', 'estate_uncle_jim', 'Susan Robinson', 'susan@unclejim.estate', defaultPasswordHash, 'reviewer', '555-0105', 'Boston, MA'],
        ['user_museum', 'estate_uncle_jim', 'City Historical Museum', 'museum@unclejim.estate', defaultPasswordHash, 'institution', '555-0109', 'Manitowish Waters, WI']
      ];
      for (const [id, eId, name, email, pass, role, phone, addr] of seedUsers) {
        await dbRun(`INSERT INTO users (id, estate_id, name, email, password_hash, role, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          id, eId, name, email, pass, role, phone, addr
        ]);
      }
    }

    // Ensure all 9 draft participants exist
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const draftParticipants = [
      { id: 'user_vinny', name: 'Vinny', email: 'vinny@unclejim.estate', role: 'reviewer' },
      { id: 'user_brian', name: 'Brian', email: 'brian@unclejim.estate', role: 'reviewer' },
      { id: 'user_jerry', name: 'Jerry', email: 'jerry@unclejim.estate', role: 'reviewer' },
      { id: 'user_tim', name: 'Tim', email: 'tim@unclejim.estate', role: 'reviewer' },
      { id: 'user_graceann', name: 'Grace Ann', email: 'graceann@unclejim.estate', role: 'reviewer' },
      { id: 'user_ray', name: 'Ray', email: 'ray@unclejim.estate', role: 'reviewer' },
      { id: 'user_patti', name: 'Patti', email: 'patti@unclejim.estate', role: 'reviewer' },
      { id: 'user_dan', name: 'Dan', email: 'dan@unclejim.estate', role: 'admin' },
      { id: 'user_jean', name: 'Jean', email: 'jean@unclejim.estate', role: 'reviewer' }
    ];

    for (const p of draftParticipants) {
      const existingUser = await dbGet(`SELECT id FROM users WHERE id = ? OR email = ?`, [p.id, p.email]);
      if (!existingUser) {
        await dbRun(`INSERT INTO users (id, estate_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`, [
          p.id, 'estate_uncle_jim', p.name, p.email, defaultPasswordHash, p.role
        ]);
      }
    }

    // Seed default draft order if empty
    const orderCount = await dbGet(`SELECT COUNT(*) as count FROM draft_order WHERE estate_id = 'estate_uncle_jim'`);
    if (orderCount.count === 0) {
      for (let i = 0; i < draftParticipants.length; i++) {
        await dbRun(`INSERT INTO draft_order (estate_id, user_id, order_index) VALUES (?, ?, ?)`, [
          'estate_uncle_jim', draftParticipants[i].id, i + 1
        ]);
      }
    }

    // Seed Sample Items if empty
    const itemCheck = await dbGet(`SELECT COUNT(*) as count FROM items`);
    if (itemCheck.count === 0) {
      console.log("Seeding sample items for Uncle Jim's Estate...");
      const sampleItems = [
        {
          id: 'item_101',
          title: 'Hand-Carved Wooden Ship Wheel',
          category_id: 'cat_2',
          location_in_house: 'Living Room (Over Mantel)',
          condition: 'Excellent',
          dimensions: '36" Diameter x 4" Depth',
          weight: '18 lbs',
          special_handling_notes: 'Wall mount requires two people to detach safely.',
          description: 'Authentic 19th-century teak ship steering wheel with brass hub inlay.',
          status: 'released',
          is_high_value: 1,
          story: 'Given to Uncle Jim by Captain Mac in 1974 after their sailing trip around Lake Superior. Jim kept this mounted above his fireplace for 50 years.'
        },
        {
          id: 'item_102',
          title: 'First Edition Maritime Navigation Logs (1942)',
          category_id: 'cat_3',
          location_in_house: 'Study Bookshelf (Top Shelf)',
          condition: 'Good (Leather Spine Worn)',
          dimensions: '9" x 12" x 2"',
          weight: '4 lbs',
          special_handling_notes: 'Fragile paper. Handle with clean hands or gloves.',
          description: 'Hardcover leather-bound navigational logbooks detailing Great Lakes vessel traffic during WWII.',
          status: 'released',
          is_high_value: 0,
          story: 'Uncle Jim spent winter evenings annotating these logs with notes about historic storms on Lake Michigan.'
        },
        {
          id: 'item_103',
          title: 'Solid Brass Sextant in Fitted Mahogany Box',
          category_id: 'cat_2',
          location_in_house: 'Study Desk Drawer',
          condition: 'Mint / Calibrated',
          dimensions: '10" x 10" x 6"',
          weight: '8 lbs',
          special_handling_notes: 'Includes original brass key for mahogany lock box.',
          description: 'Vintage marine sextant with optical scope, filters, and polished brass index arm.',
          status: 'released',
          is_high_value: 1,
          story: 'Used by Jim during his merchant marine voyages. He taught Tim and Dan how to sight stars with it on summer nights.'
        },
        {
          id: 'item_104',
          title: 'Manitowish Waters Lake Map Oil Painting',
          category_id: 'cat_4',
          location_in_house: 'Dining Room Wall',
          condition: 'Very Good',
          dimensions: '24" x 36"',
          weight: '6 lbs',
          special_handling_notes: 'Framed in custom reclaimed barnwood.',
          description: 'Original canvas painting depicting the chain of lakes in Northern Wisconsin.',
          status: 'released',
          is_high_value: 0,
          story: 'Commissioned by Aunt Jean for Jim’s 50th birthday. Depicts his favorite fishing bays marked with tiny anchors.'
        }
      ];

      for (const item of sampleItems) {
        await dbRun(`INSERT INTO items (id, estate_id, title, category_id, location_in_house, condition, dimensions, weight, special_handling_notes, description, status, is_high_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          item.id, 'estate_uncle_jim', item.title, item.category_id, item.location_in_house, item.condition, item.dimensions, item.weight, item.special_handling_notes, item.description, item.status, item.is_high_value
        ]);

        await dbRun(`INSERT INTO item_stories (id, item_id, story_text, provenance_source) VALUES (?, ?, ?, ?)`, [
          `story_${item.id}`, item.id, item.story, 'Uncle Jim\'s Personal Records'
        ]);

        // SVG placeholder photo
        const placeholderSvg = `https://placehold.co/800x600/2b1810/ffffff?text=${encodeURIComponent(item.title)}`;
        await dbRun(`INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, is_primary) VALUES (?, ?, ?, ?, 1)`, [
          `photo_${item.id}`, item.id, placeholderSvg, placeholderSvg
        ]);
      }

      // Seed sample interest for demo
      await dbRun(`INSERT INTO interests (id, item_id, user_id, interest_level, comment) VALUES (?, ?, ?, ?, ?)`, [
        'int_101', 'item_101', 'user_jean', 'interested', 'Uncle Jim always promised this to me for the cabin living room.'
      ]);
      await dbRun(`INSERT INTO interests (id, item_id, user_id, interest_level, comment) VALUES (?, ?, ?, ?, ?)`, [
        'int_102', 'item_101', 'user_tim', 'interested', 'I loved hearing Captain Mac stories sitting under this wheel.'
      ]);
    }
  });
}

initDatabase().catch(console.error);

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FULL_UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Serve static uploads
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'dist')));

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const token = req.cookies.uj_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet(`SELECT id, estate_id, name, email, role FROM users WHERE id = ?`, [decoded.id]);
    if (!user) return res.status(401).json({ error: "Invalid user session" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Session expired" });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied. Insufficient permissions." });
  }
  next();
};

// Audit Log Helper
async function logAudit(estateId, userId, action, targetType, targetId, details) {
  try {
    await dbRun(
      `INSERT INTO audit_logs (id, estate_id, user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), estateId, userId, action, targetType, targetId, JSON.stringify(details || {})]
    );
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}

// NodeMailer Helper
async function sendNotificationEmail(to, subject, bodyText) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[EMAIL LOG - DEMO MODE] To: ${to} | Subject: ${subject}\n${bodyText}`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    await transporter.sendMail({
      from: `"Uncle Jim's Estate" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: bodyText
    });
    console.log(`Email dispatched successfully to ${to}`);
  } catch (err) {
    console.error("Failed to send email notification:", err.message);
  }
}

// ----------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const user = await dbGet(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('uj_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    logAudit(user.estate_id, user.id, 'USER_LOGIN', 'users', user.id, { email: user.email });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, address: user.address },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('uj_token');
  res.json({ success: true });
});

// ----------------------------------------------------
// RAPID MOBILE PHOTO CAPTURE & ITEM CREATION
// ----------------------------------------------------
app.post('/api/items/rapid-capture', authenticateToken, requireRole(['admin', 'contributor']), upload.array('photos', 10), async (req, res) => {
  try {
    const { title, locationInHouse, categoryId, description, notes, value, institutionalCandidate, institutionalName } = req.body;
    const itemId = 'item_' + Date.now();
    const itemNumber = 'UJ-' + Math.floor(100 + Math.random() * 900);
    const itemTitle = (title !== undefined && title !== null) ? title.trim() : '';
    const itemLocation = (locationInHouse !== undefined && locationInHouse !== null) ? locationInHouse.trim() : '';
    const itemDesc = (description || notes || '').trim();
    const itemValue = (value !== undefined && value !== null) ? value.trim() : '';
    const instCandidate = (institutionalCandidate || 'None').trim();
    const instName = (institutionalName || '').trim();

    await dbRun(
      `INSERT INTO items (id, estate_id, item_number, title, category_id, location_in_house, description, value, status, institutional_candidate, institutional_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [itemId, req.user.estate_id, itemNumber, itemTitle, categoryId || null, itemLocation || null, itemDesc || null, itemValue || null, instCandidate, instName || null]
    );

    const savedPhotos = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const thumbFilename = 'thumb-' + file.filename.replace(/\.[^/.]+$/, "") + '.webp';
        const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

        // Generate high quality webp thumbnail
        await sharp(file.path)
          .resize(400, 300, { fit: 'cover' })
          .toFormat('webp', { quality: 80 })
          .toFile(thumbPath);

        const photoUrl = `/uploads/full/${file.filename}`;
        const thumbnailUrl = `/uploads/thumbs/${thumbFilename}`;
        const photoId = 'photo_' + Date.now() + '_' + i;
        const isPrimary = i === 0 ? 1 : 0;

        await dbRun(
          `INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, is_primary, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [photoId, itemId, photoUrl, thumbnailUrl, isPrimary, i]
        );

        savedPhotos.push({ id: photoId, photoUrl, thumbnailUrl, isPrimary });
      }
    }

    logAudit(req.user.estate_id, req.user.id, 'RAPID_CAPTURE_ITEM', 'items', itemId, { title: itemTitle, photosCount: savedPhotos.length });

    res.json({
      success: true,
      item: { id: itemId, itemNumber, title: itemTitle, status: 'draft', photos: savedPhotos }
    });
  } catch (err) {
    console.error("Rapid capture error:", err);
    res.status(500).json({ error: "Failed to process rapid capture upload" });
  }
});

// ----------------------------------------------------
// ITEM INVENTORY & ENRICHMENT ENDPOINTS
// ----------------------------------------------------
app.get('/api/items', authenticateToken, async (req, res) => {
  try {
    const { status, category, search, myInterests } = req.query;
    let query = `
      SELECT i.*, c.name as category_name, c.icon as category_icon,
             (SELECT photo_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_photo,
             (SELECT thumbnail_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_thumb,
             (SELECT COUNT(*) FROM interests WHERE item_id = i.id AND interest_level = 'interested') as interested_count,
             (SELECT COUNT(*) FROM interests WHERE item_id = i.id AND user_id = ? AND interest_level = 'interested') as user_interested,
             (SELECT GROUP_CONCAT(u.name, ', ') FROM interests int_sub JOIN users u ON int_sub.user_id = u.id WHERE int_sub.item_id = i.id AND int_sub.interest_level = 'interested') as interested_names,
             (SELECT recipient_user_id FROM assignments WHERE item_id = i.id) as assigned_to_user_id,
             (SELECT u.name FROM assignments a JOIN users u ON a.recipient_user_id = u.id WHERE a.item_id = i.id) as assigned_to_name,
             (SELECT destination_name FROM assignments WHERE item_id = i.id) as destination_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.estate_id = ?
    `;
    const params = [req.user.id, req.user.estate_id];

    // Family reviewers can only see released or assigned items
    if (req.user.role === 'reviewer') {
      query += ` AND i.status IN ('released', 'assigned', 'distributed', 'completed')`;
    } else if (status) {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (category) {
      query += ` AND i.category_id = ?`;
      params.push(category);
    }

    if (myInterests === 'true') {
      query += ` AND EXISTS (SELECT 1 FROM interests WHERE item_id = i.id AND user_id = ? AND interest_level = 'interested')`;
      params.push(req.user.id);
    }

    if (search) {
      query += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.location_in_house LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ` ORDER BY i.created_at DESC`;
    const items = await dbAll(query, params);

    if (items.length > 0) {
      const itemIds = items.map(it => it.id);
      const placeholders = itemIds.map(() => '?').join(',');
      const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id IN (${placeholders}) ORDER BY is_primary DESC, display_order ASC`, itemIds);
      const photosByItem = {};
      for (const p of allPhotos) {
        if (!photosByItem[p.item_id]) photosByItem[p.item_id] = [];
        photosByItem[p.item_id].push(p);
      }
      for (const item of items) {
        item.photos = photosByItem[item.id] || [];
      }
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load inventory items" });
  }
});

app.get('/api/items/:id', authenticateToken, async (req, res) => {
  try {
    const item = await dbGet(`
      SELECT i.*, c.name as category_name, c.icon as category_icon
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.id = ? AND i.estate_id = ?
    `, [req.params.id, req.user.estate_id]);

    if (!item) return res.status(404).json({ error: "Item not found" });

    const photos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [item.id]);
    const stories = await dbAll(`SELECT * FROM item_stories WHERE item_id = ? ORDER BY created_at ASC`, [item.id]);
    const interests = await dbAll(`
      SELECT int.*, u.name as user_name, u.email as user_email, rec.name as recorded_by_name
      FROM interests int
      JOIN users u ON int.user_id = u.id
      LEFT JOIN users rec ON int.recorded_by_user_id = rec.id
      WHERE int.item_id = ?
    `, [item.id]);

    const assignment = await dbGet(`
      SELECT a.*, u.name as recipient_name
      FROM assignments a
      LEFT JOIN users u ON a.recipient_user_id = u.id
      WHERE a.item_id = ?
    `, [item.id]);

    const fulfillment = await dbGet(`SELECT * FROM fulfillments WHERE item_id = ?`, [item.id]);

    res.json({ ...item, photos, stories, interests, assignment, fulfillment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load item details" });
  }
});

app.put('/api/items/:id', authenticateToken, requireRole(['admin', 'contributor']), async (req, res) => {
  try {
    const { title, categoryId, locationInHouse, location, condition, dimensions, weight, specialHandlingNotes, notes, description, storyText, provenanceSource, isHighValue, value, status, institutionalCandidate, institutional_candidate, institutionalName, institutional_name } = req.body;
    const itemId = req.params.id;
    const finalLocation = locationInHouse !== undefined ? locationInHouse : location;
    const finalNotes = specialHandlingNotes !== undefined ? specialHandlingNotes : notes;
    const finalInstCandidate = institutionalCandidate !== undefined ? institutionalCandidate : institutional_candidate;
    const finalInstName = institutionalName !== undefined ? institutionalName : institutional_name;

    await dbRun(`
      UPDATE items
      SET title = COALESCE(?, title),
          category_id = COALESCE(?, category_id),
          location_in_house = COALESCE(?, location_in_house),
          condition = COALESCE(?, condition),
          dimensions = COALESCE(?, dimensions),
          weight = COALESCE(?, weight),
          special_handling_notes = COALESCE(?, special_handling_notes),
          description = COALESCE(?, description),
          value = COALESCE(?, value),
          status = COALESCE(?, status),
          is_high_value = COALESCE(?, is_high_value),
          institutional_candidate = CASE WHEN ? = 1 THEN ? ELSE institutional_candidate END,
          institutional_name = CASE WHEN ? = 1 THEN ? ELSE institutional_name END
      WHERE id = ? AND estate_id = ?
    `, [
      title !== undefined ? title : null,
      categoryId !== undefined ? categoryId : null,
      finalLocation !== undefined ? finalLocation : null,
      condition !== undefined ? condition : null,
      dimensions !== undefined ? dimensions : null,
      weight !== undefined ? weight : null,
      finalNotes !== undefined ? finalNotes : null,
      description !== undefined ? description : null,
      value !== undefined ? value : null,
      status !== undefined ? status : null,
      isHighValue !== undefined ? (isHighValue ? 1 : 0) : null,
      finalInstCandidate !== undefined ? 1 : 0,
      finalInstCandidate !== undefined ? finalInstCandidate : null,
      finalInstName !== undefined ? 1 : 0,
      finalInstName !== undefined ? finalInstName : null,
      itemId,
      req.user.estate_id
    ]);

    if (storyText !== undefined) {
      const existingStory = await dbGet(`SELECT id FROM item_stories WHERE item_id = ?`, [itemId]);
      if (existingStory) {
        await dbRun(`UPDATE item_stories SET story_text = ?, provenance_source = ? WHERE id = ?`, [storyText || '', provenanceSource || null, existingStory.id]);
      } else if (storyText) {
        await dbRun(`INSERT INTO item_stories (id, item_id, story_text, provenance_source) VALUES (?, ?, ?, ?)`, ['story_' + Date.now(), itemId, storyText, provenanceSource || null]);
      }
    }

    logAudit(req.user.estate_id, req.user.id, 'UPDATE_ITEM', 'items', itemId, { title });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// Endpoint: Upload / Add Photos to an Existing Item
app.post('/api/items/:id/photos', authenticateToken, requireRole(['admin', 'contributor']), upload.array('photos', 10), async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await dbGet(`SELECT id FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No photos uploaded" });
    }

    const photoCountRow = await dbGet(`SELECT COUNT(*) as count FROM item_photos WHERE item_id = ?`, [itemId]);
    let currentCount = photoCountRow?.count || 0;

    const savedPhotos = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const thumbFilename = 'thumb-' + file.filename.replace(/\.[^/.]+$/, "") + '.webp';
      const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

      await sharp(file.path)
        .resize(400, 300, { fit: 'cover' })
        .toFormat('webp', { quality: 80 })
        .toFile(thumbPath);

      const photoUrl = `/uploads/full/${file.filename}`;
      const thumbnailUrl = `/uploads/thumbs/${thumbFilename}`;
      const photoId = 'photo_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6);
      const isPrimary = (currentCount === 0 && i === 0) ? 1 : 0;
      const displayOrder = currentCount + i;

      await dbRun(
        `INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, is_primary, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [photoId, itemId, photoUrl, thumbnailUrl, isPrimary, displayOrder]
      );

      savedPhotos.push({ id: photoId, item_id: itemId, photo_url: photoUrl, thumbnail_url: thumbnailUrl, is_primary: isPrimary, display_order: displayOrder });
    }

    const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);

    logAudit(req.user.estate_id, req.user.id, 'ADD_ITEM_PHOTOS', 'items', itemId, { addedCount: savedPhotos.length });

    res.json({ success: true, added: savedPhotos, photos: allPhotos });
  } catch (err) {
    console.error("Failed to add photos to item:", err);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

// Endpoint: Delete a Photo from an Item
app.delete('/api/items/:id/photos/:photoId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;
    const item = await dbGet(`SELECT id FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const photo = await dbGet(`SELECT * FROM item_photos WHERE id = ? AND item_id = ?`, [photoId, itemId]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    await dbRun(`DELETE FROM item_photos WHERE id = ? AND item_id = ?`, [photoId, itemId]);

    // If the deleted photo was primary, promote the next photo to primary
    if (photo.is_primary === 1) {
      const remainingPhoto = await dbGet(`SELECT id FROM item_photos WHERE item_id = ? ORDER BY display_order ASC LIMIT 1`, [itemId]);
      if (remainingPhoto) {
        await dbRun(`UPDATE item_photos SET is_primary = 1 WHERE id = ?`, [remainingPhoto.id]);
      }
    }

    const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);

    logAudit(req.user.estate_id, req.user.id, 'DELETE_ITEM_PHOTO', 'item_photos', photoId, { itemId });

    res.json({ success: true, photos: allPhotos });
  } catch (err) {
    console.error("Failed to delete photo:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

app.delete('/api/items/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    // We should only allow admins to delete items. (Or contributors if requested, but let's restrict to admin by default for deletion)

    const item = await dbGet(`SELECT id, title FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Delete associated data first to keep database clean
    await dbRun(`DELETE FROM item_photos WHERE item_id = ?`, [itemId]);
    await dbRun(`DELETE FROM item_stories WHERE item_id = ?`, [itemId]);
    await dbRun(`DELETE FROM interests WHERE item_id = ?`, [itemId]);
    await dbRun(`DELETE FROM assignments WHERE item_id = ?`, [itemId]);
    await dbRun(`DELETE FROM fulfillments WHERE item_id = ?`, [itemId]);

    // Finally delete the item
    await dbRun(`DELETE FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);

    logAudit(req.user.estate_id, req.user.id, 'DELETE_ITEM', 'items', itemId, { title: item.title });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});


// ----------------------------------------------------
// BATCH RELEASE ENDPOINTS
// ----------------------------------------------------
app.post('/api/batches/release', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { itemIds } = req.body;
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: "itemIds array required" });
    }

    const batchId = 'batch_' + Date.now();
    for (const itemId of itemIds) {
      await dbRun(`UPDATE items SET status = 'released', release_batch_id = ? WHERE id = ? AND estate_id = ?`, [batchId, itemId, req.user.estate_id]);
    }

    // Notify family members via email
    const familyUsers = await dbAll(`SELECT email FROM users WHERE estate_id = ? AND role = 'reviewer'`, [req.user.estate_id]);
    const emails = familyUsers.map(u => u.email).join(', ');
    if (emails) {
      sendNotificationEmail(
        emails,
        `Uncle Jim's Estate — ${itemIds.length} New Items Released for Review`,
        `Hello Family,\n\n${itemIds.length} new items from Uncle Jim's estate have been released for family review!\n\nPlease log in to review photos, stories, and indicate what matters to you:\nhttp://localhost:3000/\n\nWarm regards,\nDan & Frank`
      );
    }

    logAudit(req.user.estate_id, req.user.id, 'RELEASE_BATCH', 'release_batches', batchId, { count: itemIds.length });

    res.json({ success: true, releasedCount: itemIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to release batch" });
  }
});

// ----------------------------------------------------
// FAMILY REVIEW & INTEREST ENDPOINTS
// ----------------------------------------------------
app.get('/api/reviews/progress', authenticateToken, async (req, res) => {
  try {
    const totalReleased = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status IN ('released', 'assigned', 'distributed', 'completed')`, [req.user.estate_id]);
    const reviewedByUser = await dbGet(`SELECT COUNT(DISTINCT item_id) as count FROM interests WHERE user_id = ?`, [req.user.id]);
    
    const userProgress = await dbAll(`
      SELECT u.id, u.name, u.email,
             COUNT(DISTINCT int.item_id) as items_reviewed
      FROM users u
      LEFT JOIN interests int ON u.id = int.user_id
      WHERE u.estate_id = ? AND u.role = 'reviewer'
      GROUP BY u.id
    `, [req.user.estate_id]);

    res.json({
      totalReleased: totalReleased.count,
      reviewedByUser: reviewedByUser.count,
      userProgress
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load review progress" });
  }
});

app.post('/api/items/:id/interest', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { interestLevel, comment } = req.body; // 'interested' or 'not_interested' / 'none'

    if (interestLevel === 'none' || interestLevel === 'remove') {
      await dbRun(`DELETE FROM interests WHERE item_id = ? AND user_id = ?`, [itemId, req.user.id]);
      logAudit(req.user.estate_id, req.user.id, 'REMOVE_INTEREST', 'items', itemId, {});
      return res.json({ success: true, removed: true });
    }

    const assignment = await dbGet(`SELECT is_locked FROM assignments WHERE item_id = ?`, [itemId]);
    if (assignment && assignment.is_locked && req.user.role !== 'admin') {
      return res.status(403).json({ error: "This item has been locked by assignment." });
    }

    const existing = await dbGet(`SELECT id FROM interests WHERE item_id = ? AND user_id = ?`, [itemId, req.user.id]);
    if (existing) {
      await dbRun(`UPDATE interests SET interest_level = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`, [interestLevel, comment || null, existing.id]);
    } else {
      await dbRun(`INSERT INTO interests (id, item_id, user_id, interest_level, comment) VALUES (?, ?, ?, ?, ?)`, ['int_' + Date.now(), itemId, req.user.id, interestLevel, comment || null]);
    }

    logAudit(req.user.estate_id, req.user.id, 'SUBMIT_INTEREST', 'items', itemId, { interestLevel, comment });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record interest" });
  }
});

app.delete('/api/items/:id/interest', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    await dbRun(`DELETE FROM interests WHERE item_id = ? AND user_id = ?`, [itemId, req.user.id]);
    logAudit(req.user.estate_id, req.user.id, 'REMOVE_INTEREST', 'items', itemId, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove interest" });
  }
});

app.post('/api/items/:id/interest-on-behalf', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const { targetUserId, interestLevel, comment } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "targetUserId required" });

    const existing = await dbGet(`SELECT id FROM interests WHERE item_id = ? AND user_id = ?`, [itemId, targetUserId]);
    if (existing) {
      await dbRun(`UPDATE interests SET interest_level = ?, comment = ?, recorded_by_user_id = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`, [interestLevel, comment || null, req.user.id, existing.id]);
    } else {
      await dbRun(`INSERT INTO interests (id, item_id, user_id, recorded_by_user_id, interest_level, comment) VALUES (?, ?, ?, ?, ?, ?)`, ['int_' + Date.now(), itemId, targetUserId, req.user.id, interestLevel, comment || null]);
    }

    logAudit(req.user.estate_id, req.user.id, 'RECORD_INTEREST_BEHALF', 'items', itemId, { targetUserId, interestLevel });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record interest on behalf" });
  }
});

// ----------------------------------------------------
// ASSIGNMENT & CONFLICT RESOLUTION ENDPOINTS
// ----------------------------------------------------
app.post('/api/items/:id/assign', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const { recipientUserId, destinationType, destinationName } = req.body;

    const existing = await dbGet(`SELECT id FROM assignments WHERE item_id = ?`, [itemId]);
    if (existing) {
      await dbRun(`UPDATE assignments SET recipient_user_id = ?, destination_type = ?, destination_name = ?, is_locked = 1, assigned_by_user_id = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?`, [
        recipientUserId || null, destinationType || 'family', destinationName || null, req.user.id, existing.id
      ]);
    } else {
      await dbRun(`INSERT INTO assignments (id, item_id, recipient_user_id, destination_type, destination_name, is_locked, assigned_by_user_id) VALUES (?, ?, ?, ?, ?, 1, ?)`, [
        'assign_' + Date.now(), itemId, recipientUserId || null, destinationType || 'family', destinationName || null, req.user.id
      ]);
    }

    await dbRun(`UPDATE items SET status = 'assigned' WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);

    // Send confirmation email to recipient if family member
    if (recipientUserId) {
      const recipient = await dbGet(`SELECT email, name FROM users WHERE id = ?`, [recipientUserId]);
      if (recipient) {
        const item = await dbGet(`SELECT title FROM items WHERE id = ?`, [itemId]);
        sendNotificationEmail(
          recipient.email,
          `An item from Uncle Jim's estate has been assigned to you`,
          `Dear ${recipient.name},\n\nThe item "${item.title}" from Uncle Jim's estate has been assigned to you!\n\nYou can log in to view shipping and pickup details:\nhttp://localhost:3000/\n\nWarmly,\nDan & Frank`
        );
      }
    }

    logAudit(req.user.estate_id, req.user.id, 'ASSIGN_ITEM', 'items', itemId, { recipientUserId, destinationType, destinationName });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign item" });
  }
});

app.post('/api/items/:id/unlock', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    await dbRun(`UPDATE assignments SET is_locked = 0 WHERE item_id = ?`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'UNLOCK_ASSIGNMENT', 'items', itemId, {});
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unlock assignment" });
  }
});

// ----------------------------------------------------
// FULFILLMENT & SHIPPING TRACKING
// ----------------------------------------------------
app.put('/api/items/:id/fulfillment', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const { status, carrier, trackingNumber, recipientAddress, notes } = req.body;

    const existing = await dbGet(`SELECT id FROM fulfillments WHERE item_id = ?`, [itemId]);
    if (existing) {
      await dbRun(`UPDATE fulfillments SET status = ?, carrier = ?, tracking_number = ?, recipient_address = ?, notes = ? WHERE id = ?`, [
        status || 'not_ready', carrier || null, trackingNumber || null, recipientAddress || null, notes || null, existing.id
      ]);
    } else {
      await dbRun(`INSERT INTO fulfillments (id, item_id, status, carrier, tracking_number, recipient_address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        'ful_' + Date.now(), itemId, status || 'not_ready', carrier || null, trackingNumber || null, recipientAddress || null, notes || null
      ]);
    }

    if (status === 'delivered' || status === 'completed') {
      await dbRun(`UPDATE items SET status = 'completed' WHERE id = ?`, [itemId]);
    }

    logAudit(req.user.estate_id, req.user.id, 'UPDATE_FULFILLMENT', 'items', itemId, { status, carrier, trackingNumber });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update fulfillment status" });
  }
});

// ----------------------------------------------------
// DRAFT MODE & FAMILY DRAFT ENDPOINTS
// ----------------------------------------------------
app.get('/api/draft/state', authenticateToken, async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const orderRows = await dbAll(`
      SELECT o.order_index, o.user_id, u.name, u.email, u.role
      FROM draft_order o
      JOIN users u ON o.user_id = u.id
      WHERE o.estate_id = ?
      ORDER BY o.order_index ASC
    `, [estateId]);

    const pickCountRes = await dbGet(`
      SELECT COUNT(*) as count FROM draft_picks WHERE estate_id = ? AND is_reversed = 0
    `, [estateId]);
    const activePickCount = pickCountRes ? pickCountRes.count : 0;

    let currentRound = 1;
    let currentPicker = null;
    let turnIndex = 0;
    if (orderRows.length > 0) {
      currentRound = Math.floor(activePickCount / orderRows.length) + 1;
      turnIndex = activePickCount % orderRows.length;
      currentPicker = orderRows[turnIndex];
    }

    res.json({
      draftOrder: orderRows,
      activePickCount,
      currentRound,
      currentTurnIndex: turnIndex,
      currentPicker,
      isCurrentUserTurn: currentPicker ? (currentPicker.user_id === req.user.id) : false,
      isAdmin: req.user.role === 'admin'
    });
  } catch (err) {
    console.error("Draft state error:", err);
    res.status(500).json({ error: "Failed to load draft state" });
  }
});

app.post('/api/draft/order', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds array required" });
    }

    await dbRun(`DELETE FROM draft_order WHERE estate_id = ?`, [estateId]);
    for (let i = 0; i < userIds.length; i++) {
      await dbRun(`INSERT INTO draft_order (estate_id, user_id, order_index) VALUES (?, ?, ?)`, [
        estateId, userIds[i], i + 1
      ]);
    }

    logAudit(estateId, req.user.id, 'UPDATE_DRAFT_ORDER', 'draft_order', estateId, { userIds });
    res.json({ success: true });
  } catch (err) {
    console.error("Draft order error:", err);
    res.status(500).json({ error: "Failed to update draft order" });
  }
});

app.post('/api/draft/pick', authenticateToken, async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const { itemId, targetUserId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId is required" });

    const orderRows = await dbAll(`
      SELECT o.order_index, o.user_id, u.name
      FROM draft_order o
      JOIN users u ON o.user_id = u.id
      WHERE o.estate_id = ?
      ORDER BY o.order_index ASC
    `, [estateId]);

    if (orderRows.length === 0) {
      return res.status(400).json({ error: "Draft order has not been established" });
    }

    const pickCountRes = await dbGet(`SELECT COUNT(*) as count FROM draft_picks WHERE estate_id = ? AND is_reversed = 0`, [estateId]);
    const activePickCount = pickCountRes ? pickCountRes.count : 0;
    const turnIndex = activePickCount % orderRows.length;
    const currentRound = Math.floor(activePickCount / orderRows.length) + 1;
    const currentPicker = orderRows[turnIndex];

    let recipientUser = currentPicker;
    if (req.user.role === 'admin' && targetUserId) {
      const specifiedUser = await dbGet(`SELECT id, name FROM users WHERE id = ?`, [targetUserId]);
      if (specifiedUser) recipientUser = { user_id: specifiedUser.id, name: specifiedUser.name };
    } else {
      if (req.user.role !== 'admin' && req.user.id !== currentPicker.user_id) {
        return res.status(403).json({ error: `It is currently ${currentPicker.name}'s turn to pick.` });
      }
    }

    const item = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    if (!item) return res.status(404).json({ error: "Item not found" });
    if (item.status === 'assigned') {
      return res.status(400).json({ error: "This item has already been assigned." });
    }

    const overallPickNumber = activePickCount + 1;
    const pickId = 'pick_' + Date.now();

    await dbRun(`
      INSERT INTO draft_picks (
        id, estate_id, round_number, pick_number, user_id, user_name, item_id, item_title, item_value, picked_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pickId,
      estateId,
      currentRound,
      overallPickNumber,
      recipientUser.user_id || recipientUser.id,
      recipientUser.name,
      item.id,
      item.title,
      item.value || null,
      req.user.id
    ]);

    const existingAssign = await dbGet(`SELECT id FROM assignments WHERE item_id = ?`, [itemId]);
    if (existingAssign) {
      await dbRun(`
        UPDATE assignments
        SET recipient_user_id = ?, destination_type = 'family', destination_name = ?, is_locked = 1, assigned_by_user_id = ?, assigned_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [recipientUser.user_id || recipientUser.id, recipientUser.name, req.user.id, existingAssign.id]);
    } else {
      await dbRun(`
        INSERT INTO assignments (id, item_id, recipient_user_id, destination_type, destination_name, is_locked, assigned_by_user_id)
        VALUES (?, ?, ?, 'family', ?, 1, ?)
      `, ['assign_' + Date.now(), itemId, recipientUser.user_id || recipientUser.id, recipientUser.name, req.user.id]);
    }

    await dbRun(`UPDATE items SET status = 'assigned' WHERE id = ?`, [itemId]);

    logAudit(estateId, req.user.id, 'DRAFT_PICK', 'draft_picks', pickId, {
      round: currentRound,
      pickNumber: overallPickNumber,
      itemId: item.id,
      itemTitle: item.title,
      recipientId: recipientUser.user_id || recipientUser.id,
      recipientName: recipientUser.name
    });

    res.json({
      success: true,
      pick: {
        id: pickId,
        round_number: currentRound,
        pick_number: overallPickNumber,
        user_name: recipientUser.name,
        item_title: item.title,
        item_value: item.value
      }
    });
  } catch (err) {
    console.error("Draft pick error:", err);
    res.status(500).json({ error: "Failed to record draft pick" });
  }
});

app.post('/api/draft/picks/:id/reverse', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const pickId = req.params.id;
    const estateId = req.user.estate_id;

    const pick = await dbGet(`SELECT * FROM draft_picks WHERE id = ? AND estate_id = ?`, [pickId, estateId]);
    if (!pick) return res.status(404).json({ error: "Draft pick not found" });
    if (pick.is_reversed) return res.status(400).json({ error: "Pick is already reversed" });

    await dbRun(`
      UPDATE draft_picks
      SET is_reversed = 1, reversed_by_user_id = ?, reversed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.user.id, pickId]);

    await dbRun(`DELETE FROM assignments WHERE item_id = ?`, [pick.item_id]);
    await dbRun(`UPDATE items SET status = 'released' WHERE id = ?`, [pick.item_id]);

    logAudit(estateId, req.user.id, 'REVERSE_DRAFT_PICK', 'draft_picks', pickId, {
      itemId: pick.item_id,
      itemTitle: pick.item_title,
      reversedFromUser: pick.user_name,
      pickNumber: pick.pick_number
    });

    res.json({ success: true, message: "Draft pick reversed and documented in audit log." });
  } catch (err) {
    console.error("Reverse pick error:", err);
    res.status(500).json({ error: "Failed to reverse draft pick" });
  }
});

app.get('/api/draft/history', authenticateToken, async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const picks = await dbAll(`
      SELECT p.*,
             u_conf.name as confirmed_by_name,
             u_rev.name as reversed_by_name
      FROM draft_picks p
      LEFT JOIN users u_conf ON p.picked_by_user_id = u_conf.id
      LEFT JOIN users u_rev ON p.reversed_by_user_id = u_rev.id
      WHERE p.estate_id = ?
      ORDER BY p.pick_number ASC, p.created_at ASC
    `, [estateId]);
    res.json(picks);
  } catch (err) {
    console.error("Draft history error:", err);
    res.status(500).json({ error: "Failed to load draft history" });
  }
});

app.get('/api/draft/summary-by-person', authenticateToken, async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const cousins = await dbAll(`
      SELECT o.user_id, u.name, u.email
      FROM draft_order o
      JOIN users u ON o.user_id = u.id
      WHERE o.estate_id = ?
      ORDER BY o.order_index ASC
    `, [estateId]);

    const activePicks = await dbAll(`
      SELECT p.id, p.user_id, p.item_id, p.item_title, p.item_value, p.pick_number, p.round_number, p.created_at,
             i.item_number,
             (SELECT photo_url FROM item_photos WHERE item_id = p.item_id ORDER BY is_primary DESC LIMIT 1) as photo_url
      FROM draft_picks p
      LEFT JOIN items i ON p.item_id = i.id
      WHERE p.estate_id = ? AND p.is_reversed = 0
      ORDER BY p.pick_number ASC
    `, [estateId]);

    const summary = cousins.map(c => {
      const personPicks = activePicks.filter(p => p.user_id === c.user_id);
      let totalValue = 0;
      personPicks.forEach(p => {
        if (p.item_value) {
          const num = parseFloat(String(p.item_value).replace(/[^0-9.-]+/g, ''));
          if (!isNaN(num)) totalValue += num;
        }
      });
      return {
        userId: c.user_id,
        name: c.name,
        email: c.email,
        itemCount: personPicks.length,
        totalValue: totalValue,
        formattedTotalValue: '$' + Math.round(totalValue).toLocaleString(),
        items: personPicks
      };
    });

    res.json(summary);
  } catch (err) {
    console.error("Summary by person error:", err);
    res.status(500).json({ error: "Failed to load summary by person" });
  }
});

// ----------------------------------------------------
// ADMIN DASHBOARD ANALYTICS ENDPOINT
// ----------------------------------------------------
app.get('/api/admin/dashboard-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const eId = req.user.estate_id;
    const totalItems = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ?`, [eId]);
    const draftItems = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'draft'`, [eId]);
    const releasedItems = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'released'`, [eId]);
    const assignedItems = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'assigned'`, [eId]);
    const completedItems = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'completed'`, [eId]);

    // Items with multiple interested users ("Needs Decision")
    const needsDecision = await dbAll(`
      SELECT i.id, i.title, i.item_number, COUNT(int.id) as interest_count
      FROM items i
      JOIN interests int ON i.id = int.item_id AND int.interest_level = 'interested'
      LEFT JOIN assignments a ON i.id = a.item_id
      WHERE i.estate_id = ? AND (a.id IS NULL OR a.is_locked = 0)
      GROUP BY i.id
      HAVING interest_count > 1
    `, [eId]);

    const categories = await dbAll(`SELECT * FROM categories WHERE estate_id = ?`, [eId]);
    const users = await dbAll(`SELECT id, name, email, role FROM users WHERE estate_id = ?`, [eId]);
    const recentAudit = await dbAll(`
      SELECT a.*, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.estate_id = ?
      ORDER BY a.created_at DESC LIMIT 15
    `, [eId]);

    res.json({
      totalItems: totalItems.count,
      draftItems: draftItems.count,
      releasedItems: releasedItems.count,
      assignedItems: assignedItems.count,
      completedItems: completedItems.count,
      needsDecision,
      categories,
      users,
      recentAudit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

app.get('/api/categories', authenticateToken, async (req, res) => {
  const cats = await dbAll(`SELECT * FROM categories WHERE estate_id = ? ORDER BY name ASC`, [req.user.estate_id]);
  res.json(cats);
});

app.get('/api/users', authenticateToken, async (req, res) => {
  const users = await dbAll(`SELECT id, name, email, role, phone, address FROM users WHERE estate_id = ? ORDER BY name ASC`, [req.user.estate_id]);
  res.json(users);
});

// Endpoint: Batch Sync Staged Items Upload from Offline Mode
app.post('/api/items/batch-sync', authenticateToken, upload.array('photos', 20), async (req, res) => {
  try {
    const { items: itemsJson } = req.body;
    const parsedItems = JSON.parse(itemsJson || '[]');
    const uploadedResults = [];

    for (let itemData of parsedItems) {
      const itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const itemNum = 'E-' + Math.floor(1000 + Math.random() * 9000);

      await dbRun(`
        INSERT INTO items (id, estate_id, item_number, title, category_id, location_in_house, description, value, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `, [itemId, req.user.estate_id, itemNum, itemData.title || '', itemData.categoryId || null, itemData.locationInHouse || null, itemData.notes || '', itemData.value || null]);

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const filename = `photo_${Date.now()}_${i}.webp`;
          const fullPath = path.join(FULL_UPLOADS_DIR, filename);
          const thumbPath = path.join(THUMB_UPLOADS_DIR, filename);

          await sharp(file.buffer).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).toFile(fullPath);
          await sharp(file.buffer).resize(400, 400, { fit: 'cover' }).toFile(thumbPath);

          const photoId = 'pho_' + Date.now() + '_' + i;
          await dbRun(`
            INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, is_primary)
            VALUES (?, ?, ?, ?, ?)
          `, [photoId, itemId, `/uploads/full/${filename}`, `/uploads/thumbs/${filename}`, i === 0 ? 1 : 0]);
        }
      }

      logAudit(req.user.estate_id, req.user.id, 'BATCH_SYNC_UPLOAD', 'items', itemId, { title: itemData.title });
      uploadedResults.push({ id: itemId, title: itemData.title });
    }

    res.json({ success: true, count: uploadedResults.length, items: uploadedResults });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process batch sync upload" });
  }
});

// Endpoint: My Interested Items Report for Standard Users
app.get('/api/reports/my-interests', authenticateToken, async (req, res) => {
  try {
    const interests = await dbAll(`
      SELECT i.id, i.title, i.category_id, i.location_in_house, i.description, int.interest_level, int.comment, int.created_at as marked_at,
             (SELECT photo_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC LIMIT 1) as primary_photo
      FROM interests int
      JOIN items i ON int.item_id = i.id
      WHERE int.user_id = ?
      ORDER BY int.created_at DESC
    `, [req.user.id]);
    res.json(interests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load interest report" });
  }
});

// Endpoint: Institution Questions / Inquiries
app.post('/api/items/inquiry', authenticateToken, async (req, res) => {
  try {
    const { itemId, question } = req.body;
    const inqId = 'inq_' + Date.now();
    await dbRun(`
      INSERT INTO institution_inquiries (id, item_id, user_id, question)
      VALUES (?, ?, ?, ?)
    `, [inqId, itemId || 'general', req.user.id, question]);

    logAudit(req.user.estate_id, req.user.id, 'INSTITUTION_INQUIRY', 'items', itemId, { question });
    res.json({ success: true, inquiryId: inqId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
});
// -----------------------------------------------------------------------------
// STRICT CODE RULE: NO FAKE DATA / NO HALLUCINATED COMPARABLES
// All item enrichments must reflect verified user input or live web queries.
// -----------------------------------------------------------------------------
// Endpoint: AI Workbench Record Enrichment & Release
app.post('/api/items/:id/enrich', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, era, value, notes } = req.body;
    
    const descParts = [];
    if (era) descParts.push(`Era: ${era}`);
    if (notes) descParts.push(notes);
    const itemDesc = descParts.join(' | ');

    await dbRun(`
      UPDATE items
      SET title = COALESCE(?, title),
          description = ?,
          value = COALESCE(?, value),
          status = 'released'
      WHERE id = ?
    `, [title || null, itemDesc || null, value || null, id]);

    logAudit(req.user.estate_id, req.user.id, 'ENRICH_ITEM', 'items', id, { title, era, value });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to enrich item" });
  }
});

// Endpoint: Admin Delete Single Item
app.delete('/api/items/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun(`DELETE FROM item_photos WHERE item_id = ?`, [id]);
    await dbRun(`DELETE FROM item_stories WHERE item_id = ?`, [id]);
    await dbRun(`DELETE FROM interests WHERE item_id = ?`, [id]);
    await dbRun(`DELETE FROM assignments WHERE item_id = ?`, [id]);
    await dbRun(`DELETE FROM fulfillments WHERE item_id = ?`, [id]);
    await dbRun(`DELETE FROM items WHERE id = ?`, [id]);

    logAudit(req.user.estate_id, req.user.id, 'DELETE_ITEM', 'items', id, { message: 'Deleted single item' });
    res.json({ success: true, message: "Item deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// Endpoint: Admin Clear All Inventory Data
app.post('/api/admin/clear-inventory', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const eId = req.user.estate_id;
    await dbRun(`DELETE FROM item_photos WHERE item_id IN (SELECT id FROM items WHERE estate_id = ?)`, [eId]);
    await dbRun(`DELETE FROM item_stories WHERE item_id IN (SELECT id FROM items WHERE estate_id = ?)`, [eId]);
    await dbRun(`DELETE FROM interests WHERE item_id IN (SELECT id FROM items WHERE estate_id = ?)`, [eId]);
    await dbRun(`DELETE FROM assignments WHERE item_id IN (SELECT id FROM items WHERE estate_id = ?)`, [eId]);
    await dbRun(`DELETE FROM fulfillments WHERE item_id IN (SELECT id FROM items WHERE estate_id = ?)`, [eId]);
    await dbRun(`DELETE FROM items WHERE estate_id = ?`, [eId]);
    await dbRun(`DELETE FROM audit_logs WHERE estate_id = ?`, [eId]);

    logAudit(eId, req.user.id, 'CLEAR_INVENTORY', 'estates', eId, { message: 'Cleared all inventory data for estate' });
    res.json({ success: true, message: "Cleared all inventory items." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear inventory data" });
  }
});

// Endpoint: Admin Live Indicative Dashboard Statistics
app.get('/api/admin/dashboard-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const totalRow = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ?`, [estateId]);
    const draftRow = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'draft'`, [estateId]);
    const releasedRow = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND status = 'released'`, [estateId]);
    const assignedRow = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND (status = 'assigned' OR status = 'completed' OR status = 'distributed' OR id IN (SELECT item_id FROM assignments))`, [estateId]);
    const completedRow = await dbGet(`SELECT COUNT(*) as count FROM items WHERE estate_id = ? AND (status = 'completed' OR status = 'distributed')`, [estateId]);

    const recentAudit = await dbAll(`
      SELECT audit_logs.*, users.name as user_name 
      FROM audit_logs 
      LEFT JOIN users ON audit_logs.user_id = users.id 
      WHERE audit_logs.estate_id = ? 
      ORDER BY audit_logs.created_at DESC 
      LIMIT 25
    `, [estateId]);

    const needsDecision = await dbAll(`
      SELECT items.id, items.title, COUNT(interests.id) as interest_count
      FROM items
      JOIN interests ON items.id = interests.item_id
      WHERE items.estate_id = ? AND items.status != 'assigned' AND items.status != 'completed'
      GROUP BY items.id
      HAVING interest_count > 1
    `, [estateId]);

    res.json({
      totalItems: totalRow?.count || 0,
      draftItems: draftRow?.count || 0,
      releasedItems: releasedRow?.count || 0,
      assignedItems: assignedRow?.count || 0,
      completedItems: completedRow?.count || 0,
      needsDecision: needsDecision || [],
      recentAudit: recentAudit || []
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// Endpoint: Admin Audit Logs
app.get('/api/admin/audit-logs', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const logs = await dbAll(`
      SELECT audit_logs.*, users.name as user_name, users.email as user_email
      FROM audit_logs 
      LEFT JOIN users ON audit_logs.user_id = users.id 
      WHERE audit_logs.estate_id = ? 
      ORDER BY audit_logs.created_at DESC 
      LIMIT 100
    `, [estateId]);
    res.json(logs);
  } catch (err) {
    console.error("Audit logs error:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Uncle Jim's Estate server running on http://0.0.0.0:${PORT}`);
});
