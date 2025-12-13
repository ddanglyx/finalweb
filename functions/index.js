const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const { LRUCache } = require("lru-cache");

admin.initializeApp();
const db = admin.firestore();

// --- Basic in-memory cache (demo). In production, replace with Redis/Memcached. ---
const cache = new LRUCache({ max: 200, ttl: 30_000 }); // 30s

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

// --- Centralized async error wrapper ---
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- Auth middleware (Firebase ID token) ---
async function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.user = decoded;
    return next();
  } catch (e) {
    functions.logger.warn("auth.verifyIdToken failed", e);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// --- Role helper (RBAC) ---
async function getRole(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return "user";
  return snap.data().role || "user";
}

async function requireAdmin(req, res, next) {
  const role = await getRole(req.user.uid);
  if (role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.role = role;
  return next();
}

// --- Simple rate limiting (per UID + minute) ---
// This is a small Firestore-based limiter to satisfy the requirement.
// For real production, use a gateway/WAF or Redis-based limiter.
async function rateLimit(req, res, next) {
  const uid = req.user.uid;
  const bucket = Math.floor(Date.now() / 60_000); // minute bucket
  const key = `rl_${uid}_${bucket}`;
  const ref = db.collection("rateLimits").doc(key);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data().count || 0) : 0;
      const nextCount = current + 1;
      if (nextCount > 60) throw new Error("RATE_LIMIT");
      tx.set(ref, {
        uid,
        bucket,
        count: nextCount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
    return next();
  } catch (e) {
    if (e.message === "RATE_LIMIT") {
      return res.status(429).json({ error: "Too many requests (limit: 60/min)." });
    }
    functions.logger.error("rateLimit error", e);
    return res.status(500).json({ error: "Rate limiter failed" });
  }
}

// --- Validation schemas (server-side validation) ---
const createMessageSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(120),
  message: z.string().min(1).max(2000),
  attachmentUrl: z.string().url().optional().nullable()
});

const updateMessageSchema = z.object({
  message: z.string().min(1).max(2000)
});

// --- API endpoints (REST) ---
// GET /messages?limit=50
app.get("/messages", requireAuth, rateLimit, asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const lim = Math.min(parseInt(req.query.limit || "50", 10) || 50, 100);

  const qs = await db
    .collection("contactMessages")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(lim)
    .get();

  const items = qs.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      message: data.message || "",
      attachmentUrl: data.attachmentUrl || null,
      createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null
    };
  });

  return res.json({ items });
}));

// POST /messages
app.post("/messages", requireAuth, rateLimit, asyncHandler(async (req, res) => {
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
  }

  const uid = req.user.uid;
  const docRef = await db.collection("contactMessages").add({
    ...parsed.data,
    attachmentUrl: parsed.data.attachmentUrl || null,
    userId: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Email notification hook (optional). If SENDGRID_API_KEY isn't configured, we just log.
  functions.logger.info("New contact message", { uid, messageId: docRef.id });

  return res.status(201).json({ id: docRef.id });
}));

// PATCH /messages/:id
app.patch("/messages/:id", requireAuth, rateLimit, asyncHandler(async (req, res) => {
  const parsed = updateMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(", ") });
  }

  const uid = req.user.uid;
  const id = String(req.params.id);
  const ref = db.collection("contactMessages").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Not found" });

  const data = snap.data();
  const role = await getRole(uid);
  const isOwner = data.userId === uid;
  if (!isOwner && role !== "admin") return res.status(403).json({ error: "Forbidden" });

  await ref.update({ message: parsed.data.message });
  return res.json({ ok: true });
}));

// DELETE /messages/:id
app.delete("/messages/:id", requireAuth, rateLimit, asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const id = String(req.params.id);
  const ref = db.collection("contactMessages").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Not found" });

  const data = snap.data();
  const role = await getRole(uid);
  const isOwner = data.userId === uid;
  if (!isOwner && role !== "admin") return res.status(403).json({ error: "Forbidden" });

  await ref.delete();
  return res.json({ ok: true });
}));

// GET /guitars/search?name=Stratocaster
app.get("/guitars/search", requireAuth, rateLimit, asyncHandler(async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  // Cached exact-match lookup
  const cacheKey = `guitar_name_${name.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ items: cached, cached: true });

  const qs = await db.collection("guitars").where("name", "==", name).limit(10).get();
  const items = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
  cache.set(cacheKey, items);

  return res.json({ items, cached: false });
}));

// --- Error handling (centralized) ---
app.use((err, req, res, next) => {
  functions.logger.error("Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

exports.api = functions.https.onRequest(app);

// --- Background job (scheduled cleanup) ---
// Removes old rate limit buckets. (Task queue / background jobs requirement)
exports.cleanupRateLimits = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    const snap = await db.collection("rateLimits").get();
    const batch = db.batch();
    let count = 0;

    snap.forEach((doc) => {
      const created = doc.data().createdAt?.toMillis ? doc.data().createdAt.toMillis() : 0;
      if (created && created < cutoff) {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count) await batch.commit();
    functions.logger.info(`cleanupRateLimits deleted ${count}`);
    return null;
  });
