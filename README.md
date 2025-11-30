# MozaicHub

MozaicHub is a simple full-stack file hosting and media server built with Node.js, Express, Sequelize, SQLite, and EJS. The app supports user authentication, file uploads with previews, comments, friendships, messaging, and admin moderation tooling.

## Features
- Session-based authentication with bcrypt password hashing.
- Admin-only account creation, banning with graylist tracking, and quota defaults.
- File uploads with visibility controls (public/unlisted/private) and media preview for audio/video/image/PDF.
- Commenting on accessible files.
- Friend requests, blocking, and basic messaging between friends.
- Admin dashboards for users, files, and graylisted entries.
- Scheduled cleanup for banned users' files after a grace period.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (optional):
   - `PORT` (default 3000)
   - `SESSION_SECRET`
   - `DATABASE_URL` (defaults to local SQLite database)
   - `UPLOADS_DIR` and `PROFILE_DIR`
   - `MAX_UPLOAD_SIZE`
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
