// firebase.js (ES module) - Backend integration for Guitar Infographic
// IMPORTANT: Replace firebaseConfig with your own values from the Firebase console.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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

// 3) Grab DOM elements
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");

const contactNameInput = document.getElementById("contactName");
const contactEmailInput = document.getElementById("contactEmail");
const contactMessageInput = document.getElementById("contactMessage");
const contactSendBtn = document.getElementById("contactSendBtn");
const contactStatus = document.getElementById("contactStatus");

const loadMessagesBtn = document.getElementById("loadMessagesBtn");
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
});

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

      await addDoc(collection(db, "contactMessages"), {
        name,
        email,
        message,
        userId: user ? user.uid : null,
        createdAt: serverTimestamp()
      });

      contactStatus.textContent = "Message sent & saved to backend!";
      contactNameInput.value = "";
      contactEmailInput.value = "";
      contactMessageInput.value = "";
    } catch (err) {
      console.error(err);
      contactStatus.textContent = "Error sending message: " + err.message;
    }
  });
}

// 9) Load "My Messages" (Read)
if (loadMessagesBtn && messagesList) {
  loadMessagesBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Log in to see your messages.");
      return;
    }

    messagesList.innerHTML = "<li>Loading...</li>";

    try {
      const q = query(
        collection(db, "contactMessages"),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);

      messagesList.innerHTML = "";

      if (snapshot.empty) {
        messagesList.innerHTML = "<li>No messages yet.</li>";
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement("li");
        const time =
          data.createdAt && data.createdAt.toDate
            ? data.createdAt.toDate().toLocaleString()
            : "";
        li.textContent = `${time} — ${data.message}`;
        messagesList.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      messagesList.innerHTML = "<li>Error loading messages.</li>";
    }
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
      const q = query(
        collection(db, "guitars"),
        where("name", "==", term)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        backendSearchResults.innerHTML = "<li>No results.</li>";
        return;
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement("li");
        li.innerHTML = `<strong>${data.name}</strong> — ${data.type || ""}<br>${data.description || ""}`;
        backendSearchResults.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      backendSearchResults.innerHTML = "<li>Error searching guitars.</li>";
    }
  });
}

console.log("Firebase backend features initialized for Guitar Infographic.");
