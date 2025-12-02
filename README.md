<<<<<<< codex/update-readme-to-include-edit-ticker-5s4wc7
# MozaicHub

MozaicHub is a simple full-stack file hosting and media server built with Node.js, Express, Sequelize, SQLite, and EJS. The app supports user authentication, file uploads with previews, comments, friendships, messaging, and admin moderation tooling.

## Edit Ticker
- Total commit updates: 23

## Features
- Session-based authentication with bcrypt password hashing.
- Admin-only account creation, banning with graylist tracking, and configurable per-user storage quotas.
- File uploads with visibility controls (public/unlisted/private) and media preview for audio/video/image/PDF.
- Commenting on accessible files with Markdown, mentions, and notifications.
- Friend requests, blocking, and basic messaging between friends.
- Admin dashboards for users, files, and graylisted entries.
- Notification center for mentions, comments on uploads, admin deletions, and friend uploads.
- Scheduled cleanup for banned users' files after a grace period.

## Setup
1. Install dependencies (required any time you freshly clone or pull new packages):
   ```bash
   npm install
   ```
   > If you see an error like `Cannot find module 'marked'`, it means dependencies have not been installed yet. Run `npm install` first to pull everything into `node_modules/`.
2. Configure environment variables (optional):
   - Copy `.env.example` to `.env` and adjust values for `PORT`, `SESSION_SECRET`, `DATABASE_URL`, `UPLOADS_DIR`, `PROFILE_DIR`, `MAX_UPLOAD_SIZE`, and other runtime settings.
3. Start the server:
   ```bash
   npm start
   ```
4. On first run a default admin user is created:
   - **Username:** `admin`
   - **Password:** `adminpass`

## Scripts
- `npm start` – start the web server.
- `npm test` – placeholder script.

## Storage
Files are stored on disk inside the `uploads/` directory, with metadata tracked in the database. The storage layer is isolated in `src/storage/localStorage.js` to allow swapping to other providers later.

## Recovery and notifications
- The login page includes an account recovery form that generates a random secure password and logs it to the server console for the requested username.
- A notification center (🔔 in the header) surfaces mentions, comments on your uploads, friend uploads, and admin file deletions. Notifications can be marked read individually or in bulk.
=======
# MozaicHub

MozaicHub is a simple full-stack file hosting and media server built with Node.js, Express, Sequelize, SQLite, and EJS. The app supports user authentication, file uploads with previews, comments, friendships, messaging, and admin moderation tooling.

## Edit Ticker
- Total commit updates: 20

## Features
- Session-based authentication with bcrypt password hashing.
- Admin-only account creation, banning with graylist tracking, and configurable per-user storage quotas.
- File uploads with visibility controls (public/unlisted/private) and media preview for audio/video/image/PDF.
- Commenting on accessible files with Markdown, mentions, and notifications.
- Friend requests, blocking, and basic messaging between friends.
- Admin dashboards for users, files, and graylisted entries.
- Notification center for mentions, comments on uploads, admin deletions, and friend uploads.
- Scheduled cleanup for banned users' files after a grace period.

## Setup
1. Install dependencies (required any time you freshly clone or pull new packages):
   ```bash
   npm install
   ```
   > If you see an error like `Cannot find module 'marked'`, it means dependencies have not been installed yet. Run `npm install` first to pull everything into `node_modules/`.
2. Configure environment variables (optional):
   - Copy `.env.example` to `.env` and adjust values for `PORT`, `SESSION_SECRET`, `DATABASE_URL`, `UPLOADS_DIR`, `PROFILE_DIR`, `MAX_UPLOAD_SIZE`, and other runtime settings.
3. Start the server:
   ```bash
   npm start
   ```
4. On first run a default admin user is created:
   - **Username:** `admin`
   - **Password:** `adminpass`

## Scripts
- `npm start` – start the web server.
- `npm test` – placeholder script.

## Storage
Files are stored on disk inside the `uploads/` directory, with metadata tracked in the database. The storage layer is isolated in `src/storage/localStorage.js` to allow swapping to other providers later.

## Recovery and notifications
- The login page includes an account recovery form that generates a random secure password and logs it to the server console for the requested username.
- A notification center (🔔 in the header) surfaces mentions, comments on your uploads, friend uploads, and admin file deletions. Notifications can be marked read individually or in bulk.
>>>>>>> main
