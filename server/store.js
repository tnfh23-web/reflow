import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const dataDir = path.resolve('data');
export const mediaDir = path.join(dataDir, 'media');
mkdirSync(mediaDir, { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, 'reflow.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS refs(id TEXT PRIMARY KEY,owner TEXT,document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT NOT NULL,document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media(name TEXT PRIMARY KEY,owner TEXT);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,ref_id TEXT NOT NULL,owner TEXT NOT NULL,state TEXT NOT NULL);`);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function refs(owner) { return db.prepare('SELECT document FROM refs WHERE owner IS ?').all(owner).map(r => JSON.parse(r.document)); }
export function getRef(id, owner) { const r = db.prepare('SELECT document FROM refs WHERE id=? AND (owner=? OR owner IS NULL)').get(id, owner || ''); return r ? JSON.parse(r.document) : null; }
export function saveRef(ref, owner) { db.prepare('INSERT INTO refs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(ref.id,owner,JSON.stringify(ref)); return ref; }
export function projects(owner) { return db.prepare('SELECT document FROM projects WHERE owner=?').all(owner).map(r => JSON.parse(r.document)).sort((a,b)=>b.updated.localeCompare(a.updated)); }
export function getProject(id, owner) { const r = db.prepare('SELECT document FROM projects WHERE id=? AND owner=?').get(id,owner); return r ? JSON.parse(r.document) : null; }
export function saveProject(p, owner) { p.updated=now(); db.prepare('INSERT INTO projects VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(p.id,owner,JSON.stringify(p)); return p; }
export function registerMedia(name, owner) { db.prepare('INSERT OR IGNORE INTO media VALUES(?,?)').run(name,owner); return `/api/media/${name}`; }
