#!/usr/bin/env python3
import json
import os
import socket
import sqlite3
import threading
import urllib.parse
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.expanduser('~'), '.torqueline')
DB_PATH = os.path.join(DATA_DIR, 'messages.db')
SCHEMA_PATH = os.path.join(ROOT, 'db', 'messages.sql')
DB_LOCK = threading.Lock()
ADMIN_ID = 'usr_admin'
ADMIN_ROLE = 'admin'


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              order_id TEXT,
              sender_id TEXT NOT NULL,
              receiver_id TEXT NOT NULL,
              sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            )
        """)
        # Migration for existing DBs: add order_id if missing
        cols = [r[1] for r in conn.execute("PRAGMA table_info(messages)").fetchall()]
        if 'order_id' not in cols:
            try:
                conn.execute("ALTER TABLE messages ADD COLUMN order_id TEXT")
            except Exception:
                pass
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_receiver_read ON messages(receiver_id, is_read)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages(order_id, created_at)")
        conn.commit()


def db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn


def json_response(handler, status, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-User-Role, X-User-Name')
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler):
    try:
        length = int(handler.headers.get('Content-Length', '0') or '0')
    except ValueError:
        length = 0
    raw = handler.rfile.read(length) if length > 0 else b''
    if not raw:
        return {}
    try:
        return json.loads(raw.decode('utf-8'))
    except Exception:
        return None


def get_auth(handler):
    # Client sends session-derived identity headers; server enforces scoping rules.
    user_id = (handler.headers.get('X-User-Id') or '').strip()
    role = (handler.headers.get('X-User-Role') or '').strip().lower()
    name = (handler.headers.get('X-User-Name') or '').strip()
    if not user_id:
        return None
    # Accept common client role labels used by the frontend
    if role in ('client', 'user', 'customer', ''):
        role = 'client'
    if role not in ('client', 'admin'):
        return None
    if role == 'admin' and user_id != ADMIN_ID:
        # Only the built-in admin account may act as admin.
        return None
    return {'id': user_id, 'role': role, 'name': name}


def client_owns_order(client_id, order_id):
    """Best-effort server-side check: client can only message orders that belong to them.
    In this demo app orders/users live in browser localStorage, so server-side files may not
    exist. If we cannot verify from server-side data, allow but still require order_id and
    enforce client_id scoping on all reads/writes."""
    users_path = os.path.join(ROOT, 'torqueline_users.json')
    orders_path = os.path.join(ROOT, 'torqueline_orders.json')
    try:
        if not os.path.exists(orders_path) and not os.path.exists(users_path):
            return True
        users = []
        if os.path.exists(users_path):
            with open(users_path, 'r', encoding='utf-8') as f:
                users = json.load(f) or []
        client_email = ''
        for u in users:
            if str(u.get('id')) == str(client_id):
                client_email = (u.get('email') or '').strip().lower()
                break
        orders = []
        if os.path.exists(orders_path):
            with open(orders_path, 'r', encoding='utf-8') as f:
                orders = json.load(f) or []
        if not orders:
            return True
        for o in orders:
            if str(o.get('id')) != str(order_id):
                continue
            if str(o.get('userId') or '') == str(client_id):
                return True
            o_email = (o.get('email') or o.get('customerEmail') or '').strip().lower()
            if client_email and o_email and o_email == client_email:
                return True
        # order exists in server-side data but not owned by this client
        return False
    except Exception:
        # cannot verify -> allow, scoping still enforced
        return True


def clean_text(value, max_len=2000):
    if value is None:
        return ''
    text = str(value).strip()
    if len(text) > max_len:
        text = text[:max_len]
    return text


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        if path == '/api/messages':
            return self.handle_get_messages(parsed)
        if path == '/api/messages/threads':
            return self.handle_get_threads()
        if path == '/api/messages/unread':
            return self.handle_get_unread()
        if path == '/api/notifications':
            return self.handle_get_notifications(parsed)
        if path.startswith('/api/'):
            return json_response(self, HTTPStatus.NOT_FOUND, {'error': 'API path not found', 'path': path})
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        if path == '/api/messages':
            return self.handle_post_message()
        if path == '/api/messages/read':
            return self.handle_mark_read()
        if path == '/api/notifications/read':
            return self.handle_notifications_read()
        if path.startswith('/api/'):
            return json_response(self, HTTPStatus.NOT_FOUND, {'error': 'API path not found', 'path': path})
        return json_response(self, HTTPStatus.METHOD_NOT_ALLOWED, {'error': 'Method not allowed for this path', 'path': path, 'method': 'POST'})

    def do_OPTIONS(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/') or '/'
        if path.startswith('/api/'):
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-User-Role, X-User-Name')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
        self.end_headers()

    def send_error(self, code, message=None, explain=None):
        # Return JSON for API paths so frontend can show clear errors (e.g. 405)
        try:
            path = urllib.parse.urlparse(self.path).path
        except Exception:
            path = ''
        if path.startswith('/api/'):
            payload = {'error': message or self.responses.get(code, ('Error',))[0], 'status': code, 'path': path}
            return json_response(self, code, payload)
        return super().send_error(code, message, explain)

    def handle_get_messages(self, parsed):
        auth = get_auth(self)
        if not auth:
            return json_response(self, HTTPStatus.UNAUTHORIZED, {'error': 'Unauthorized'})
        qs = urllib.parse.parse_qs(parsed.query)
        # Server-side access control:
        # - client: can only read their own conversation with admin
        # - admin: must specify client_id to read that client's conversation
        if auth['role'] == 'client':
            client_id = auth['id']
        else:
            client_id = (qs.get('client_id', [''])[0] or '').strip()
            if not client_id:
                return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'client_id required'})
        order_id = clean_text((qs.get('order_id', [''])[0] or ''), 80) or None
        if not order_id:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'order_id is required'})
        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    # Return ONLY messages for this exact order (separate conversation per order)
                    rows = conn.execute(
                        """
                        SELECT id, order_id, sender_id, receiver_id, sender_role, message, is_read, created_at
                        FROM messages
                        WHERE ((sender_id = ? AND receiver_id = ?)
                           OR (sender_id = ? AND receiver_id = ?))
                          AND order_id = ?
                        ORDER BY id ASC
                        """,
                        (client_id, ADMIN_ID, ADMIN_ID, client_id, order_id)
                    ).fetchall()
                finally:
                    conn.close()
            messages = [dict(r) for r in rows]
            return json_response(self, HTTPStatus.OK, {'messages': messages, 'client_id': client_id, 'order_id': order_id})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to load messages'})

    def handle_post_message(self):
        auth = get_auth(self)
        if not auth:
            return json_response(self, HTTPStatus.UNAUTHORIZED, {'error': 'Unauthorized'})
        data = read_json(self)
        if data is None:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Invalid JSON'})
        message = clean_text(data.get('message'))
        if not message:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Message cannot be empty'})
        order_id = clean_text(data.get('order_id'), 80) or None
        if not order_id:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'order_id is required'})

        if auth['role'] == 'client':
            sender_id = auth['id']
            receiver_id = ADMIN_ID
            sender_role = 'client'
            # Client can only message orders that belong to them
            if not client_owns_order(sender_id, order_id):
                return json_response(self, HTTPStatus.FORBIDDEN, {'error': 'You can only message orders that belong to you'})
        else:
            sender_id = ADMIN_ID
            receiver_id = clean_text(data.get('client_id'), 80)
            sender_role = 'admin'
            if not receiver_id or receiver_id == ADMIN_ID:
                return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'client_id required'})
            # Ensure reply is saved for an order conversation that belongs to this client
            if not client_owns_order(receiver_id, order_id):
                return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Order does not belong to the selected client'})

        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    cur = conn.execute(
                        """
                        INSERT INTO messages (order_id, sender_id, receiver_id, sender_role, message, is_read)
                        VALUES (?, ?, ?, ?, ?, 0)
                        """,
                        (order_id, sender_id, receiver_id, sender_role, message)
                    )
                    row = conn.execute(
                        "SELECT id, order_id, sender_id, receiver_id, sender_role, message, is_read, created_at FROM messages WHERE id = ?",
                        (cur.lastrowid,)
                    ).fetchone()
                finally:
                    conn.close()
            return json_response(self, HTTPStatus.CREATED, {'ok': True, 'message': dict(row)})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to send message'})

    def handle_mark_read(self):
        auth = get_auth(self)
        if not auth:
            return json_response(self, HTTPStatus.UNAUTHORIZED, {'error': 'Unauthorized'})
        data = read_json(self)
        if data is None:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Invalid JSON'})
        order_id = clean_text(data.get('order_id'), 80) or None

        if auth['role'] == 'client':
            client_id = auth['id']
            # client opened conversation: mark admin->client messages as read (optionally per order)
            target_sender = ADMIN_ID
            target_receiver = client_id
        else:
            client_id = clean_text(data.get('client_id'), 80)
            if not client_id:
                return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'client_id required'})
            # admin opened conversation: mark client->admin messages as read (optionally per order)
            target_sender = client_id
            target_receiver = ADMIN_ID

        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    if order_id:
                        conn.execute(
                            "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0 AND order_id = ?",
                            (target_sender, target_receiver, order_id)
                        )
                    else:
                        conn.execute(
                            "UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
                            (target_sender, target_receiver)
                        )
                finally:
                    conn.close()
            return json_response(self, HTTPStatus.OK, {'ok': True})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to mark read'})

    def handle_get_notifications(self, parsed):
        auth = get_auth(self)
        if not auth or auth['role'] != 'client':
            return json_response(self, HTTPStatus.FORBIDDEN, {'error': 'Client access required'})
        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    rows = conn.execute(
                        """
                        SELECT id, order_id, sender_id, receiver_id, sender_role, message, is_read, created_at
                        FROM messages
                        WHERE receiver_id = ? AND sender_id = ? AND sender_role = 'admin'
                        ORDER BY id DESC
                        LIMIT 50
                        """,
                        (auth['id'], ADMIN_ID)
                    ).fetchall()
                    unread_row = conn.execute(
                        "SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND sender_id = ? AND sender_role = 'admin' AND is_read = 0",
                        (auth['id'], ADMIN_ID)
                    ).fetchone()
                finally:
                    conn.close()
            notifications = []
            for r in rows:
                item = dict(r)
                item['read'] = bool(item.get('is_read'))
                notifications.append(item)
            unread_count = int(unread_row['c'] if unread_row else 0)
            return json_response(self, HTTPStatus.OK, {'notifications': notifications, 'unread_count': unread_count})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to load notifications'})

    def handle_notifications_read(self):
        auth = get_auth(self)
        if not auth or auth['role'] != 'client':
            return json_response(self, HTTPStatus.FORBIDDEN, {'error': 'Client access required'})
        data = read_json(self)
        if data is None:
            return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Invalid JSON'})
        mark_all = bool(data.get('all'))
        msg_id = data.get('id')
        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    if mark_all:
                        conn.execute(
                            "UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND sender_role = 'admin' AND is_read = 0",
                            (auth['id'], ADMIN_ID)
                        )
                    elif msg_id is not None and str(msg_id).strip() != '':
                        # Only mark this client's own admin notification
                        cur = conn.execute(
                            "UPDATE messages SET is_read = 1 WHERE id = ? AND receiver_id = ? AND sender_id = ? AND sender_role = 'admin'",
                            (int(msg_id), auth['id'], ADMIN_ID)
                        )
                        if cur.rowcount == 0:
                            return json_response(self, HTTPStatus.NOT_FOUND, {'error': 'Notification not found'})
                    else:
                        return json_response(self, HTTPStatus.BAD_REQUEST, {'error': 'Provide id or all'})
                finally:
                    conn.close()
            return json_response(self, HTTPStatus.OK, {'ok': True})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to update notifications'})


    def handle_get_threads(self):
        auth = get_auth(self)
        if not auth or auth['role'] != 'admin':
            return json_response(self, HTTPStatus.FORBIDDEN, {'error': 'Forbidden'})
        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    # Separate conversation per (client, order)
                    rows = conn.execute(
                        """
                        WITH conv AS (
                          SELECT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS client_id,
                                 COALESCE(order_id, '') AS order_id,
                                 id, message, created_at, sender_id, receiver_id, sender_role, is_read
                          FROM messages
                          WHERE sender_id = ? OR receiver_id = ?
                        ),
                        latest AS (
                          SELECT client_id, order_id, MAX(id) AS last_id FROM conv GROUP BY client_id, order_id
                        )
                        SELECT c.client_id,
                               c.order_id,
                               c.message AS last_message,
                               c.created_at AS last_created_at,
                               c.sender_role AS last_sender_role,
                               (SELECT COUNT(*) FROM messages m
                                 WHERE m.sender_id = c.client_id AND m.receiver_id = ? AND m.is_read = 0
                                   AND COALESCE(m.order_id,'') = c.order_id) AS unread_count
                        FROM latest l
                        JOIN conv c ON c.client_id = l.client_id AND c.order_id = l.order_id AND c.id = l.last_id
                        ORDER BY l.last_id DESC
                        """,
                        (ADMIN_ID, ADMIN_ID, ADMIN_ID, ADMIN_ID)
                    ).fetchall()
                finally:
                    conn.close()
            threads = []
            for r in rows:
                t = dict(r)
                if t.get('order_id') == '':
                    t['order_id'] = None
                threads.append(t)
            return json_response(self, HTTPStatus.OK, {'threads': threads})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to load threads'})

    def handle_get_unread(self):
        auth = get_auth(self)
        if not auth:
            return json_response(self, HTTPStatus.UNAUTHORIZED, {'error': 'Unauthorized'})
        try:
            with DB_LOCK:
                conn = db_conn()
                try:
                    if auth['role'] == 'admin':
                        row = conn.execute(
                            "SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND is_read = 0",
                            (ADMIN_ID,)
                        ).fetchone()
                    else:
                        row = conn.execute(
                            "SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND sender_id = ? AND is_read = 0",
                            (auth['id'], ADMIN_ID)
                        ).fetchone()
                finally:
                    conn.close()
            return json_response(self, HTTPStatus.OK, {'unread': int(row['c'] if row else 0)})
        except Exception:
            return json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {'error': 'Failed to load unread count'})


def resolve_port(preferred_port):
    start_port = int(preferred_port)
    for port in range(start_port, start_port + 20):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(('127.0.0.1', port))
            return port
        except OSError:
            continue
    raise OSError(f'No free port found starting at {start_port}')


def main():
    init_db()
    preferred_port = int(os.environ.get('PORT', '8080'))
    port = resolve_port(preferred_port)
    if port != preferred_port:
        print(f'Port {preferred_port} is busy; using {port} instead.')
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'TorqueLine running at http://localhost:{port}')
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
