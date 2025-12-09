New Backend Features (15)

User registration using Firebase Authentication.

Secure password handling via Firebase’s built-in hashing.

User login functionality.

User logout functionality.

Automatic session management that keeps users signed in.

Role field added to each user record to support authorization.

Contact form messages saved to Firestore.

Contact messages linked to the authenticated user’s ID.

“My Messages” page that retrieves messages from Firestore.

Guitar search feature that queries Firestore by name.

Firestore used as the primary database for users, messages, and guitars.

Basic data validation through Firestore rules (authentication required to write).

Centralized error handling for all backend operations.

Auth-restricted UI sections that only appear for logged-in users.

Backend-ready structure for update/delete operations through Firestore documents.
