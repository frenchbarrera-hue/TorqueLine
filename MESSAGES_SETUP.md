# Client–Admin Messages (Setup & Test)

## Files added/changed
- **Added:** `server.py` – Python stdlib server (serves static files + `/api/messages*`) with SQLite persistence, prepared statements, and server-side access checks.
- **Added:** `messages.js` – shared client/admin chat UI and polling logic.
- **Added:** `db/messages.sql` – database schema/migration for `messages`.
- **Added:** `db/.gitignore` – ignores local `messages.db`.
- **Edited:** `user-dashboard.html` – loads `messages.js`.
- **Edited:** `user-dashboard.js` – adds **Message Admin** button next to Cancel/Delete action on each order row.
- **Edited:** `admin-dashboard.html` – adds **Messages** button with unread badge in header; loads `messages.js`.
- **Edited:** `serve.sh` – runs `server.py` (keeps port behavior).

No existing features or flows (cart, checkout, profile, order status, charts) were removed.

## Database
- SQLite file: `db/messages.db` (auto-created on first server start).
- Schema: `db/messages.sql` (`id, sender_id, receiver_id, sender_role, message, is_read, created_at`).

Manual (re)create if needed:
```bash
cd /Users/van/Downloads/TorqueLine-main
sqlite3 db/messages.db < db/messages.sql
```

## Run
```bash
cd /Users/van/Downloads/TorqueLine-main
./serve.sh
# or: PORT=8080 python3 server.py
```
Open `http://localhost:8080/index.html`.

## Test steps
1. **Client login:** sign in/register as a client, place or view an order on `user-dashboard.html`.
2. **Send message:** click **Message Admin** on an order row → chat panel opens → type and Send (Enter works). Message appears on the right with time.
3. **Admin view:** sign in as admin (`admin@torqueline.ph` / `admin123`, code `TL-ADMIN`) → click **Messages** in header (badge shows unread count). Select client thread → see message on left, reply.
4. **Real-time-ish:** replies/new messages appear within ~3 seconds without refresh (polling).
5. **Read state:** opening a conversation marks relevant messages as read and clears counts/badges on next poll.
6. **Security checks:** empty messages are blocked client+server; text is escaped on render (XSS-safe display); DB writes use parameterized/prepared statements. Clients can only access their own conversation; only admin can list/read all threads (enforced in `server.py`).

## Notes
- This project was previously static/localStorage-only with no backend. Messaging uses a minimal local Python server + SQLite to satisfy database persistence and server-side access control requirements. Existing app data (users/orders/cart/session) still uses the original localStorage behavior.
