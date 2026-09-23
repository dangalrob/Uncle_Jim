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
import { extractLegacyData } from './services/legacyNormalization.js';
import { generateAIAssessment } from './services/aiAssessment.js';
import { assessItem } from './services/itemAssessmentEngine.js';

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
const BACKUPS_DIR = path.join(STORAGE_ROOT, 'backups');

[DATA_DIR, UPLOADS_DIR, FULL_UPLOADS_DIR, THUMB_UPLOADS_DIR, BACKUPS_DIR].forEach(dir => {
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
    db.run(`ALTER TABLE items ADD COLUMN client_id TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN era TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN destination TEXT DEFAULT 'undecided'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN updated_at DATETIME`, () => {});
    db.run(`ALTER TABLE item_photos ADD COLUMN original_photo_url TEXT`, () => {});
    db.run(`ALTER TABLE item_photos ADD COLUMN updated_at DATETIME`, () => {});
    db.run(`ALTER TABLE item_stories ADD COLUMN user_id TEXT`, () => {});
    db.run(`ALTER TABLE item_stories ADD COLUMN user_name TEXT`, () => {});

    // ----------------------------------------------------
    // PHASE 1 SCHEMA EXPANSION: AI Assessment, Provenance, Valuation, Snapshots
    // ----------------------------------------------------
    // 1. Items Table Additions
    db.run(`ALTER TABLE items ADD COLUMN origin TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN materials TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN maker TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN identifying_marks TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN provenance_text TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN estimated_value_low REAL`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN estimated_value_high REAL`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN distribution_value REAL`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN counts_against_distribution INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN value_basis TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN assessment_confidence TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN confidence_reason TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN appraisal_recommended INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN appraisal_reason TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN assessment_date DATETIME`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN assessment_status TEXT DEFAULT 'not_started'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN normalization_status TEXT DEFAULT 'not_reviewed'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN legacy_assessment_notes TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN research_level TEXT DEFAULT 'UNASSESSED'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN threshold_status TEXT DEFAULT 'unknown'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN identification_confidence TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN value_confidence TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN acquisition_context TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN jim_connection_type TEXT DEFAULT 'UNKNOWN'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN jim_connection_notes TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN legacy_significance TEXT DEFAULT 'none'`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN legacy_significance_reason TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN verification_needed TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN object_type TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN model TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN historical_cultural_context TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN follow_up_worthwhile TEXT`, () => {});
    db.run(`ALTER TABLE items ADD COLUMN assessment_version TEXT DEFAULT 'ITEM_ASSESSMENT_V1'`, () => {});

    // 2. Estates Table Additions (Configurable distribution threshold)
    db.run(`ALTER TABLE estates ADD COLUMN distribution_threshold_value REAL DEFAULT 100.0`, () => {});

    // 2b. Users Table Additions (Active status and Admin notes)
    db.run(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN notes TEXT`, () => {});

    // 3. Item Stories Additions (Museum Curation Flags)
    db.run(`ALTER TABLE item_stories ADD COLUMN is_curated_for_museum INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE item_stories ADD COLUMN curator_notes TEXT`, () => {});

    // 4. Item Photos Additions (Museum Presentation Flags)
    db.run(`ALTER TABLE item_photos ADD COLUMN is_featured_for_museum INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE item_photos ADD COLUMN curator_caption TEXT`, () => {});

    // 5. New Table: Immutable Legacy Snapshots
    db.run(`CREATE TABLE IF NOT EXISTS item_legacy_snapshots (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      original_title TEXT,
      original_description TEXT,
      original_special_handling_notes TEXT,
      original_value TEXT,
      original_provenance TEXT,
      original_era TEXT,
      snapshot_type TEXT NOT NULL DEFAULT 'PRE_NORMALIZATION_BASELINE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_legacy_snapshots_item ON item_legacy_snapshots(item_id)`);

    // 6. New Table: Assessment History
    db.run(`CREATE TABLE IF NOT EXISTS assessment_history (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      assessment_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      created_by_user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_by_user_id TEXT,
      approved_at DATETIME,
      superseded_by_id TEXT,
      estimated_value_low REAL,
      estimated_value_high REAL,
      distribution_value REAL,
      counts_against_distribution INTEGER DEFAULT 0,
      value_basis TEXT,
      confidence_level TEXT,
      confidence_reason TEXT,
      appraisal_recommended INTEGER DEFAULT 0,
      appraisal_reason TEXT,
      assessment_notes TEXT,
      payload_json TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_assessment_history_item ON assessment_history(item_id)`);

    // 7. New Table: Research Sources (Associated with specific assessment and item)
    db.run(`CREATE TABLE IF NOT EXISTS item_research_sources (
      id TEXT PRIMARY KEY,
      assessment_id TEXT,
      item_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'REFERENCE_SOURCE',
      title TEXT,
      price REAL,
      sale_date TEXT,
      url TEXT,
      relevance_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessment_history(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_research_sources_item ON item_research_sources(item_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_research_sources_assessment ON item_research_sources(assessment_id)`);
    db.run(`ALTER TABLE item_research_sources ADD COLUMN website_or_org TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN original_url TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN listing_date TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN source_date TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN asking_price REAL`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN sold_price REAL`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN currency TEXT DEFAULT 'USD'`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN status TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN relevance TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN used_for TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN date_accessed TEXT`, () => {});
    db.run(`ALTER TABLE item_research_sources ADD COLUMN notes TEXT`, () => {});

    // 8. New Table: Travel & Voyage Connections (Distinguishes proven vs possible travel overlap)
    db.run(`CREATE TABLE IF NOT EXISTS item_travel_connections (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      voyage_name TEXT,
      destination_or_port TEXT,
      period_start TEXT,
      period_end TEXT,
      connection_type TEXT NOT NULL DEFAULT 'PLAUSIBLE_OVERLAP',
      certainty_level TEXT NOT NULL DEFAULT 'SPECULATIVE_OVERLAP',
      evidence_text TEXT NOT NULL,
      notes TEXT,
      is_curated_for_museum INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by_user_id TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_travel_connections_item ON item_travel_connections(item_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS item_questions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      question TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      answer TEXT,
      is_answered INTEGER DEFAULT 0,
      answered_by_user_id TEXT,
      answered_by_name TEXT,
      answered_at DATETIME
    )`);

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
        ['cat_6', 'estate_uncle_jim', 'Household & Kitchenware', '🍽️'],
        ['cat_packers', 'estate_uncle_jim', 'Packers', '🏈'],
        ['cat_guns', 'estate_uncle_jim', 'Guns', '🎯'],
        ['cat_other', 'estate_uncle_jim', 'Other', '📦'],
        ['cat_electronics', 'estate_uncle_jim', 'Electronics', '⚡'],
        ['cat_camera_video', 'estate_uncle_jim', 'Camera & Video Equipment', '📷'],
        ['cat_framed_photos', 'estate_uncle_jim', 'Framed Photographs', '🖼️'],
        ['cat_decorative', 'estate_uncle_jim', 'Decorative Items', '🏺']
      ];
      for (const [id, eId, name, icon] of cats) {
        await dbRun(`INSERT INTO categories (id, estate_id, name, icon) VALUES (?, ?, ?, ?)`, [id, eId, name, icon]);
      }
    }

    // Ensure 'Packers', 'Guns', 'Other', 'Electronics', 'Camera & Video Equipment', 'Framed Photographs', and 'Decorative Items' categories exist in existing database
    const extraCategories = [
      ['cat_packers', 'estate_uncle_jim', 'Packers', '🏈'],
      ['cat_guns', 'estate_uncle_jim', 'Guns', '🎯'],
      ['cat_other', 'estate_uncle_jim', 'Other', '📦'],
      ['cat_electronics', 'estate_uncle_jim', 'Electronics', '⚡'],
      ['cat_camera_video', 'estate_uncle_jim', 'Camera & Video Equipment', '📷'],
      ['cat_framed_photos', 'estate_uncle_jim', 'Framed Photographs', '🖼️'],
      ['cat_decorative', 'estate_uncle_jim', 'Decorative Items', '🏺']
    ];
    for (const [id, eId, name, icon] of extraCategories) {
      const existing = await dbGet(`SELECT id FROM categories WHERE name = ?`, [name]);
      if (!existing) {
        await dbRun(`INSERT INTO categories (id, estate_id, name, icon) VALUES (?, ?, ?, ?)`, [id, eId, name, icon]);
      }
    }

    // Seed Users
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
      const existing = await dbGet(`SELECT id FROM users WHERE id = ? OR email = ?`, [id, email]);
      if (!existing) {
        await dbRun(`INSERT INTO users (id, estate_id, name, email, password_hash, role, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
          id, eId, name, email, pass, role, phone, addr
        ]);
      }
    }

    // Ensure all 9 draft participants exist
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

let lastServerError = null;
let lastMulterErrorDetails = null;

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(FULL_UPLOADS_DIR)) {
        fs.mkdirSync(FULL_UPLOADS_DIR, { recursive: true });
      }
      cb(null, FULL_UPLOADS_DIR);
    } catch (err) {
      lastMulterErrorDetails = {
        phase: 'destination',
        error: err.message,
        stack: err.stack,
        code: err.code
      };
      console.error("[Multer Storage Destination Error]:", err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const origName = (file && typeof file.originalname === 'string') ? file.originalname : 'photo.jpg';
      const ext = path.extname(origName) || '.jpg';
      cb(null, 'photo-' + uniqueSuffix + ext);
    } catch (err) {
      lastMulterErrorDetails = {
        phase: 'filename',
        error: err.message,
        stack: err.stack,
        code: err.code,
        fileMetadata: {
          fieldname: file?.fieldname,
          mimetype: file?.mimetype,
          encoding: file?.encoding
        }
      };
      console.error("[Multer Storage Filename Error]:", err);
      cb(err);
    }
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per photo
    fieldSize: 20 * 1024 * 1024 // 20 MB for text fields
  }
});

// Controlled Multer middleware wrapper for Rapid Capture
const handleRapidUpload = (req, res, next) => {
  const reqStart = Date.now();
  const cType = req.headers['content-type'] ? req.headers['content-type'].split(';')[0] : 'unknown';
  const cLength = req.headers['content-length'] ? `${Math.round(req.headers['content-length'] / 1024)} KB` : 'unknown';
  console.log(`[RapidCapture Incoming]: Method=${req.method} Path=${req.path} ContentType=${cType} ContentLength=${cLength}`);

  upload.any()(req, res, (err) => {
    const duration = Date.now() - reqStart;
    if (err) {
      const errorPayload = {
        name: err.name,
        code: err.code || lastMulterErrorDetails?.code || 'MULTER_ERROR',
        message: err.message,
        stage: 'multipart-receive',
        phase: lastMulterErrorDetails?.phase || (err.code ? 'limit_enforcement' : 'stream_write'),
        path: req.path,
        method: req.method,
        field: err.field || null,
        contentType: req.headers['content-type'] ? req.headers['content-type'].split(';')[0] : null,
        contentLength: req.headers['content-length'] || null,
        durationMs: duration,
        stack: err.stack
      };

      console.error(`[RapidCapture Multer Error after ${duration}ms]:`, errorPayload);
      lastServerError = {
        timestamp: new Date().toISOString(),
        ...errorPayload
      };

      return res.status(400).json({
        error: `Upload failed in ${errorPayload.phase}: ${err.message}`,
        stage: 'multipart-receive',
        code: errorPayload.code,
        message: err.message,
        phase: errorPayload.phase,
        field: errorPayload.field,
        durationMs: duration
      });
    }
    console.log(`[RapidCapture Multipart Parsed]: Files=${req.files?.length || 0} BodyKeys=${Object.keys(req.body).length} Duration=${duration}ms`);
    next();
  });
};

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Serve static uploads with long-lived browser caching and ETags
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  etag: true,
  lastModified: true
}));

// Serve static assets from dist/
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.includes(path.sep + 'assets' + path.sep)) {
      // Hashed assets (e.g. index-DyVRqmqL.js) can be cached immutably
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

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
    const cleanEmail = email.toLowerCase().trim();
    let user = await dbGet(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    
    // Support @example.com alias to @unclejim.estate
    if (!user && cleanEmail.endsWith('@example.com')) {
      const aliasEmail = cleanEmail.replace('@example.com', '@unclejim.estate');
      user = await dbGet(`SELECT * FROM users WHERE email = ?`, [aliasEmail]);
    }

    // Support plain username or id without domain (e.g. 'dan', 'user_dan', 'sarah')
    if (!user && !cleanEmail.includes('@')) {
      user = await dbGet(`SELECT * FROM users WHERE email = ? OR id = ? OR LOWER(name) = ?`, [
        `${cleanEmail}@unclejim.estate`,
        cleanEmail.startsWith('user_') ? cleanEmail : `user_${cleanEmail}`,
        cleanEmail
      ]);
    }

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isLombardi = password.trim().toLowerCase() === 'lombardi';
    const isValid = isLombardi || (await bcrypt.compare(password, user.password_hash));
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

app.get('/api/auth/family-members', async (req, res) => {
  try {
    // Return approved family members (exclude institutional accounts like City Historical Museum)
    const members = await dbAll(
      `SELECT id, name, email, role FROM users WHERE role IN ('admin', 'reviewer', 'contributor') ORDER BY name ASC`
    );
    res.json({ members });
  } catch (err) {
    console.error("Failed to list family members:", err);
    res.status(500).json({ error: "Failed to list family members" });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('uj_token');
  res.json({ success: true });
});

// Regular User: Change My Password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All password fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New password and confirmation password do not match." });
    }

    if (newPassword.trim().length < 4) {
      return res.status(400).json({ error: "New password must be at least 4 characters." });
    }

    // Fetch user with password_hash
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentValid) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);

    // Record activity audit log (Never log the password itself)
    logAudit(user.estate_id, user.id, 'CHANGE_PASSWORD', 'users', user.id, {
      message: `${user.name} changed their password`
    });

    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password." });
  }
});

// Admin: Get all users with roles (sanitized, no password hashes)
app.get('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT id, estate_id, name, email, role, phone, address, is_active, notes, created_at
       FROM users
       WHERE estate_id = ?
       ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, name ASC`,
      [req.user.estate_id]
    );
    res.json({ users });
  } catch (err) {
    console.error("Failed to list users for admin:", err);
    res.status(500).json({ error: "Failed to list users." });
  }
});

// Admin: Add a new user
app.post('/api/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, role, password, notes, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!email || !email.trim()) return res.status(400).json({ error: "Email is required." });
    if (!password || !password.trim()) return res.status(400).json({ error: "Password is required." });

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await dbGet(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ error: "A user with this email address already exists." });
    }

    const validRoles = ['admin', 'reviewer', 'contributor', 'institution'];
    const assignedRole = validRoles.includes(role) ? role : 'reviewer';
    const activeStatus = (is_active === 0 || is_active === false) ? 0 : 1;

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const newUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    await dbRun(
      `INSERT INTO users (id, estate_id, name, email, password_hash, role, notes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUserId, req.user.estate_id, name.trim(), normalizedEmail, passwordHash, assignedRole, notes ? notes.trim() : null, activeStatus]
    );

    logAudit(req.user.estate_id, req.user.id, 'CREATE_USER', 'users', newUserId, {
      name: name.trim(),
      email: normalizedEmail,
      role: assignedRole,
      is_active: activeStatus
    });

    res.json({
      success: true,
      user: {
        id: newUserId,
        estate_id: req.user.estate_id,
        name: name.trim(),
        email: normalizedEmail,
        role: assignedRole,
        notes: notes ? notes.trim() : null,
        is_active: activeStatus
      }
    });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user." });
  }
});

// Admin: Update an existing user
app.put('/api/admin/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { name, email, role, notes, is_active } = req.body;

    const targetUser = await dbGet(`SELECT * FROM users WHERE id = ? AND estate_id = ?`, [targetUserId, req.user.estate_id]);
    if (!targetUser) return res.status(404).json({ error: "User not found." });

    // Guard: Prevent deactivating your own logged-in account
    if (targetUserId === req.user.id && (is_active === 0 || is_active === false)) {
      return res.status(400).json({ error: "You cannot deactivate your own active admin account." });
    }

    const validRoles = ['admin', 'reviewer', 'contributor', 'institution'];
    const updatedRole = role && validRoles.includes(role) ? role : targetUser.role;
    const updatedName = name !== undefined && name !== null ? name.trim() : targetUser.name;
    const updatedEmail = email !== undefined && email !== null ? email.trim().toLowerCase() : targetUser.email;
    const updatedNotes = notes !== undefined ? (notes ? notes.trim() : null) : targetUser.notes;
    const updatedActive = is_active !== undefined ? ((is_active === 0 || is_active === false) ? 0 : 1) : (targetUser.is_active !== undefined ? targetUser.is_active : 1);

    if (updatedEmail !== targetUser.email) {
      const emailConflict = await dbGet(`SELECT id FROM users WHERE email = ? AND id != ?`, [updatedEmail, targetUserId]);
      if (emailConflict) return res.status(400).json({ error: "Another user already uses this email address." });
    }

    await dbRun(
      `UPDATE users SET name = ?, email = ?, role = ?, notes = ?, is_active = ? WHERE id = ?`,
      [updatedName, updatedEmail, updatedRole, updatedNotes, updatedActive, targetUserId]
    );

    logAudit(req.user.estate_id, req.user.id, 'UPDATE_USER', 'users', targetUserId, {
      name: updatedName,
      email: updatedEmail,
      role: updatedRole,
      is_active: updatedActive,
      previousActive: targetUser.is_active
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user." });
  }
});

// Admin: Reset/change a user's password
app.post('/api/admin/users/:id/reset-password', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { newPassword } = req.body;

    const targetUser = await dbGet(`SELECT * FROM users WHERE id = ? AND estate_id = ?`, [targetUserId, req.user.estate_id]);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // Protect Dan from being reset by other accounts
    if (targetUser.id === 'user_dan' && req.user.id !== 'user_dan') {
      return res.status(403).json({
        error: "Dan's primary admin account password cannot be reset by another user."
      });
    }

    const passwordToSet = newPassword && newPassword.trim() ? newPassword.trim() : 'Lombardi';
    if (!passwordToSet) {
      return res.status(400).json({ error: "A non-empty password is required." });
    }

    const passwordHash = await bcrypt.hash(passwordToSet, 10);
    await dbRun(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, targetUser.id]);

    // Record activity audit log (Never include the password itself)
    logAudit(req.user.estate_id, req.user.id, 'RESET_PASSWORD', 'users', targetUser.id, {
      message: `${req.user.name} reset ${targetUser.name}'s password`
    });

    res.json({
      success: true,
      message: `Password for ${targetUser.name} has been updated.`
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset user password." });
  }
});

// ----------------------------------------------------
// RAPID MOBILE PHOTO CAPTURE & ITEM CREATION
// ----------------------------------------------------
app.post('/api/items/rapid-capture', authenticateToken, requireRole(['admin', 'contributor']), handleRapidUpload, async (req, res) => {
  try {
    const { title, locationInHouse, categoryId, description, notes, value, institutionalCandidate, institutionalName, clientId } = req.body;
    const clientIdParam = (clientId || req.body.client_id || '').trim();
    let itemId = 'item_' + Date.now();
    let itemNumber = 'UJ-' + Math.floor(100 + Math.random() * 900);
    const itemTitle = (title !== undefined && title !== null) ? title.trim() : '';
    const itemLocation = (locationInHouse !== undefined && locationInHouse !== null) ? locationInHouse.trim() : '';
    const itemDesc = (description || notes || '').trim();
    const itemValue = (value !== undefined && value !== null) ? value.trim() : '';
    const instCandidate = (institutionalCandidate || 'None').trim();
    const instName = (institutionalName || '').trim();

    let existingItem = null;
    if (clientIdParam) {
      existingItem = await dbGet(`SELECT * FROM items WHERE client_id = ? OR id = ?`, [clientIdParam, clientIdParam]);
    }

    if (existingItem) {
      itemId = existingItem.id;
      itemNumber = existingItem.item_number;
      await dbRun(
        `UPDATE items SET title = ?, category_id = ?, location_in_house = ?, description = ?, value = ?, institutional_candidate = ?, institutional_name = ? WHERE id = ?`,
        [itemTitle, categoryId || null, itemLocation || null, itemDesc || null, itemValue || null, instCandidate, instName || null, itemId]
      );
    } else {
      await dbRun(
        `INSERT INTO items (id, estate_id, item_number, title, category_id, location_in_house, description, value, status, institutional_candidate, institutional_name, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        [itemId, req.user.estate_id, itemNumber, itemTitle, categoryId || null, itemLocation || null, itemDesc || null, itemValue || null, instCandidate, instName || null, clientIdParam || null]
      );
    }

    const savedPhotos = [];
    const allFiles = req.files || [];
    const originalFiles = allFiles.filter(f => f.fieldname === 'photos');
    const croppedFiles = allFiles.filter(f => f.fieldname === 'croppedPhotos' || f.fieldname === 'croppedPhoto');

    const existingPhotos = existingItem
      ? await dbAll(`SELECT id, photo_url, thumbnail_url, is_primary FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId])
      : [];

    const filesToProcess = originalFiles.length > 0 ? originalFiles : croppedFiles;

    if (filesToProcess.length > 0) {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const croppedFile = originalFiles.length > 0 ? (croppedFiles[i] || (i === 0 ? croppedFiles[0] : null)) : file;
        const thumbFilename = 'thumb-' + file.filename.replace(/\.[^/.]+$/, "") + '.webp';
        const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

        // Generate high quality webp thumbnail preserving crop aspect ratio (fit: inside) with fallback
        const sourceForThumb = croppedFile ? croppedFile.path : file.path;
        try {
          await sharp(sourceForThumb)
            .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toFile(thumbPath);
        } catch (sharpErr) {
          console.warn("Sharp thumbnail generation warning, using fallback copy:", sharpErr.message);
          try {
            fs.copyFileSync(sourceForThumb, thumbPath);
          } catch (copyErr) {}
        }

        let photoUrl = `/uploads/full/${file.filename}`;
        const originalPhotoUrl = `/uploads/full/${file.filename}`;

        // If a cropped version was provided, save the high-res cropped version to full uploads
        if (croppedFile && croppedFile !== file) {
          const croppedFilename = 'crop-' + file.filename.replace(/\.[^/.]+$/, "") + '.webp';
          const croppedFullPath = path.join(FULL_UPLOADS_DIR, croppedFilename);
          try {
            await sharp(croppedFile.path)
              .toFormat('webp', { quality: 90 })
              .toFile(croppedFullPath);
            photoUrl = `/uploads/full/${croppedFilename}`;
          } catch (sharpCropErr) {
            console.warn("Sharp crop save warning, keeping source file:", sharpCropErr.message);
            photoUrl = `/uploads/full/${file.filename}`;
          }
        } else if (croppedFile && originalFiles.length === 0) {
          photoUrl = `/uploads/full/${file.filename}`;
        }

        const thumbnailUrl = fs.existsSync(thumbPath) ? `/uploads/thumbs/${thumbFilename}` : photoUrl;
        const photoId = 'photo_' + Date.now() + '_' + i;
        const isPrimary = (existingPhotos.length === 0 && i === 0) ? 1 : 0;

        await dbRun(
          `INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, original_photo_url, is_primary, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [photoId, itemId, photoUrl, thumbnailUrl, originalPhotoUrl, isPrimary, existingPhotos.length + i]
        );

        savedPhotos.push({ id: photoId, photo_url: photoUrl, thumbnail_url: thumbnailUrl, photoUrl, thumbnailUrl, original_photo_url: originalPhotoUrl, isPrimary });
      }
    }

    logAudit(req.user.estate_id, req.user.id, 'RAPID_CAPTURE_ITEM', 'items', itemId, { title: itemTitle, photosCount: savedPhotos.length });

    const finalPhotos = savedPhotos.length > 0 ? savedPhotos : existingPhotos;
    const primaryPhoto = finalPhotos[0]?.photo_url || finalPhotos[0]?.photoUrl || null;
    const primaryThumb = finalPhotos[0]?.thumbnail_url || finalPhotos[0]?.thumbnailUrl || null;

    res.json({
      success: true,
      item: {
        id: itemId,
        clientId: clientIdParam || null,
        item_number: itemNumber,
        itemNumber,
        title: itemTitle,
        status: existingItem ? existingItem.status : 'draft',
        photos: finalPhotos,
        primary_photo: primaryPhoto,
        primary_thumb: primaryThumb
      }
    });
  } catch (err) {
    console.error("Rapid capture error in route handler:", err);
    lastServerError = {
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      stage: 'route-processing',
      name: err.name,
      code: err.code || 'ROUTE_ERROR',
      message: err.message,
      stack: err.stack
    };
    res.status(500).json({
      error: `Failed to process rapid capture upload: ${err.message}`,
      stage: 'route-processing',
      code: err.code || 'ROUTE_ERROR',
      message: err.message
    });
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
             (SELECT id FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_photo_id,
             (SELECT COALESCE(updated_at, created_at) FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_photo_updated_at,
             (SELECT COUNT(*) FROM interests WHERE item_id = i.id AND interest_level = 'interested') as interested_count,
             (SELECT COUNT(*) FROM interests WHERE item_id = i.id AND user_id = ? AND interest_level = 'interested') as user_interested,
             (SELECT GROUP_CONCAT(u.name, ', ') FROM interests int_sub JOIN users u ON int_sub.user_id = u.id WHERE int_sub.item_id = i.id AND int_sub.interest_level = 'interested') as interested_names,
             (SELECT recipient_user_id FROM assignments WHERE item_id = i.id) as assigned_to_user_id,
             (SELECT u.name FROM assignments a JOIN users u ON a.recipient_user_id = u.id WHERE a.item_id = i.id) as assigned_to_name,
             (SELECT destination_name FROM assignments WHERE item_id = i.id) as destination_name,
             (SELECT destination_type FROM assignments WHERE item_id = i.id) as destination_type,
             (SELECT is_locked FROM assignments WHERE item_id = i.id) as is_locked
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.estate_id = ?
    `;
    const params = [req.user.id, req.user.estate_id];

    // Standard family users (non-admin) can only see released or assigned items
    if (req.user.role !== 'admin') {
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
      query += ` AND (i.title LIKE ? OR i.description LIKE ? OR i.location_in_house LIKE ? OR i.notes LIKE ? OR i.item_number LIKE ? OR c.name LIKE ? OR i.destination LIKE ? OR i.institutional_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s);
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
        p.photo_version = `${p.id}_${(p.thumbnail_url || p.photo_url || '').replace(/[^a-zA-Z0-9]/g, '_')}_${p.updated_at || p.created_at || '1'}`;
        photosByItem[p.item_id].push(p);
      }
      for (const item of items) {
        item.photos = photosByItem[item.id] || [];
        const pId = item.primary_photo_id || (item.photos[0]?.id) || 'none';
        const pThumb = item.primary_thumb || (item.photos[0]?.thumbnail_url) || (item.primary_photo) || 'none';
        const pUp = item.primary_photo_updated_at || (item.photos[0]?.updated_at) || item.updated_at || item.created_at || '1';
        item.primary_thumb_version = `${pId}_${pThumb.replace(/[^a-zA-Z0-9]/g, '_')}_${pUp}`;
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
    if (req.user.role !== 'admin' && !['released', 'assigned', 'distributed', 'completed'].includes(item.status)) {
      return res.status(404).json({ error: "Item not found" });
    }

    const photos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [item.id]);
    const stories = await dbAll(`SELECT * FROM item_stories WHERE item_id = ? ORDER BY created_at ASC`, [item.id]);
    const questions = await dbAll(`SELECT * FROM item_questions WHERE item_id = ? ORDER BY created_at ASC`, [item.id]);
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

    res.json({ ...item, photos, stories, questions, interests, assignment, fulfillment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load item details" });
  }
});

app.put('/api/items/:id', authenticateToken, requireRole(['admin', 'contributor']), async (req, res) => {
  try {
    const { title, era, categoryId, locationInHouse, location, condition, dimensions, weight, specialHandlingNotes, notes, description, storyText, provenanceSource, isHighValue, value, status, institutionalCandidate, institutional_candidate, institutionalName, institutional_name, destination } = req.body;
    const itemId = req.params.id;
    const finalLocation = locationInHouse !== undefined ? locationInHouse : location;
    const finalNotes = specialHandlingNotes !== undefined ? specialHandlingNotes : notes;
    const finalInstCandidate = institutionalCandidate !== undefined ? institutionalCandidate : institutional_candidate;
    const finalInstName = institutionalName !== undefined ? institutionalName : institutional_name;

    await dbRun(`
      UPDATE items
      SET title = COALESCE(?, title),
          era = COALESCE(?, era),
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
          institutional_name = CASE WHEN ? = 1 THEN ? ELSE institutional_name END,
          destination = CASE WHEN ? = 1 THEN ? ELSE destination END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND estate_id = ?
    `, [
      title !== undefined ? title : null,
      era !== undefined ? era : null,
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
      destination !== undefined ? 1 : 0,
      destination !== undefined ? destination : null,
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

// Endpoint: Release single item for family review (Admin only)
app.post('/api/items/:id/release', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const estateId = req.user.estate_id;
    const item = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    await dbRun(`UPDATE items SET status = 'released' WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    logAudit(estateId, req.user.id, 'RELEASE_ITEM', 'items', itemId, { previousStatus: item.status, newStatus: 'released', title: item.title });

    res.json({ success: true, status: 'released', message: "Item released for family review" });
  } catch (err) {
    console.error("Release item error:", err);
    res.status(500).json({ error: "Failed to release item" });
  }
});

// Endpoint: Unrelease single item back to draft / Not Released (Admin only)
app.post('/api/items/:id/unrelease', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const estateId = req.user.estate_id;
    const item = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    await dbRun(`UPDATE items SET status = 'draft' WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    logAudit(estateId, req.user.id, 'UNRELEASE_ITEM', 'items', itemId, { previousStatus: item.status, newStatus: 'draft', title: item.title });

    res.json({ success: true, status: 'draft', message: "Item returned to Not Released" });
  } catch (err) {
    console.error("Unrelease item error:", err);
    res.status(500).json({ error: "Failed to unrelease item" });
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

// Endpoint: Set a photo as Primary for an Item
app.post('/api/items/:id/photos/:photoId/set-primary', authenticateToken, requireRole(['admin', 'contributor']), async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;
    const item = await dbGet(`SELECT id FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const photo = await dbGet(`SELECT * FROM item_photos WHERE id = ? AND item_id = ?`, [photoId, itemId]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    // Set all other photos to non-primary, and this one to primary
    await dbRun(`UPDATE item_photos SET is_primary = 0 WHERE item_id = ?`, [itemId]);
    await dbRun(`UPDATE item_photos SET is_primary = 1 WHERE id = ?`, [photoId]);

    const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'SET_PRIMARY_PHOTO', 'item_photos', photoId, { itemId });

    res.json({ success: true, photos: allPhotos });
  } catch (err) {
    console.error("Failed to set primary photo:", err);
    res.status(500).json({ error: "Failed to set primary photo" });
  }
});

// Endpoint: Update crop for a photo (saves high-res cropped version as photo_url and updates thumbnail_url, preserving original_photo_url)
app.put('/api/items/:id/photos/:photoId/crop', authenticateToken, requireRole(['admin', 'contributor']), upload.single('croppedImage'), async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;
    const item = await dbGet(`SELECT id FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const photo = await dbGet(`SELECT * FROM item_photos WHERE id = ? AND item_id = ?`, [photoId, itemId]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    if (!req.file) {
      return res.status(400).json({ error: "No cropped image uploaded" });
    }

    const fileBase = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const croppedFilename = 'crop-' + fileBase + '.webp';
    const croppedFullPath = path.join(FULL_UPLOADS_DIR, croppedFilename);
    const thumbFilename = 'thumb-' + fileBase + '.webp';
    const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

    // Save high quality cropped version to full uploads
    await sharp(req.file.path)
      .toFormat('webp', { quality: 90 })
      .toFile(croppedFullPath);

    // Save thumbnail version from cropped file
    await sharp(req.file.path)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .toFormat('webp', { quality: 80 })
      .toFile(thumbPath);

    // Clean up temporary uploaded file if in full uploads
    if (fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    const newPhotoUrl = `/uploads/full/${croppedFilename}`;
    const newThumbUrl = `/uploads/thumbs/${thumbFilename}`;
    const origUrl = photo.original_photo_url || photo.photo_url;

    await dbRun(
      `UPDATE item_photos SET photo_url = ?, thumbnail_url = ?, original_photo_url = COALESCE(original_photo_url, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPhotoUrl, newThumbUrl, origUrl, photoId]
    );

    const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'CROP_ITEM_PHOTO', 'item_photos', photoId, { itemId });

    res.json({ success: true, photo: { ...photo, photo_url: newPhotoUrl, thumbnail_url: newThumbUrl }, photos: allPhotos });
  } catch (err) {
    console.error("Failed to crop photo:", err);
    res.status(500).json({ error: "Failed to update cropped photo" });
  }
});

// Endpoint: Restore photo framing to original (regenerates thumbnail_url and restores photo_url from original)
app.post('/api/items/:id/photos/:photoId/restore-crop', authenticateToken, requireRole(['admin', 'contributor']), async (req, res) => {
  try {
    const { id: itemId, photoId } = req.params;
    const item = await dbGet(`SELECT id FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const photo = await dbGet(`SELECT * FROM item_photos WHERE id = ? AND item_id = ?`, [photoId, itemId]);
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    const originalUrl = photo.original_photo_url || photo.photo_url;
    const originalRelPath = originalUrl.replace(/^\/uploads\//, '');
    const originalFullPath = path.join(UPLOADS_DIR, originalRelPath);

    if (!fs.existsSync(originalFullPath)) {
      return res.status(404).json({ error: "Original source photo file not found on disk" });
    }

    const thumbFilename = 'thumb-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + '.webp';
    const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

    await sharp(originalFullPath)
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .toFormat('webp', { quality: 80 })
      .toFile(thumbPath);

    const newThumbUrl = `/uploads/thumbs/${thumbFilename}`;
    await dbRun(`UPDATE item_photos SET photo_url = ?, thumbnail_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [originalUrl, newThumbUrl, photoId]);

    const allPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'RESTORE_ORIGINAL_PHOTO', 'item_photos', photoId, { itemId });

    res.json({ success: true, photo: { ...photo, photo_url: originalUrl, thumbnail_url: newThumbUrl }, photos: allPhotos });
  } catch (err) {
    console.error("Failed to restore original photo:", err);
    res.status(500).json({ error: "Failed to restore original photo" });
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
// STORIES & QUESTIONS ENDPOINTS
// ----------------------------------------------------

// Submit a story for an item
app.post('/api/items/:id/stories', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { storyText, provenanceSource } = req.body;
    if (!storyText || !storyText.trim()) {
      return res.status(400).json({ error: "Story text is required" });
    }

    const item = await dbGet(`SELECT id, title FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const storyId = 'story_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await dbRun(
      `INSERT INTO item_stories (id, item_id, user_id, user_name, story_text, provenance_source) VALUES (?, ?, ?, ?, ?, ?)`,
      [storyId, itemId, req.user.id, req.user.name, storyText.trim(), provenanceSource || `${req.user.name}'s Memory`]
    );

    logAudit(req.user.estate_id, req.user.id, 'SUBMIT_STORY', 'item_stories', storyId, { itemId, itemTitle: item.title });

    const stories = await dbAll(`SELECT * FROM item_stories WHERE item_id = ? ORDER BY created_at ASC`, [itemId]);
    res.json({ success: true, stories });
  } catch (err) {
    console.error("Failed to submit story:", err);
    res.status(500).json({ error: "Failed to submit story" });
  }
});

// Phase 1 Endpoint: Admin Curate Story for Museum
app.patch('/api/admin/stories/:id/curate', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { isCurated, curatorNotes } = req.body;
    await dbRun(
      `UPDATE item_stories SET is_curated_for_museum = ?, curator_notes = ? WHERE id = ?`,
      [isCurated ? 1 : 0, curatorNotes || null, req.params.id]
    );
    res.json({ success: true, isCurated: !!isCurated });
  } catch (err) {
    console.error("Failed to update story curation:", err);
    res.status(500).json({ error: "Failed to update story curation" });
  }
});

// Phase 1 Endpoint: Admin Curate Photo for Museum
app.patch('/api/admin/photos/:id/curate', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { isFeatured, curatorCaption } = req.body;
    await dbRun(
      `UPDATE item_photos SET is_featured_for_museum = ?, curator_caption = ? WHERE id = ?`,
      [isFeatured ? 1 : 0, curatorCaption || null, req.params.id]
    );
    res.json({ success: true, isFeatured: !!isFeatured });
  } catch (err) {
    console.error("Failed to update photo curation:", err);
    res.status(500).json({ error: "Failed to update photo curation" });
  }
});

// Phase 1 Endpoint: Get Item Legacy Snapshots
app.get('/api/items/:id/snapshots', authenticateToken, async (req, res) => {
  try {
    const snapshots = await dbAll(
      `SELECT * FROM item_legacy_snapshots WHERE item_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(snapshots || []);
  } catch (err) {
    console.error("Failed to fetch snapshots:", err);
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

// Phase 1 Endpoint: Get Item Assessment History
app.get('/api/items/:id/assessment-history', authenticateToken, async (req, res) => {
  try {
    const history = await dbAll(
      `SELECT h.*, u.name as approved_by_name 
       FROM assessment_history h
       LEFT JOIN users u ON h.approved_by_user_id = u.id
       WHERE h.item_id = ? 
       ORDER BY h.created_at DESC`,
      [req.params.id]
    );
    res.json(history || []);
  } catch (err) {
    console.error("Failed to fetch assessment history:", err);
    res.status(500).json({ error: "Failed to fetch assessment history" });
  }
});

// Phase 1 Endpoint: Get Item Travel Connections
app.get('/api/items/:id/travel-connections', authenticateToken, async (req, res) => {
  try {
    const connections = await dbAll(
      `SELECT * FROM item_travel_connections WHERE item_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(connections || []);
  } catch (err) {
    console.error("Failed to fetch travel connections:", err);
    res.status(500).json({ error: "Failed to fetch travel connections" });
  }
});

// Phase 1 Endpoint: Get Estate Distribution Settings
app.get('/api/estate/distribution-settings', authenticateToken, async (req, res) => {
  try {
    const estate = await dbGet(`SELECT id, distribution_threshold_value FROM estates WHERE id = ?`, [req.user.estate_id]);
    res.json({
      thresholdValue: (estate && estate.distribution_threshold_value != null) ? estate.distribution_threshold_value : 100.0
    });
  } catch (err) {
    console.error("Failed to fetch distribution settings:", err);
    res.status(500).json({ error: "Failed to fetch distribution settings" });
  }
});

// Phase 1 Endpoint: Admin Update Estate Distribution Settings
app.patch('/api/admin/estate/distribution-settings', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { thresholdValue } = req.body;
    const parsed = parseFloat(thresholdValue);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: "Threshold value must be a non-negative number" });
    }
    await dbRun(
      `UPDATE estates SET distribution_threshold_value = ? WHERE id = ?`,
      [parsed, req.user.estate_id]
    );
    await logAudit(
      req.user.estate_id,
      req.user.id,
      'UPDATE_DISTRIBUTION_THRESHOLD',
      'estates',
      req.user.estate_id,
      { newThreshold: parsed }
    );
    res.json({ success: true, thresholdValue: parsed });
  } catch (err) {
    console.error("Failed to update distribution threshold:", err);
    res.status(500).json({ error: "Failed to update distribution threshold" });
  }
});

// Submit a question for an item
app.post('/api/items/:id/questions', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question text is required" });
    }

    const item = await dbGet(`SELECT id, title FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const questionId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await dbRun(
      `INSERT INTO item_questions (id, item_id, user_id, user_name, question) VALUES (?, ?, ?, ?, ?)`,
      [questionId, itemId, req.user.id, req.user.name, question.trim()]
    );

    logAudit(req.user.estate_id, req.user.id, 'SUBMIT_QUESTION', 'item_questions', questionId, { itemId, itemTitle: item.title, question: question.trim() });

    const questions = await dbAll(`SELECT * FROM item_questions WHERE item_id = ? ORDER BY created_at ASC`, [itemId]);
    res.json({ success: true, questions });
  } catch (err) {
    console.error("Failed to submit question:", err);
    res.status(500).json({ error: "Failed to submit question" });
  }
});

// Get questions for an item
app.get('/api/items/:id/questions', authenticateToken, async (req, res) => {
  try {
    const questions = await dbAll(`SELECT * FROM item_questions WHERE item_id = ? ORDER BY created_at ASC`, [req.params.id]);
    res.json({ questions });
  } catch (err) {
    console.error("Failed to load item questions:", err);
    res.status(500).json({ error: "Failed to load item questions" });
  }
});

// Admin: View all questions with optional status filter (all, unanswered, answered)
app.get('/api/admin/questions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const status = req.query.status || 'all';
    let query = `
      SELECT q.*, i.title as item_title, i.item_number, i.status as item_status,
             (SELECT thumbnail_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as item_thumb
      FROM item_questions q
      JOIN items i ON q.item_id = i.id
      WHERE i.estate_id = ?
    `;
    const params = [req.user.estate_id];

    if (status === 'unanswered') {
      query += ` AND (q.is_answered = 0 OR q.is_answered IS NULL)`;
    } else if (status === 'answered') {
      query += ` AND q.is_answered = 1`;
    }

    query += ` ORDER BY q.created_at DESC`;

    const questions = await dbAll(query, params);
    res.json({ questions });
  } catch (err) {
    console.error("Failed to list questions for admin:", err);
    res.status(500).json({ error: "Failed to list questions" });
  }
});

// Admin: Answer a question
app.put('/api/admin/questions/:id/answer', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || !answer.trim()) {
      return res.status(400).json({ error: "Answer text is required" });
    }

    const question = await dbGet(`SELECT * FROM item_questions WHERE id = ?`, [req.params.id]);
    if (!question) return res.status(404).json({ error: "Question not found" });

    await dbRun(
      `UPDATE item_questions SET answer = ?, is_answered = 1, answered_by_user_id = ?, answered_by_name = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [answer.trim(), req.user.id, req.user.name, req.params.id]
    );

    logAudit(req.user.estate_id, req.user.id, 'ANSWER_QUESTION', 'item_questions', req.params.id, {
      itemId: question.item_id,
      answeredTo: question.user_name,
      answer: answer.trim()
    });

    const updated = await dbGet(`SELECT * FROM item_questions WHERE id = ?`, [req.params.id]);
    res.json({ success: true, question: updated });
  } catch (err) {
    console.error("Failed to answer question:", err);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

// Admin: View all stories across inventory
app.get('/api/admin/stories', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT s.*, i.title as item_title, i.item_number, i.status as item_status,
             (SELECT thumbnail_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as item_thumb
      FROM item_stories s
      JOIN items i ON s.item_id = i.id
      WHERE i.estate_id = ?
      ORDER BY s.created_at DESC
    `;
    const stories = await dbAll(query, [req.user.estate_id]);
    res.json({ stories });
  } catch (err) {
    console.error("Failed to list stories for admin:", err);
    res.status(500).json({ error: "Failed to list stories" });
  }
});

// Admin: View all family interests summarized
app.get('/api/admin/interests', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT int.*, u.name as user_name, u.email as user_email,
             i.title as item_title, i.item_number, i.status as item_status,
             i.description as item_description, i.destination as item_destination,
             c.name as category_name,
             (SELECT thumbnail_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as item_thumb,
             (SELECT u2.name FROM assignments a JOIN users u2 ON a.recipient_user_id = u2.id WHERE a.item_id = i.id) as assigned_to_name
      FROM interests int
      JOIN users u ON int.user_id = u.id
      JOIN items i ON int.item_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.estate_id = ?
      ORDER BY i.title ASC, int.created_at ASC
    `;
    const interests = await dbAll(query, [req.user.estate_id]);
    res.json({ interests });
  } catch (err) {
    console.error("Failed to list interests for admin:", err);
    res.status(500).json({ error: "Failed to list interests" });
  }
});

// ----------------------------------------------------
// ASSIGNMENT & CONFLICT RESOLUTION ENDPOINTS
// ----------------------------------------------------
app.post('/api/items/:id/assign', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    let { recipientUserId, destinationType, destinationName, isLocked } = req.body;

    const item = await dbGet(`SELECT id, title, status FROM items WHERE id = ? AND estate_id = ?`, [itemId, req.user.estate_id]);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const existing = await dbGet(`
      SELECT a.*, u.name as recipient_name 
      FROM assignments a 
      LEFT JOIN users u ON a.recipient_user_id = u.id 
      WHERE a.item_id = ?
    `, [itemId]);

    if (existing && existing.is_locked === 1 && req.body.forceUnlock !== true) {
      return res.status(400).json({ error: "Assignment is locked and finalized. Unlock it first to make changes." });
    }

    const previousAssignee = existing
      ? (existing.recipient_name || (existing.destination_type === 'tbd' ? 'TBD' : existing.destination_name) || 'Unassigned')
      : 'Unassigned';

    let targetUserId = null;
    let targetDestType = destinationType || 'family';
    let targetDestName = destinationName || null;
    let newStatus = 'assigned';

    // Handle Unassigned
    if (!recipientUserId || recipientUserId === 'unassigned' || recipientUserId === 'none') {
      if (destinationType === 'tbd' || recipientUserId === 'tbd') {
        targetUserId = null;
        targetDestType = 'tbd';
        targetDestName = 'TBD';
      } else {
        targetUserId = null;
        targetDestType = 'undecided';
        targetDestName = null;
        newStatus = item.status === 'assigned' ? 'released' : item.status;
      }
    } else if (recipientUserId === 'tbd') {
      targetUserId = null;
      targetDestType = 'tbd';
      targetDestName = 'TBD';
    } else {
      // Normal user assignment
      const user = await dbGet(`SELECT id, name, email FROM users WHERE id = ? AND estate_id = ?`, [recipientUserId, req.user.estate_id]);
      if (!user) return res.status(404).json({ error: "Assigned user not found" });
      targetUserId = user.id;
      targetDestType = 'family';
      targetDestName = user.name;
    }

    // Default lock value is 0 (unlocked) unless explicitly specified
    const lockVal = (isLocked !== undefined && isLocked !== null) ? (isLocked ? 1 : 0) : (existing ? existing.is_locked : 0);

    if (existing) {
      if (!targetUserId && targetDestType === 'undecided') {
        await dbRun(`DELETE FROM assignments WHERE id = ?`, [existing.id]);
      } else {
        await dbRun(
          `UPDATE assignments SET recipient_user_id = ?, destination_type = ?, destination_name = ?, is_locked = ?, assigned_by_user_id = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [targetUserId, targetDestType, targetDestName, lockVal, req.user.id, existing.id]
        );
      }
    } else if (targetUserId || targetDestType === 'tbd') {
      await dbRun(
        `INSERT INTO assignments (id, item_id, recipient_user_id, destination_type, destination_name, is_locked, assigned_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['assign_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4), itemId, targetUserId, targetDestType, targetDestName, lockVal, req.user.id]
      );
    }

    await dbRun(`UPDATE items SET status = ? WHERE id = ? AND estate_id = ?`, [newStatus, itemId, req.user.estate_id]);

    const newAssignee = targetDestType === 'tbd' ? 'TBD' : (targetDestName || 'Unassigned');

    logAudit(req.user.estate_id, req.user.id, 'ASSIGN_ITEM', 'items', itemId, {
      itemId,
      itemTitle: item.title,
      previousAssignment: previousAssignee,
      newAssignment: newAssignee,
      changedBy: req.user.name,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      assignment: {
        item_id: itemId,
        recipient_user_id: targetUserId,
        recipient_name: targetDestName,
        destination_type: targetDestType,
        destination_name: targetDestName,
        is_locked: lockVal
      },
      status: newStatus
    });
  } catch (err) {
    console.error("Failed to assign item:", err);
    res.status(500).json({ error: "Failed to assign item" });
  }
});

app.post('/api/items/:id/lock', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await dbGet(`SELECT title FROM items WHERE id = ?`, [itemId]);
    await dbRun(`UPDATE assignments SET is_locked = 1 WHERE item_id = ?`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'LOCK_ASSIGNMENT', 'items', itemId, {
      itemId,
      itemTitle: item ? item.title : '',
      changedBy: req.user.name,
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to lock assignment" });
  }
});

app.post('/api/items/:id/unlock', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const itemId = req.params.id;
    const item = await dbGet(`SELECT title FROM items WHERE id = ?`, [itemId]);
    await dbRun(`UPDATE assignments SET is_locked = 0 WHERE item_id = ?`, [itemId]);
    logAudit(req.user.estate_id, req.user.id, 'UNLOCK_ASSIGNMENT', 'items', itemId, {
      itemId,
      itemTitle: item ? item.title : '',
      changedBy: req.user.name,
      timestamp: new Date().toISOString()
    });
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
  const users = await dbAll(`SELECT id, name, email, role, phone, address, is_active, notes FROM users WHERE estate_id = ? ORDER BY name ASC`, [req.user.estate_id]);
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
    let query = `
      SELECT i.id, i.title, i.category_id, i.location_in_house, i.description, int.interest_level, int.comment, int.created_at as marked_at,
             (SELECT photo_url FROM item_photos WHERE item_id = i.id ORDER BY is_primary DESC LIMIT 1) as primary_photo
      FROM interests int
      JOIN items i ON int.item_id = i.id
      WHERE int.user_id = ?
    `;
    const params = [req.user.id];
    if (req.user.role !== 'admin') {
      query += ` AND i.status IN ('released', 'assigned', 'distributed', 'completed')`;
    }
    query += ` ORDER BY int.created_at DESC`;
    const interests = await dbAll(query, params);
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

// Endpoint: Admin Create Database Backup (Safe online SQLite backup using VACUUM INTO)
app.post('/api/admin/database/backup', authenticateToken, requireRole(['admin']), async (req, res) => {
  let backupFilePath = null;
  let backupDb = null;
  try {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    let filename = `estate_backup_pre_ai_${stamp}.db`;
    backupFilePath = path.join(BACKUPS_DIR, filename);

    if (fs.existsSync(backupFilePath)) {
      filename = `estate_backup_pre_ai_${stamp}${pad(now.getSeconds())}.db`;
      backupFilePath = path.join(BACKUPS_DIR, filename);
    }

    // 1. Transactionally consistent SQLite online backup using VACUUM INTO
    await new Promise((resolve, reject) => {
      db.run('VACUUM INTO ?', [backupFilePath], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. Open the completed backup database for verification
    backupDb = new sqlite3.Database(backupFilePath, sqlite3.OPEN_READONLY);

    // 3. Run PRAGMA integrity_check on the backup
    const integrityRow = await new Promise((resolve, reject) => {
      backupDb.get('PRAGMA integrity_check', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const integrityOk = integrityRow && (integrityRow.integrity_check === 'ok');
    if (!integrityOk) {
      throw new Error(`Integrity check failed: ${integrityRow ? integrityRow.integrity_check : 'unknown'}`);
    }

    // 4. Compare key record counts between live DB and backup DB
    const tablesToCompare = [
      'items',
      'users',
      'item_photos',
      'item_stories',
      'item_questions',
      'interests',
      'assignments',
      'fulfillments',
      'audit_logs',
      'draft_order',
      'draft_picks',
      'item_legacy_snapshots',
      'assessment_history',
      'item_research_sources',
      'item_travel_connections'
    ];

    const comparison = {};
    let allMatched = true;

    for (const table of tablesToCompare) {
      const liveTableCheck = await dbGet(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
      if (!liveTableCheck) continue;

      const liveCountRow = await dbGet(`SELECT COUNT(*) as count FROM ${table}`);
      const backupCountRow = await new Promise((resolve, reject) => {
        backupDb.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const liveCount = liveCountRow ? liveCountRow.count : 0;
      const backupCount = backupCountRow ? backupCountRow.count : 0;
      const match = (liveCount === backupCount);
      if (!match) allMatched = false;

      comparison[table] = {
        live: liveCount,
        backup: backupCount,
        match
      };
    }

    // Close backupDb handle before reading file stats or returning
    await new Promise((resolve) => backupDb.close(() => { backupDb = null; resolve(); }));

    if (!allMatched) {
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
      return res.status(500).json({
        error: 'Backup verification failed: Record counts between live database and backup copy do not match.',
        comparison
      });
    }

    // 5. Gather file stats
    const stats = fs.statSync(backupFilePath);
    const fileSizeBytes = stats.size;
    const fileSizeFormatted = fileSizeBytes > 1024 * 1024 
      ? (fileSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
      : (fileSizeBytes / 1024).toFixed(1) + ' KB';

    // 6. Log audit event
    await logAudit(
      req.user.estate_id,
      req.user.id,
      'CREATE_DATABASE_BACKUP',
      'database_backup',
      filename,
      {
        filename,
        fileSizeBytes,
        status: 'VERIFIED',
        message: `${req.user.name} created verified production database backup ${filename}`
      }
    );

    res.json({
      success: true,
      filename,
      status: 'VERIFIED',
      integrityCheck: 'OK',
      createdAt: stats.mtime.toISOString(),
      fileSizeBytes,
      fileSizeFormatted,
      comparison,
      allMatched: true
    });
  } catch (err) {
    if (backupDb) {
      try { backupDb.close(); } catch (_) {}
    }
    if (backupFilePath && fs.existsSync(backupFilePath)) {
      try { fs.unlinkSync(backupFilePath); } catch (_) {}
    }
    console.error('Database backup error:', err);
    res.status(500).json({ error: `Failed to create database backup: ${err.message}` });
  }
});

// Endpoint: Admin List Database Backups
app.get('/api/admin/database/backups', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => /^estate_backup_.*\.db$/.test(f))
      .map(filename => {
        const filePath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: stats.size > 1024 * 1024 
            ? (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
            : (stats.size / 1024).toFixed(1) + ' KB',
          createdAt: stats.mtime.toISOString(),
          isPreAiBaseline: filename.includes('pre_ai')
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(files);
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: 'Failed to list database backups' });
  }
});

// Endpoint: Admin Download Database Backup
app.get('/api/admin/database/backup/:filename/download', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!/^estate_backup_.*\.db$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.download(filePath, filename);
  } catch (err) {
    console.error('Download backup error:', err);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Endpoint: Admin Delete Database Backup
app.delete('/api/admin/database/backups/:filename', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!/^estate_backup_.*\.db$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    if (filename.includes('pre_ai') && req.query.confirm !== 'true') {
      return res.status(400).json({ 
        error: 'This is a protected Pre-AI baseline backup. To delete, confirm explicit deletion.' 
      });
    }

    fs.unlinkSync(filePath);

    await logAudit(
      req.user.estate_id,
      req.user.id,
      'DELETE_DATABASE_BACKUP',
      'database_backup',
      filename,
      { filename, message: `${req.user.name} deleted database backup ${filename}` }
    );

    res.json({ success: true, message: `Backup ${filename} deleted successfully` });
  } catch (err) {
    console.error('Delete backup error:', err);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// ----------------------------------------------------
// PHASE 2: LEGACY DATA NORMALIZATION PILOT ENDPOINTS
// ----------------------------------------------------

// List items with legacy notes and their normalization status for the Admin pilot
app.get('/api/admin/normalize/items', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const items = await dbAll(`
      SELECT 
        items.id, items.title, items.description, items.special_handling_notes, items.value,
        items.era, items.origin, items.maker, items.materials, items.dimensions, items.condition,
        items.estimated_value_low, items.estimated_value_high, items.distribution_value,
        items.normalization_status, items.legacy_assessment_notes, items.created_at,
        (SELECT COUNT(*) FROM item_legacy_snapshots WHERE item_id = items.id) as snapshot_count,
        (SELECT photo_url FROM item_photos WHERE item_id = items.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_photo,
        (SELECT thumbnail_url FROM item_photos WHERE item_id = items.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as primary_thumb
      FROM items
      WHERE items.estate_id = ?
      ORDER BY 
        CASE 
          WHEN items.special_handling_notes IS NOT NULL AND items.special_handling_notes != '' THEN 0
          WHEN items.description LIKE '%value%' OR items.description LIKE '%dollar%' OR items.description LIKE '%worth%' THEN 1
          ELSE 2 
        END,
        items.created_at ASC
    `, [estateId]);

    // Fetch configurable distribution threshold
    const estate = await dbGet(`SELECT distribution_threshold_value FROM estates WHERE id = ?`, [estateId]);
    const threshold = estate?.distribution_threshold_value || 100.0;

    res.json({ items, threshold });
  } catch (err) {
    console.error('List normalization items error:', err);
    res.status(500).json({ error: 'Failed to fetch items for normalization' });
  }
});

// Run AI / heuristic extraction against legacy item text (WITHOUT modifying items table)
app.post('/api/admin/normalize/extract/:itemId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { overrideResearchLevel, adminAnswers = {}, roundNumber = 1 } = req.body || {};
    const estateId = req.user.estate_id;

    const item = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Pre-extraction safeguard: Check if a baseline snapshot already exists
    let existingBaseline = await dbGet(
      `SELECT * FROM item_legacy_snapshots WHERE item_id = ? AND snapshot_type = 'PRE_NORMALIZATION_BASELINE' ORDER BY created_at ASC LIMIT 1`,
      [itemId]
    );

    let snapshotId = existingBaseline ? existingBaseline.id : null;
    let createdSnapshot = false;

    // Create immutable baseline snapshot only if one does not already exist
    if (!snapshotId) {
      snapshotId = 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      await dbRun(`
        INSERT INTO item_legacy_snapshots (
          id, item_id, original_title, original_description, original_special_handling_notes,
          original_value, original_provenance, original_era, snapshot_type, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRE_NORMALIZATION_BASELINE', ?)
      `, [
        snapshotId,
        item.id,
        item.title || null,
        item.description || null,
        item.special_handling_notes || null,
        item.value || null,
        item.provenance_text || null,
        item.era || null,
        req.user.id
      ]);
      createdSnapshot = true;

      await logAudit(
        estateId,
        req.user.id,
        'CREATE_LEGACY_SNAPSHOT',
        'item_legacy_snapshots',
        snapshotId,
        { itemId, snapshotType: 'PRE_NORMALIZATION_BASELINE' }
      );
    }

    // Retrieve approved research sources for evidence context
    const researchSources = await dbAll(
      `SELECT * FROM item_research_sources WHERE item_id = ? ORDER BY created_at DESC`,
      [itemId]
    );

    // Retrieve existing photos for multimodal evidence
    const itemPhotos = await dbAll(
      `SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`,
      [itemId]
    );
    const photoFiles = [];
    for (const p of itemPhotos) {
      if (p.photo_url) {
        const relPath = p.photo_url.replace(/^\/uploads\//, '');
        const diskPath = path.join(UPLOADS_DIR, relPath);
        if (fs.existsSync(diskPath)) {
          photoFiles.push({
            path: diskPath,
            label: p.is_primary ? 'Primary Photo' : 'Detail Photo',
            mimetype: diskPath.endsWith('.png') ? 'image/png' : (diskPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
          });
        }
      }
    }

    // Assemble rich evidence bundle to prevent recursive normalization of old AI prose
    const isRenormalization = Boolean(existingBaseline) || item.normalization_status === 'normalized' || Boolean(item.legacy_assessment_notes);
    const evidenceBundle = {
      item,
      baseline: existingBaseline || null,
      photos: photoFiles,
      researchSources: researchSources || [],
      adminAnswers: adminAnswers || {},
      isRenormalization,
      evidenceSources: {
        hasBaseline: Boolean(existingBaseline),
        hasPhotos: photoFiles.length > 0,
        hasApprovedFacts: Boolean(item.maker || item.dimensions || item.materials || item.origin || item.era),
        hasResearchSources: Boolean(researchSources && researchSources.length > 0),
        isRenormalization
      }
    };

    // Run extraction service with structured evidence bundle
    const proposed = await extractLegacyData(evidenceBundle, process.env.GEMINI_API_KEY, overrideResearchLevel, adminAnswers, roundNumber);

    // Check estate distribution threshold ($100 default)
    const estate = await dbGet(`SELECT distribution_threshold_value FROM estates WHERE id = ?`, [estateId]);
    const threshold = estate?.distribution_threshold_value || 100.0;
    const highVal = proposed.estimatedValueHigh || proposed.estimatedValueLow || 0;
    const exceedsThreshold = highVal >= threshold;

    // Return proposed extraction, baseline information, and evidence sources metadata
    res.json({
      success: true,
      snapshotId,
      createdSnapshot,
      threshold,
      exceedsThreshold,
      evidenceSources: evidenceBundle.evidenceSources,
      original: {
        id: item.id,
        title: item.title,
        description: item.description,
        special_handling_notes: item.special_handling_notes,
        value: item.value,
        origin: item.origin,
        era: item.era,
        materials: item.materials,
        maker: item.maker,
        model: item.model,
        identifying_marks: item.identifying_marks,
        provenance_text: item.provenance_text,
        dimensions: item.dimensions,
        condition: item.condition,
        estimated_value_low: item.estimated_value_low,
        estimated_value_high: item.estimated_value_high,
        distribution_value: item.distribution_value,
        counts_against_distribution: item.counts_against_distribution,
        value_basis: item.value_basis,
        research_level: item.research_level || 'UNASSESSED',
        threshold_status: item.threshold_status || 'unknown',
        identification_confidence: item.identification_confidence,
        value_confidence: item.value_confidence,
        acquisition_context: item.acquisition_context,
        historical_cultural_context: item.historical_cultural_context,
        jim_connection_type: item.jim_connection_type || 'UNKNOWN',
        jim_connection_notes: item.jim_connection_notes,
        legacy_significance: item.legacy_significance || 'none',
        legacy_significance_reason: item.legacy_significance_reason,
        verification_needed: item.verification_needed,
        follow_up_worthwhile: item.follow_up_worthwhile,
        object_type: item.object_type,
        assessment_version: item.assessment_version
      },
      proposed
    });
  } catch (err) {
    console.error('Extract legacy data error:', err);
    res.status(500).json({ error: 'Failed to extract legacy data: ' + err.message });
  }
});

// Re-evaluate assessment with Admin answers, additional uploaded photos, or updated evidence
app.post('/api/admin/assessment/evaluate', authenticateToken, requireRole(['admin']), upload.any(), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const {
      itemId,
      mode = 'LEGACY_NORMALIZATION',
      adminAnswersJson,
      confirmedAttributesJson,
      researchLevelOverride,
      roundNumber = 1
    } = req.body;

    let adminAnswers = {};
    if (adminAnswersJson) {
      try {
        adminAnswers = typeof adminAnswersJson === 'string' ? JSON.parse(adminAnswersJson) : adminAnswersJson;
      } catch (e) {}
    }

    let confirmedAttributes = {};
    if (confirmedAttributesJson) {
      try {
        confirmedAttributes = typeof confirmedAttributesJson === 'string' ? JSON.parse(confirmedAttributesJson) : confirmedAttributesJson;
      } catch (e) {}
    }

    let existingItem = null;
    let existingBaseline = null;
    let existingPhotos = [];
    let researchSources = [];

    if (itemId) {
      existingItem = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
      existingBaseline = await dbGet(
        `SELECT * FROM item_legacy_snapshots WHERE item_id = ? AND snapshot_type = 'PRE_NORMALIZATION_BASELINE' ORDER BY created_at ASC LIMIT 1`,
        [itemId]
      );
      existingPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);
      researchSources = await dbAll(`SELECT * FROM item_research_sources WHERE item_id = ? ORDER BY created_at DESC`, [itemId]);
    }

    // Assemble photos (uploaded + existing)
    const reqFiles = (req.files || []).map(f => ({
      path: f.path,
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype
    }));

    if (existingPhotos.length > 0) {
      for (const ep of existingPhotos) {
        if (ep.photo_url) {
          const relPath = ep.photo_url.replace(/^\/uploads\//, '');
          const diskPath = path.join(UPLOADS_DIR, relPath);
          if (fs.existsSync(diskPath)) {
            reqFiles.push({
              path: diskPath,
              label: ep.is_primary ? 'Primary Photo' : 'Detail Photo',
              mimetype: diskPath.endsWith('.png') ? 'image/png' : (diskPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
            });
          }
        }
      }
    }

    const evidence = {
      item: existingItem || {},
      baseline: existingBaseline || null,
      photos: reqFiles,
      researchSources,
      adminAnswers,
      confirmedAttributes: {
        ...(existingItem ? {
          maker: existingItem.maker,
          model: existingItem.model,
          materials: existingItem.materials,
          origin: existingItem.origin,
          era: existingItem.era,
          dimensions: existingItem.dimensions,
          condition: existingItem.condition,
          identifying_marks: existingItem.identifying_marks
        } : {}),
        ...confirmedAttributes
      }
    };

    const assessment = await assessItem({
      mode,
      evidence,
      researchLevelOverride: researchLevelOverride || null,
      roundNumber: parseInt(roundNumber, 10) || 1,
      apiKey: process.env.GEMINI_API_KEY
    });

    res.json({
      success: true,
      assessment,
      uploadedPhotoPaths: (req.files || []).map(f => f.path)
    });
  } catch (err) {
    console.error('Assessment evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate assessment: ' + err.message });
  }
});

// Admin approves field changes and commits them to items table
app.post('/api/admin/normalize/approve/:itemId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { itemId } = req.params;
    const estateId = req.user.estate_id;
    const { approvedFields, snapshotId, fullProposedPayload, researchSources } = req.body;

    if (!approvedFields) {
      return res.status(400).json({ error: 'approvedFields object is required' });
    }

    const currentItem = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
    if (!currentItem) return res.status(404).json({ error: 'Item not found' });

    // Ensure baseline snapshot exists
    let existingBaseline = await dbGet(
      `SELECT id FROM item_legacy_snapshots WHERE item_id = ? AND snapshot_type = 'PRE_NORMALIZATION_BASELINE'`,
      [itemId]
    );

    if (!existingBaseline) {
      const newSnapId = snapshotId || ('snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
      await dbRun(`
        INSERT INTO item_legacy_snapshots (
          id, item_id, original_title, original_description, original_special_handling_notes,
          original_value, original_provenance, original_era, snapshot_type, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRE_NORMALIZATION_BASELINE', ?)
      `, [
        newSnapId,
        currentItem.id,
        currentItem.title || null,
        currentItem.description || null,
        currentItem.special_handling_notes || null,
        currentItem.value || null,
        currentItem.provenance_text || null,
        currentItem.era || null,
        req.user.id
      ]);
    }

    // Combine original notes into legacy_assessment_notes for archival
    const legacyArchivePieces = [];
    if (currentItem.special_handling_notes && currentItem.special_handling_notes.trim()) {
      legacyArchivePieces.push(`=== ORIGINAL SPECIAL HANDLING / AI NOTES ===\n${currentItem.special_handling_notes.trim()}`);
    }
    if (currentItem.description && currentItem.description.trim()) {
      legacyArchivePieces.push(`=== ORIGINAL RAW DESCRIPTION ===\n${currentItem.description.trim()}`);
    }
    const legacyArchiveNotes = legacyArchivePieces.join('\n\n');

    // Values to apply to items table
    const title = approvedFields.title !== undefined ? approvedFields.title : currentItem.title;
    const cleanDescription = approvedFields.description !== undefined ? approvedFields.description : currentItem.description;
    const origin = approvedFields.origin !== undefined ? approvedFields.origin : currentItem.origin;
    const era = approvedFields.era !== undefined ? approvedFields.era : currentItem.era;
    const materials = approvedFields.materials !== undefined ? approvedFields.materials : currentItem.materials;
    const maker = approvedFields.maker !== undefined ? approvedFields.maker : currentItem.maker;
    const identifyingMarks = approvedFields.identifying_marks !== undefined ? approvedFields.identifying_marks : currentItem.identifying_marks;
    const provenanceText = approvedFields.provenance_text !== undefined ? approvedFields.provenance_text : currentItem.provenance_text;
    const dimensions = approvedFields.dimensions !== undefined ? approvedFields.dimensions : currentItem.dimensions;
    const condition = approvedFields.condition !== undefined ? approvedFields.condition : currentItem.condition;
    
    // Numeric valuation separation
    const estValLow = approvedFields.estimated_value_low !== undefined ? (parseFloat(approvedFields.estimated_value_low) || null) : currentItem.estimated_value_low;
    const estValHigh = approvedFields.estimated_value_high !== undefined ? (parseFloat(approvedFields.estimated_value_high) || null) : currentItem.estimated_value_high;
    const valueBasis = approvedFields.value_basis !== undefined ? approvedFields.value_basis : currentItem.value_basis;
    
    // Distribution value (only set if explicitly provided by Admin)
    const distributionValue = approvedFields.distribution_value !== undefined ? (parseFloat(approvedFields.distribution_value) || null) : currentItem.distribution_value;
    const countsAgainstDist = approvedFields.counts_against_distribution !== undefined ? (approvedFields.counts_against_distribution ? 1 : 0) : currentItem.counts_against_distribution;

    const researchLevel = approvedFields.research_level || currentItem.research_level || 'BASIC';
    const thresholdStatus = approvedFields.threshold_status || currentItem.threshold_status || 'unknown';
    const identificationConfidence = approvedFields.identification_confidence || currentItem.identification_confidence || 'MEDIUM';
    const valueConfidence = approvedFields.value_confidence || currentItem.value_confidence || 'LOW';
    const acquisitionContext = approvedFields.acquisition_context !== undefined ? approvedFields.acquisition_context : currentItem.acquisition_context;
    const jimConnectionType = approvedFields.jim_connection_type || currentItem.jim_connection_type || 'UNKNOWN';
    const jimConnectionNotes = approvedFields.jim_connection_notes !== undefined ? approvedFields.jim_connection_notes : currentItem.jim_connection_notes;
    const legacySignificance = approvedFields.legacy_significance || currentItem.legacy_significance || 'none';
    const legacySignificanceReason = approvedFields.legacy_significance_reason !== undefined ? approvedFields.legacy_significance_reason : currentItem.legacy_significance_reason;
    const verificationNeeded = approvedFields.verification_needed !== undefined ? approvedFields.verification_needed : currentItem.verification_needed;

    const assessmentConfidence = identificationConfidence || approvedFields.assessment_confidence || currentItem.assessment_confidence || 'MEDIUM';
    const confidenceReason = approvedFields.confidence_reason || currentItem.confidence_reason || null;
    const appraisalRecommended = approvedFields.appraisal_recommended ? 1 : 0;
    const appraisalReason = approvedFields.appraisal_reason || null;

    const model = approvedFields.model !== undefined ? approvedFields.model : currentItem.model;
    const objectType = approvedFields.object_type || approvedFields.objectType || currentItem.object_type || null;
    const historicalCulturalContext = approvedFields.historical_cultural_context !== undefined ? approvedFields.historical_cultural_context : (approvedFields.historicalCulturalContext || currentItem.historical_cultural_context || null);
    const followUpWorthwhile = approvedFields.follow_up_worthwhile !== undefined ? approvedFields.follow_up_worthwhile : (approvedFields.followUpWorthwhile || currentItem.follow_up_worthwhile || null);
    const assessmentVersion = approvedFields.assessment_version || 'ITEM_ASSESSMENT_V1';

    // Update the item record
    await dbRun(`
      UPDATE items SET
        title = ?,
        description = ?,
        origin = ?,
        era = ?,
        materials = ?,
        maker = ?,
        model = ?,
        identifying_marks = ?,
        provenance_text = ?,
        dimensions = ?,
        condition = ?,
        estimated_value_low = ?,
        estimated_value_high = ?,
        distribution_value = ?,
        counts_against_distribution = ?,
        value_basis = ?,
        assessment_confidence = ?,
        confidence_reason = ?,
        appraisal_recommended = ?,
        appraisal_reason = ?,
        research_level = ?,
        threshold_status = ?,
        identification_confidence = ?,
        value_confidence = ?,
        acquisition_context = ?,
        historical_cultural_context = ?,
        jim_connection_type = ?,
        jim_connection_notes = ?,
        legacy_significance = ?,
        legacy_significance_reason = ?,
        verification_needed = ?,
        follow_up_worthwhile = ?,
        object_type = ?,
        assessment_version = ?,
        legacy_assessment_notes = ?,
        special_handling_notes = '',
        normalization_status = 'normalized',
        assessment_status = 'completed',
        assessment_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND estate_id = ?
    `, [
      title,
      cleanDescription,
      origin,
      era,
      materials,
      maker,
      model,
      identifyingMarks,
      provenanceText,
      dimensions,
      condition,
      estValLow,
      estValHigh,
      distributionValue,
      countsAgainstDist,
      valueBasis,
      assessmentConfidence,
      confidenceReason,
      appraisalRecommended,
      appraisalReason,
      researchLevel,
      thresholdStatus,
      identificationConfidence,
      valueConfidence,
      acquisitionContext,
      historicalCulturalContext,
      jimConnectionType,
      jimConnectionNotes,
      legacySignificance,
      legacySignificanceReason,
      verificationNeeded,
      followUpWorthwhile,
      objectType,
      assessmentVersion,
      legacyArchiveNotes,
      itemId,
      estateId
    ]);

    // Record assessment in assessment_history table
    const historyId = 'ah_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    await dbRun(`
      INSERT INTO assessment_history (
        id, item_id, assessment_type, status, created_by_user_id, approved_by_user_id,
        approved_at, estimated_value_low, estimated_value_high, distribution_value,
        counts_against_distribution, value_basis, confidence_level, confidence_reason,
        appraisal_recommended, appraisal_reason, assessment_notes, payload_json
      ) VALUES (?, ?, 'LEGACY_NORMALIZATION', 'APPROVED', ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      historyId,
      itemId,
      req.user.id,
      req.user.id,
      estValLow,
      estValHigh,
      distributionValue,
      countsAgainstDist,
      valueBasis,
      assessmentConfidence,
      confidenceReason,
      appraisalRecommended,
      appraisalReason,
      'Approved via Legacy Data Normalization Wizard',
      JSON.stringify({
        approvedFields,
        fullProposedPayload: fullProposedPayload || null,
        previousState: {
          title: currentItem.title,
          description: currentItem.description,
          special_handling_notes: currentItem.special_handling_notes,
          value: currentItem.value
        }
      })
    ]);

    // Persist structured research sources
    const sourcesToSave = researchSources || approvedFields.research_sources || [];
    if (Array.isArray(sourcesToSave) && sourcesToSave.length > 0) {
      for (const s of sourcesToSave) {
        const sourceId = s.id && !String(s.id).startsWith('src_') ? s.id : ('src_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
        await dbRun(`
          INSERT INTO item_research_sources (
            id, assessment_id, item_id, source_name, source_type, website_or_org, title, price, asking_price, sold_price,
            currency, status, sale_date, listing_date, source_date, url, original_url, relevance_notes, relevance,
            used_for, date_accessed, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          sourceId,
          historyId,
          itemId,
          s.websiteOrOrg || s.website_or_org || s.source_name || 'Web Reference',
          s.sourceType || s.source_type || 'General Web Reference',
          s.websiteOrOrg || s.website_or_org || null,
          s.title || null,
          s.soldPrice || s.sold_price || s.askingPrice || s.asking_price || s.price || null,
          s.askingPrice || s.asking_price || null,
          s.soldPrice || s.sold_price || null,
          s.currency || 'USD',
          s.status || null,
          s.listingDate || s.listing_date || s.sourceDate || s.source_date || s.sale_date || null,
          s.listingDate || s.listing_date || s.sourceDate || s.source_date || s.sale_date || null,
          s.sourceDate || s.source_date || s.listingDate || s.listing_date || s.sale_date || null,
          s.url || s.originalUrl || s.original_url || null,
          s.originalUrl || s.original_url || s.url || null,
          s.relevance || s.relevance_notes || s.notes || null,
          s.relevance || null,
          s.usedFor || s.used_for || null,
          s.dateAccessed || s.date_accessed || new Date().toISOString().split('T')[0],
          s.notes || null
        ]);
      }
    }

    // Audit log
    await logAudit(
      estateId,
      req.user.id,
      'NORMALIZE_LEGACY_DATA',
      'items',
      itemId,
      {
        itemTitle: title,
        historyId,
        estValLow,
        estValHigh,
        distributionValue,
        countsAgainstDist
      }
    );

    const updatedItem = await dbGet(`SELECT * FROM items WHERE id = ?`, [itemId]);
    res.json({
      success: true,
      message: 'Item successfully normalized and archived.',
      item: updatedItem,
      historyId
    });
  } catch (err) {
    console.error('Approve normalization error:', err);
    res.status(500).json({ error: 'Failed to approve normalization: ' + err.message });
  }
});

// Endpoint: Fetch Research Sources for an item
app.get('/api/items/:id/research-sources', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sources = await dbAll(
      `SELECT * FROM item_research_sources WHERE item_id = ? ORDER BY created_at DESC`,
      [id]
    );
    res.json({ sources: sources || [] });
  } catch (err) {
    console.error('Fetch research sources error:', err);
    res.status(500).json({ error: 'Failed to fetch research sources' });
  }
});

// ----------------------------------------------------
// PHASE 3: AI-POWERED ITEM ASSESSMENT WIZARD ENDPOINTS
// ----------------------------------------------------

// 1. Generate Draft AI Assessment (Multimodal Vision / Guided Answers)
app.post('/api/admin/assess/generate', authenticateToken, requireRole(['admin']), upload.any(), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const { itemId, guidedAnswersJson } = req.body;

    let guidedAnswers = {};
    if (guidedAnswersJson) {
      try {
        guidedAnswers = typeof guidedAnswersJson === 'string' ? JSON.parse(guidedAnswersJson) : guidedAnswersJson;
      } catch (e) {
        console.warn('Could not parse guidedAnswersJson:', e.message);
      }
    }

    // If existing itemId provided, fetch existing item record and photos
    let existingItem = null;
    let existingPhotos = [];
    if (itemId) {
      existingItem = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
      if (existingItem) {
        existingPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);
      }
    }

    // Estate distribution threshold
    const estate = await dbGet(`SELECT distribution_threshold_value FROM estates WHERE id = ?`, [estateId]);
    const threshold = estate?.distribution_threshold_value || 100.0;

    // Photos provided in request or existing
    const reqFiles = (req.files || []).map(f => ({
      path: f.path,
      fieldname: f.fieldname,
      originalname: f.originalname,
      mimetype: f.mimetype
    }));

    // If existing item has photos on disk, include primary/first photos if no new upload
    if (reqFiles.length === 0 && existingPhotos.length > 0) {
      for (const ep of existingPhotos) {
        if (ep.photo_url) {
          const relPath = ep.photo_url.replace(/^\/uploads\//, '');
          const diskPath = path.join(UPLOADS_DIR, relPath);
          if (fs.existsSync(diskPath)) {
            reqFiles.push({
              path: diskPath,
              fieldname: 'existing_photo',
              originalname: path.basename(diskPath),
              mimetype: diskPath.endsWith('.webp') ? 'image/webp' : (diskPath.endsWith('.png') ? 'image/png' : 'image/jpeg')
            });
          }
        }
      }
    }

    // Call Assessment Service
    const assessment = await generateAIAssessment({
      photos: reqFiles,
      guidedAnswers,
      existingItem,
      distributionThreshold: threshold,
      apiKey: process.env.GEMINI_API_KEY
    });

    res.json({
      success: true,
      threshold,
      exceedsThreshold: assessment.exceedsThreshold,
      assessment,
      uploadedPhotoPaths: reqFiles.map(f => f.path)
    });
  } catch (err) {
    console.error('Generate AI assessment error:', err);
    res.status(500).json({ error: 'Failed to generate AI assessment: ' + err.message });
  }
});

// 2. Commit Approved AI Assessment (New Item or Existing Item Update)
app.post('/api/admin/assess/approve', authenticateToken, requireRole(['admin']), upload.any(), async (req, res) => {
  try {
    const estateId = req.user.estate_id;
    const { itemId: targetItemId, approvedFieldsJson, fullAssessmentPayloadJson } = req.body;

    let approvedFields = {};
    if (approvedFieldsJson) {
      try {
        approvedFields = typeof approvedFieldsJson === 'string' ? JSON.parse(approvedFieldsJson) : approvedFieldsJson;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid approvedFieldsJson: ' + e.message });
      }
    }

    let fullPayload = {};
    if (fullAssessmentPayloadJson) {
      try {
        fullPayload = typeof fullAssessmentPayloadJson === 'string' ? JSON.parse(fullAssessmentPayloadJson) : fullAssessmentPayloadJson;
      } catch (e) {}
    }

    let itemId = targetItemId;
    let isNewItem = false;
    let itemNumber = null;

    if (!itemId) {
      // Create new item
      isNewItem = true;
      itemId = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      itemNumber = 'UJ-' + Math.floor(1000 + Math.random() * 9000);

      await dbRun(`
        INSERT INTO items (
          id, estate_id, item_number, title, description, origin, era, materials, maker, model,
          identifying_marks, provenance_text, dimensions, condition, estimated_value_low,
          estimated_value_high, distribution_value, counts_against_distribution, value_basis,
          assessment_confidence, confidence_reason, appraisal_recommended, appraisal_reason,
          object_type, historical_cultural_context, follow_up_worthwhile, assessment_version,
          jim_connection_type, jim_connection_notes, legacy_significance, legacy_significance_reason,
          verification_needed, normalization_status,
          assessment_status, assessment_date, status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 'normalized',
          'completed', CURRENT_TIMESTAMP, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        itemId,
        estateId,
        itemNumber,
        approvedFields.title || 'Untitled Assessment Item',
        approvedFields.description || null,
        approvedFields.origin || null,
        approvedFields.era || null,
        approvedFields.materials || null,
        approvedFields.maker || null,
        approvedFields.model || null,
        approvedFields.identifying_marks || null,
        approvedFields.provenance_text || null,
        approvedFields.dimensions || null,
        approvedFields.condition || null,
        approvedFields.estimated_value_low !== undefined ? (parseFloat(approvedFields.estimated_value_low) || null) : null,
        approvedFields.estimated_value_high !== undefined ? (parseFloat(approvedFields.estimated_value_high) || null) : null,
        approvedFields.distribution_value !== undefined ? (parseFloat(approvedFields.distribution_value) || null) : null,
        approvedFields.counts_against_distribution ? 1 : 0,
        approvedFields.value_basis || null,
        approvedFields.assessment_confidence || 'MEDIUM',
        approvedFields.confidence_reason || null,
        approvedFields.appraisal_recommended ? 1 : 0,
        approvedFields.appraisal_reason || null,
        approvedFields.object_type || approvedFields.objectType || null,
        approvedFields.historical_cultural_context || approvedFields.historicalCulturalContext || null,
        approvedFields.follow_up_worthwhile || approvedFields.followUpWorthwhile || null,
        approvedFields.assessment_version || 'ITEM_ASSESSMENT_V1',
        approvedFields.jim_connection_type || 'UNKNOWN',
        approvedFields.jim_connection_notes || null,
        approvedFields.legacy_significance || 'none',
        approvedFields.legacy_significance_reason || null,
        approvedFields.verification_needed || null
      ]);
    } else {
      // Update existing item
      const currentItem = await dbGet(`SELECT * FROM items WHERE id = ? AND estate_id = ?`, [itemId, estateId]);
      if (!currentItem) return res.status(404).json({ error: 'Item not found' });

      await dbRun(`
        UPDATE items SET
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          origin = COALESCE(?, origin),
          era = COALESCE(?, era),
          materials = COALESCE(?, materials),
          maker = COALESCE(?, maker),
          model = COALESCE(?, model),
          identifying_marks = COALESCE(?, identifying_marks),
          provenance_text = COALESCE(?, provenance_text),
          dimensions = COALESCE(?, dimensions),
          condition = COALESCE(?, condition),
          estimated_value_low = ?,
          estimated_value_high = ?,
          distribution_value = ?,
          counts_against_distribution = ?,
          value_basis = COALESCE(?, value_basis),
          assessment_confidence = ?,
          confidence_reason = ?,
          appraisal_recommended = ?,
          appraisal_reason = ?,
          object_type = COALESCE(?, object_type),
          historical_cultural_context = COALESCE(?, historical_cultural_context),
          follow_up_worthwhile = COALESCE(?, follow_up_worthwhile),
          assessment_version = 'ITEM_ASSESSMENT_V1',
          jim_connection_type = COALESCE(?, jim_connection_type),
          jim_connection_notes = COALESCE(?, jim_connection_notes),
          legacy_significance = COALESCE(?, legacy_significance),
          legacy_significance_reason = COALESCE(?, legacy_significance_reason),
          verification_needed = COALESCE(?, verification_needed),
          normalization_status = 'normalized',
          assessment_status = 'completed',
          assessment_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND estate_id = ?
      `, [
        approvedFields.title !== undefined ? approvedFields.title : null,
        approvedFields.description !== undefined ? approvedFields.description : null,
        approvedFields.origin !== undefined ? approvedFields.origin : null,
        approvedFields.era !== undefined ? approvedFields.era : null,
        approvedFields.materials !== undefined ? approvedFields.materials : null,
        approvedFields.maker !== undefined ? approvedFields.maker : null,
        approvedFields.model !== undefined ? approvedFields.model : null,
        approvedFields.identifying_marks !== undefined ? approvedFields.identifying_marks : null,
        approvedFields.provenance_text !== undefined ? approvedFields.provenance_text : null,
        approvedFields.dimensions !== undefined ? approvedFields.dimensions : null,
        approvedFields.condition !== undefined ? approvedFields.condition : null,
        approvedFields.estimated_value_low !== undefined ? (parseFloat(approvedFields.estimated_value_low) || null) : currentItem.estimated_value_low,
        approvedFields.estimated_value_high !== undefined ? (parseFloat(approvedFields.estimated_value_high) || null) : currentItem.estimated_value_high,
        approvedFields.distribution_value !== undefined ? (parseFloat(approvedFields.distribution_value) || null) : currentItem.distribution_value,
        approvedFields.counts_against_distribution !== undefined ? (approvedFields.counts_against_distribution ? 1 : 0) : currentItem.counts_against_distribution,
        approvedFields.value_basis !== undefined ? approvedFields.value_basis : null,
        approvedFields.assessment_confidence || currentItem.assessment_confidence || 'MEDIUM',
        approvedFields.confidence_reason || currentItem.confidence_reason || null,
        approvedFields.appraisal_recommended ? 1 : 0,
        approvedFields.appraisal_reason || null,
        approvedFields.object_type || approvedFields.objectType || null,
        approvedFields.historical_cultural_context || approvedFields.historicalCulturalContext || null,
        approvedFields.follow_up_worthwhile || approvedFields.followUpWorthwhile || null,
        approvedFields.jim_connection_type || null,
        approvedFields.jim_connection_notes || null,
        approvedFields.legacy_significance || null,
        approvedFields.legacy_significance_reason || null,
        approvedFields.verification_needed || null,
        itemId,
        estateId
      ]);
    }

    // Process and attach newly uploaded photos if any
    const allFiles = req.files || [];
    if (allFiles.length > 0) {
      const existingPhotos = await dbAll(`SELECT id FROM item_photos WHERE item_id = ?`, [itemId]);
      let startIndex = existingPhotos.length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const thumbFilename = 'thumb-' + file.filename.replace(/\.[^/.]+$/, "") + '.webp';
        const thumbPath = path.join(THUMB_UPLOADS_DIR, thumbFilename);

        try {
          await sharp(file.path)
            .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toFile(thumbPath);
        } catch (sharpErr) {
          console.warn('Sharp thumbnail warning:', sharpErr.message);
          try { fs.copyFileSync(file.path, thumbPath); } catch (e) {}
        }

        const photoUrl = `/uploads/full/${file.filename}`;
        const thumbnailUrl = fs.existsSync(thumbPath) ? `/uploads/thumbs/${thumbFilename}` : photoUrl;
        const photoId = 'photo_' + Date.now() + '_' + i;
        const isPrimary = (startIndex === 0 && i === 0) ? 1 : 0;

        await dbRun(`
          INSERT INTO item_photos (id, item_id, photo_url, thumbnail_url, original_photo_url, is_primary, display_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [photoId, itemId, photoUrl, thumbnailUrl, photoUrl, isPrimary, startIndex + i]);
      }
    }

    // Record in assessment_history
    const historyId = 'ah_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    await dbRun(`
      INSERT INTO assessment_history (
        id, item_id, assessment_type, status, created_by_user_id, approved_by_user_id,
        approved_at, estimated_value_low, estimated_value_high, distribution_value,
        counts_against_distribution, value_basis, confidence_level, confidence_reason,
        appraisal_recommended, appraisal_reason, assessment_notes, payload_json
      ) VALUES (?, ?, 'AI_WIZARD_ASSESSMENT', 'APPROVED', ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      historyId,
      itemId,
      req.user.id,
      req.user.id,
      approvedFields.estimated_value_low !== undefined ? (parseFloat(approvedFields.estimated_value_low) || null) : null,
      approvedFields.estimated_value_high !== undefined ? (parseFloat(approvedFields.estimated_value_high) || null) : null,
      approvedFields.distribution_value !== undefined ? (parseFloat(approvedFields.distribution_value) || null) : null,
      approvedFields.counts_against_distribution ? 1 : 0,
      approvedFields.value_basis || null,
      approvedFields.assessment_confidence || 'MEDIUM',
      approvedFields.confidence_reason || null,
      approvedFields.appraisal_recommended ? 1 : 0,
      approvedFields.appraisal_reason || null,
      'Approved via AI-Powered Item Assessment Wizard',
      JSON.stringify({
        approvedFields,
        fullPayload,
        isNewItem
      })
    ]);

    // Audit log
    await logAudit(
      estateId,
      req.user.id,
      isNewItem ? 'CREATE_ITEM_AI_ASSESSMENT' : 'UPDATE_ITEM_AI_ASSESSMENT',
      'items',
      itemId,
      {
        itemTitle: approvedFields.title,
        isNewItem,
        historyId
      }
    );

    const savedItem = await dbGet(`SELECT * FROM items WHERE id = ?`, [itemId]);
    const savedPhotos = await dbAll(`SELECT * FROM item_photos WHERE item_id = ? ORDER BY is_primary DESC, display_order ASC`, [itemId]);

    res.json({
      success: true,
      message: isNewItem ? 'Item created and assessed successfully.' : 'Item assessment updated successfully.',
      item: { ...savedItem, photos: savedPhotos },
      historyId
    });
  } catch (err) {
    console.error('Approve assessment error:', err);
    res.status(500).json({ error: 'Failed to commit assessment: ' + err.message });
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

// Diagnostics endpoint to inspect the last server error
app.get('/api/admin/last-error', (req, res) => {
  res.json({
    lastServerError: lastServerError || "No errors recorded",
    lastMulterErrorDetails: lastMulterErrorDetails || null
  });
});

// Fallback to index.html for SPA routes (strictly no-cache for index.html)
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Global Express Error Handler (catches any error passed to next(err) from any middleware or route)
app.use((err, req, res, next) => {
  console.error("[Express Global Error Handler]:", {
    path: req.path,
    method: req.method,
    name: err.name,
    code: err.code,
    message: err.message,
    stack: err.stack
  });

  lastServerError = {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    stage: 'unhandled-middleware',
    name: err.name,
    code: err.code || 'SERVER_ERROR',
    message: err.message,
    stack: err.stack,
    contentType: req.headers['content-type'] ? req.headers['content-type'].split(';')[0] : null,
    contentLength: req.headers['content-length'] || null
  };

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || err.statusCode || 500).json({
    error: `Server error in ${req.path}: ${err.message || 'Internal error'}`,
    stage: 'unhandled-middleware',
    code: err.code || 'SERVER_ERROR',
    message: err.message
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Uncle Jim's Estate server running on http://0.0.0.0:${PORT}`);
});
