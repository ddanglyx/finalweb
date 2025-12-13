// firebase.js (ES module) - Backend integration for Guitar Infographic
// IMPORTANT: Replace firebaseConfig with your own values from the Firebase console.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

// 1) Your Firebase config (REPLACE THIS WITH YOUR OWN PROJECT INFO)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2) Initialize Firebase app, Auth, and Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 3) Grab DOM elements
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const profileStatus = document.getElementById("profileStatus");

const resetEmail = document.getElementById("resetEmail");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const resetStatus = document.getElementById("resetStatus");

const contactNameInput = document.getElementById("contactName");
const contactEmailInput = document.getElementById("contactEmail");
const contactMessageInput = document.getElementById("contactMessage");
const contactAttachmentInput = document.getElementById("contactAttachment");
const contactSendBtn = document.getElementById("contactSendBtn");
const contactStatus = document.getElementById("contactStatus");

const loadMessagesBtn = document.getElementById("loadMessagesBtn");
const realtimeToggleBtn = document.getElementById("realtimeToggleBtn");
const messagesHint = document.getElementById("messagesHint");
const messagesList = document.getElementById("messagesList");

const backendSearchInput = document.getElementById("backendSearchInput");
const backendSearchBtn = document.getElementById("backendSearchBtn");
const backendSearchResults = document.getElementById("backendSearchResults");

// Helper: show/hide sections that require auth
function updateAuthVisibility(user) {
  const requiresAuth = document.querySelectorAll("[data-requires-auth]");
  requiresAuth.forEach((el) => {
    el.style.display = user ? "" : "none";
  });
}

// --- Small helpers ---
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

async function apiFetch(path, options = {}) {
  const token = await getIdToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : (typeof data === "string" ? data : "Request failed");
    throw new Error(msg);
  }
  return data;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 4) Authentication: Sign Up
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name || !email || !password) {
      alert("Please fill out all sign-up fields.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Save basic profile/role in Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        role: "user",
        createdAt: serverTimestamp()
      });

      signupForm.reset();
      alert("Account created! You are now logged in.");
    } catch (err) {
      console.error(err);
      alert("Sign up failed: " + err.message);
    }
  });
}

// 5) Authentication: Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginForm.reset();
    } catch (err) {
      console.error(err);
      alert("Login failed: " + err.message);
    }
  });
}

// 6) Authentication: Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
      alert("Logout failed: " + err.message);
    }
  });
}

// 7) Authentication state listener (session management)
onAuthStateChanged(auth, (user) => {
  if (authStatus) {
    authStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in";
  }
  if (logoutBtn) {
    logoutBtn.hidden = !user;
  }
  updateAuthVisibility(user);

  // Load profile (role) to display + support RBAC in UI
  (async () => {
    if (!profileStatus) return;
    if (!user) {
      profileStatus.textContent = "";
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const role = snap.exists() ? (snap.data().role || "user") : "user";
      profileStatus.textContent = `Role: ${role}`;
    } catch (e) {
      console.error(e);
      profileStatus.textContent = "";
    }
  })();
});

// 7.5) Password reset (Email notification handled by Firebase Auth)
if (resetPasswordBtn && resetEmail && resetStatus) {
  resetPasswordBtn.addEventListener("click", async () => {
    const email = resetEmail.value.trim();
    resetStatus.textContent = "";
    if (!email) {
      resetStatus.textContent = "Enter an email first.";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      resetStatus.textContent = "Password reset email sent.";
    } catch (e) {
      console.error(e);
      resetStatus.textContent = `Error: ${e.message}`;
    }
  });
}

// 8) Contact form -> Firestore (Create)
if (contactSendBtn && contactStatus) {
  contactSendBtn.addEventListener("click", async () => {
    const name = contactNameInput.value.trim();
    const email = contactEmailInput.value.trim();
    const message = contactMessageInput.value.trim();

    if (!name || !email || !message) {
      contactStatus.textContent = "Please fill out all fields.";
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        contactStatus.textContent = "Please log in before sending.";
        return;
      }

      // Optional attachment upload (Storage)
      let attachmentUrl = null;
      const file = contactAttachmentInput?.files?.[0];
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `attachments/${user.uid}/${Date.now()}_${safeName}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, file);
        attachmentUrl = await getDownloadURL(sref);
      }

      // Primary write path: call backend API endpoint (Cloud Function)
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({ name, email, message, attachmentUrl })
      });

      contactStatus.textContent = "Message sent & saved to backend (API + DB)!";
      contactNameInput.value = "";
      contactEmailInput.value = "";
      contactMessageInput.value = "";
      if (contactAttachmentInput) contactAttachmentInput.value = "";
    } catch (err) {
      console.error(err);
      contactStatus.textContent = "Error sending message: " + err.message;
    }
  });
}

// 9) Load "My Messages" (Read)
let unsubscribeRealtime = null;

function renderMessages(items) {
  if (!messagesList) return;
  messagesList.innerHTML = "";
  if (!items.length) {
    messagesList.innerHTML = "<li>No messages yet.</li>";
    return;
  }

  items.forEach((m) => {
    const li = document.createElement("li");
    li.className = "message-item";
    const time = m.createdAt ? new Date(m.createdAt).toLocaleString() : "";
    const attachment = m.attachmentUrl ? `<a href="${escapeHtml(m.attachmentUrl)}" target="_blank" rel="noreferrer">attachment</a>` : "";
    li.innerHTML = `
      <div class="msg-main">
        <div class="msg-meta">${escapeHtml(time)}</div>
        <div class="msg-text">${escapeHtml(m.message || "")}</div>
        <div class="msg-extra">${attachment}</div>
      </div>
      <div class="msg-actions">
        <button data-action="edit" data-id="${escapeHtml(m.id)}">Edit</button>
        <button data-action="delete" data-id="${escapeHtml(m.id)}">Delete</button>
      </div>
    `;
    messagesList.appendChild(li);
  });
}

async function loadMyMessagesViaApi() {
  if (!messagesList) return;
  const user = auth.currentUser;
  if (!user) {
    alert("Log in to see your messages.");
    return;
  }
  messagesList.innerHTML = "<li>Loading...</li>";
  const data = await apiFetch("/api/messages?limit=50", { method: "GET" });
  renderMessages(data.items || []);
}

if (loadMessagesBtn && messagesList) {
  loadMessagesBtn.addEventListener("click", async () => {
    try {
      if (messagesHint) messagesHint.textContent = "Loaded via API endpoint.";
      await loadMyMessagesViaApi();
    } catch (e) {
      console.error(e);
      messagesList.innerHTML = `<li>Error loading messages: ${escapeHtml(e.message)}</li>`;
    }
  });
}

// Message Edit/Delete (Update/Delete)
if (messagesList) {
  messagesList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    try {
      if (action === "edit") {
        const next = prompt("Edit message:");
        if (next == null) return;
        await apiFetch(`/api/messages/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ message: next })
        });
        await loadMyMessagesViaApi();
      }
      if (action === "delete") {
        if (!confirm("Delete this message?")) return;
        await apiFetch(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadMyMessagesViaApi();
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}

// Real-time updates (Firestore listener)
if (realtimeToggleBtn && messagesList) {
  realtimeToggleBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Log in first.");
      return;
    }
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
      realtimeToggleBtn.textContent = "Enable Real-time";
      if (messagesHint) messagesHint.textContent = "Real-time disabled.";
      return;
    }
    realtimeToggleBtn.textContent = "Disable Real-time";
    if (messagesHint) messagesHint.textContent = "Real-time enabled (Firestore onSnapshot).";

    const q = query(
      collection(db, "contactMessages"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    unsubscribeRealtime = onSnapshot(q, (snap) => {
      const items = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          id: d.id,
          message: data.message,
          attachmentUrl: data.attachmentUrl || null,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null
        });
      });
      renderMessages(items);
    });
  });
}

// 10) Backend search against Firestore "guitars" collection
if (backendSearchBtn && backendSearchInput && backendSearchResults) {
  backendSearchBtn.addEventListener("click", async () => {
    const term = backendSearchInput.value.trim();
    backendSearchResults.innerHTML = "";

    if (!term) {
      backendSearchResults.innerHTML = "<li>Enter a search term.</li>";
      return;
    }

    try {
      // Use backend API endpoint (server-side validation + auth + rate limiting)
      const data = await apiFetch(`/api/guitars/search?name=${encodeURIComponent(term)}`, { method: "GET" });
      const items = data.items || [];
      if (!items.length) {
        backendSearchResults.innerHTML = "<li>No results.</li>";
        return;
      }
      items.forEach((g) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${escapeHtml(g.name)}</strong> — ${escapeHtml(g.type || "")}<br>${escapeHtml(g.description || "")}`;
        backendSearchResults.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      backendSearchResults.innerHTML = `<li>Error searching guitars: ${escapeHtml(err.message)}</li>`;
    }
  });
}

console.log("Firebase backend features initialized for Guitar Infographic.");
