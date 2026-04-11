"""
G2 Proposal Builder — standalone Flask server.
Serves the proposals UI and REST API.
Uses Supabase (cloud Postgres) when SUPABASE_URL is set, otherwise SQLite fallback.
"""
import os, json, sqlite3, uuid, io
import requests as http_requests
from flask import Flask, jsonify, send_file, request
from datetime import datetime, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_HERE, "data", "proposals.db")

# ── Supabase config ─────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

app = Flask(__name__, root_path=_HERE, instance_path=os.path.join(_HERE, "instance"))


# ── Supabase helpers ────────────────────────────────────────────────

def _supa_headers(prefer=None):
    h = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h

def _supa_get(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    try:
        r = http_requests.get(url, headers=_supa_headers(), timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[SUPABASE ERROR] GET {url}: {e}")
        raise

def _supa_post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    try:
        r = http_requests.post(url, headers=_supa_headers(prefer="return=representation"),
                               json=data, timeout=15)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None
    except Exception as e:
        print(f"[SUPABASE ERROR] POST {url}: {e}")
        raise

def _supa_patch(table, match, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{match}"
    try:
        r = http_requests.patch(url, headers=_supa_headers(prefer="return=representation"),
                                json=data, timeout=15)
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None
    except Exception as e:
        print(f"[SUPABASE ERROR] PATCH {url}: {e}")
        raise


# ── SQLite helpers (local fallback) ─────────────────────────────────

def _db():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init_db():
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    os.makedirs(os.path.join(_HERE, "instance"), exist_ok=True)
    with _db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS proposals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            customer TEXT,
            rep TEXT,
            grand_total REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS proposal_versions (
            id TEXT PRIMARY KEY,
            proposal_id TEXT NOT NULL REFERENCES proposals(id),
            snapshot TEXT NOT NULL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_pv_pid ON proposal_versions(proposal_id)")
        c.execute("""CREATE TABLE IF NOT EXISTS rate_cards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'Untitled Rate Card',
            customer TEXT DEFAULT '',
            owner TEXT DEFAULT '',
            card_data TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT DEFAULT (datetime('now'))
        )""")

if not USE_SUPABASE:
    _init_db()
    print("  Storage: SQLite (local) — proposals will NOT persist across deploys")
else:
    print(f"  Storage: Supabase (cloud) — proposals persist permanently")


# ── UI ──────────────────────────────────────────────────────────────

@app.route("/")
@app.route("/proposals")
def serve_ui():
    return send_file(os.path.join(_HERE, "g2-proposals.html"))

@app.route("/api/storage-mode")
def storage_mode():
    return jsonify({"mode": "supabase" if USE_SUPABASE else "sqlite"})

@app.errorhandler(Exception)
def handle_error(e):
    import traceback
    traceback.print_exc()
    return jsonify({"ok": False, "error": str(e)}), 500


# ── Proposals API ───────────────────────────────────────────────────

@app.route("/api/proposals", methods=["GET"])
def list_proposals():
    if USE_SUPABASE:
        # Get proposals with version count via two queries
        proposals = _supa_get("proposals", "select=*&order=updated_at.desc")
        # Get version counts
        versions = _supa_get("proposal_versions", "select=proposal_id")
        vc = {}
        for v in versions:
            pid = v["proposal_id"]
            vc[pid] = vc.get(pid, 0) + 1
        for p in proposals:
            p["version_count"] = vc.get(p["id"], 0)
        return jsonify({"ok": True, "data": proposals})
    else:
        with _db() as c:
            rows = c.execute("""
                SELECT p.*, COUNT(v.id) as version_count
                FROM proposals p
                LEFT JOIN proposal_versions v ON v.proposal_id = p.id
                GROUP BY p.id
                ORDER BY p.updated_at DESC
            """).fetchall()
        return jsonify({"ok": True, "data": [dict(r) for r in rows]})


@app.route("/api/proposals", methods=["POST"])
def create_proposal():
    body = request.get_json(force=True)
    pid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if USE_SUPABASE:
        row = _supa_post("proposals", {
            "id": pid,
            "name": body.get("name", "Untitled"),
            "customer": body.get("customer"),
            "rep": body.get("rep"),
            "grand_total": body.get("grand_total", 0),
            "created_at": now,
            "updated_at": now,
        })
        return jsonify({"ok": True, "data": row})
    else:
        with _db() as c:
            c.execute("INSERT INTO proposals(id,name,customer,rep,grand_total) VALUES(?,?,?,?,?)",
                      (pid, body.get("name","Untitled"), body.get("customer"), body.get("rep"), body.get("grand_total",0)))
        with _db() as c:
            row = c.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
        return jsonify({"ok": True, "data": dict(row)})


@app.route("/api/proposals/<pid>", methods=["PUT"])
def update_proposal(pid):
    body = request.get_json(force=True)
    now = datetime.now(timezone.utc).isoformat()

    if USE_SUPABASE:
        row = _supa_patch("proposals", f"id=eq.{pid}", {
            "name": body.get("name"),
            "customer": body.get("customer"),
            "rep": body.get("rep"),
            "grand_total": body.get("grand_total", 0),
            "updated_at": now,
        })
        return jsonify({"ok": True, "data": row})
    else:
        with _db() as c:
            c.execute("UPDATE proposals SET name=?,customer=?,rep=?,grand_total=?,updated_at=datetime('now') WHERE id=?",
                      (body.get("name"), body.get("customer"), body.get("rep"), body.get("grand_total",0), pid))
            row = c.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
        return jsonify({"ok": True, "data": dict(row) if row else None})


@app.route("/api/proposals/<pid>/versions", methods=["GET"])
def list_versions(pid):
    if USE_SUPABASE:
        rows = _supa_get("proposal_versions",
            f"select=id,proposal_id,notes,created_at&proposal_id=eq.{pid}&order=created_at.desc")
        return jsonify({"ok": True, "data": rows})
    else:
        with _db() as c:
            rows = c.execute("SELECT id,proposal_id,notes,created_at FROM proposal_versions WHERE proposal_id=? ORDER BY created_at DESC", (pid,)).fetchall()
        return jsonify({"ok": True, "data": [dict(r) for r in rows]})


@app.route("/api/proposals/<pid>/versions", methods=["POST"])
def create_version(pid):
    body = request.get_json(force=True)
    vid = str(uuid.uuid4())
    snapshot = body.get("snapshot", {})
    now = datetime.now(timezone.utc).isoformat()

    if USE_SUPABASE:
        row = _supa_post("proposal_versions", {
            "id": vid,
            "proposal_id": pid,
            "snapshot": snapshot,  # Supabase stores as jsonb natively
            "notes": body.get("notes"),
            "created_at": now,
        })
        # Update parent proposal timestamp
        _supa_patch("proposals", f"id=eq.{pid}", {"updated_at": now})
        return jsonify({"ok": True, "data": row})
    else:
        snapshot_str = json.dumps(snapshot)
        with _db() as c:
            c.execute("INSERT INTO proposal_versions(id,proposal_id,snapshot,notes) VALUES(?,?,?,?)",
                      (vid, pid, snapshot_str, body.get("notes")))
            c.execute("UPDATE proposals SET updated_at=datetime('now') WHERE id=?", (pid,))
            row = c.execute("SELECT * FROM proposal_versions WHERE id=?", (vid,)).fetchone()
        return jsonify({"ok": True, "data": dict(row)})


@app.route("/api/versions/<vid>", methods=["GET"])
def get_version(vid):
    if USE_SUPABASE:
        rows = _supa_get("proposal_versions", f"id=eq.{vid}")
        if not rows:
            return jsonify({"ok": False, "error": "Not found"}), 404
        d = rows[0]
        # snapshot is already a dict from jsonb
        if isinstance(d.get("snapshot"), str):
            try:
                d["snapshot"] = json.loads(d["snapshot"])
            except Exception:
                pass
        return jsonify({"ok": True, "data": d})
    else:
        with _db() as c:
            row = c.execute("SELECT * FROM proposal_versions WHERE id=?", (vid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        d = dict(row)
        try:
            d["snapshot"] = json.loads(d["snapshot"])
        except Exception:
            pass
        return jsonify({"ok": True, "data": d})


# ── Rate Card API (multiple named cards per customer) ───────────────

@app.route("/api/ratecards", methods=["GET"])
def list_ratecards():
    """List all rate cards."""
    if USE_SUPABASE:
        rows = _supa_get("rate_cards", "select=id,name,customer,owner,updated_at&order=updated_at.desc")
        return jsonify({"ok": True, "data": rows})
    else:
        with _db() as c:
            rows = c.execute("SELECT id,name,customer,owner,updated_at FROM rate_cards ORDER BY updated_at DESC").fetchall()
        return jsonify({"ok": True, "data": [dict(r) for r in rows]})


@app.route("/api/ratecards", methods=["POST"])
def create_ratecard():
    """Create a new rate card."""
    body = request.get_json(force=True)
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    card_data = body.get("card_data", {})

    if USE_SUPABASE:
        row = _supa_post("rate_cards", {
            "id": rid,
            "name": body.get("name", "Untitled Rate Card"),
            "customer": body.get("customer", ""),
            "owner": body.get("owner", ""),
            "card_data": card_data,
            "updated_at": now,
        })
        return jsonify({"ok": True, "data": row})
    else:
        with _db() as c:
            c.execute("INSERT INTO rate_cards(id,name,customer,owner,card_data) VALUES(?,?,?,?,?)",
                      (rid, body.get("name","Untitled"), body.get("customer",""),
                       body.get("owner",""), json.dumps(card_data)))
            row = c.execute("SELECT * FROM rate_cards WHERE id=?", (rid,)).fetchone()
        d = dict(row)
        try: d["card_data"] = json.loads(d["card_data"])
        except: pass
        return jsonify({"ok": True, "data": d})


@app.route("/api/ratecards/<rid>", methods=["GET"])
def get_ratecard(rid):
    """Get a specific rate card by ID."""
    if USE_SUPABASE:
        rows = _supa_get("rate_cards", f"id=eq.{rid}")
        if not rows:
            return jsonify({"ok": False, "error": "Not found"}), 404
        d = rows[0]
        if isinstance(d.get("card_data"), str):
            try: d["card_data"] = json.loads(d["card_data"])
            except: pass
        return jsonify({"ok": True, "data": d})
    else:
        with _db() as c:
            row = c.execute("SELECT * FROM rate_cards WHERE id=?", (rid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Not found"}), 404
        d = dict(row)
        try: d["card_data"] = json.loads(d["card_data"])
        except: pass
        return jsonify({"ok": True, "data": d})


@app.route("/api/ratecards/<rid>", methods=["PUT"])
def update_ratecard(rid):
    """Update an existing rate card."""
    body = request.get_json(force=True)
    now = datetime.now(timezone.utc).isoformat()

    if USE_SUPABASE:
        row = _supa_patch("rate_cards", f"id=eq.{rid}", {
            "name": body.get("name"),
            "customer": body.get("customer"),
            "owner": body.get("owner"),
            "card_data": body.get("card_data", {}),
            "updated_at": now,
        })
        return jsonify({"ok": True, "data": row})
    else:
        with _db() as c:
            c.execute("UPDATE rate_cards SET name=?,customer=?,owner=?,card_data=?,updated_at=datetime('now') WHERE id=?",
                      (body.get("name"), body.get("customer"), body.get("owner"),
                       json.dumps(body.get("card_data",{})), rid))
            row = c.execute("SELECT * FROM rate_cards WHERE id=?", (rid,)).fetchone()
        d = dict(row)
        try: d["card_data"] = json.loads(d["card_data"])
        except: pass
        return jsonify({"ok": True, "data": d})


# Backward-compat: old single-card endpoint redirects to list
@app.route("/api/ratecard", methods=["GET"])
def get_ratecard_compat():
    if USE_SUPABASE:
        rows = _supa_get("rate_cards", "select=*&order=updated_at.desc&limit=1")
        if rows:
            d = rows[0]
            if isinstance(d.get("card_data"), str):
                try: d["card_data"] = json.loads(d["card_data"])
                except: pass
            return jsonify({"ok": True, "data": d})
    else:
        with _db() as c:
            row = c.execute("SELECT * FROM rate_cards ORDER BY updated_at DESC LIMIT 1").fetchone()
        if row:
            d = dict(row)
            try: d["card_data"] = json.loads(d["card_data"])
            except: pass
            return jsonify({"ok": True, "data": d})
    return jsonify({"ok": True, "data": None})


# ── PPTX Export ─────────────────────────────────────────────────────

@app.route("/api/proposals/export-pptx", methods=["POST","OPTIONS"])
def export_pptx():
    if request.method == "OPTIONS":
        return "", 204
    import sys; sys.path.insert(0, _HERE)
    from pptx_gen import build_pptx
    data = request.get_json(force=True)
    pptx_bytes = build_pptx(data)
    buf = io.BytesIO(pptx_bytes)
    buf.seek(0)
    cust = (data.get("cust") or "Proposal").replace(" ", "_").replace("/","_")
    filename = f"G2_Proposal_{cust}.pptx"
    return send_file(buf, as_attachment=True, download_name=filename,
                     mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation")


if __name__ == "__main__":
    print(f"G2 Proposal Builder → http://localhost:5001/proposals")
    app.run(host="0.0.0.0", port=5001, debug=False)
