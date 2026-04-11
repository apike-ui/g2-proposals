"""
G2 Proposal Builder — standalone Flask server.
Serves the proposals UI and REST API. No G2 API dependencies needed.
"""
import os, json, sqlite3, uuid, io
from flask import Flask, jsonify, send_file, request

_HERE = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_HERE, "data", "proposals.db")

app = Flask(__name__, root_path=_HERE, instance_path=os.path.join(_HERE, "instance"))

# ── DB helpers ──────────────────────────────────────────────────────
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

_init_db()

# ── UI ──────────────────────────────────────────────────────────────
@app.route("/")
@app.route("/proposals")
def serve_ui():
    return send_file(os.path.join(_HERE, "g2-proposals.html"))

# ── Proposals API ───────────────────────────────────────────────────
@app.route("/api/proposals", methods=["GET"])
def list_proposals():
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
    with _db() as c:
        c.execute("INSERT INTO proposals(id,name,customer,rep,grand_total) VALUES(?,?,?,?,?)",
                  (pid, body.get("name","Untitled"), body.get("customer"), body.get("rep"), body.get("grand_total",0)))
    with _db() as c:
        row = c.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
    return jsonify({"ok": True, "data": dict(row)})

@app.route("/api/proposals/<pid>", methods=["PUT"])
def update_proposal(pid):
    body = request.get_json(force=True)
    with _db() as c:
        c.execute("UPDATE proposals SET name=?,customer=?,rep=?,grand_total=?,updated_at=datetime('now') WHERE id=?",
                  (body.get("name"), body.get("customer"), body.get("rep"), body.get("grand_total",0), pid))
        row = c.execute("SELECT * FROM proposals WHERE id=?", (pid,)).fetchone()
    return jsonify({"ok": True, "data": dict(row) if row else None})

@app.route("/api/proposals/<pid>/versions", methods=["GET"])
def list_versions(pid):
    with _db() as c:
        rows = c.execute("SELECT id,proposal_id,notes,created_at FROM proposal_versions WHERE proposal_id=? ORDER BY created_at DESC", (pid,)).fetchall()
    return jsonify({"ok": True, "data": [dict(r) for r in rows]})

@app.route("/api/proposals/<pid>/versions", methods=["POST"])
def create_version(pid):
    body = request.get_json(force=True)
    vid = str(uuid.uuid4())
    snapshot = json.dumps(body.get("snapshot", {}))
    with _db() as c:
        c.execute("INSERT INTO proposal_versions(id,proposal_id,snapshot,notes) VALUES(?,?,?,?)",
                  (vid, pid, snapshot, body.get("notes")))
        c.execute("UPDATE proposals SET updated_at=datetime('now') WHERE id=?", (pid,))
        row = c.execute("SELECT * FROM proposal_versions WHERE id=?", (vid,)).fetchone()
    return jsonify({"ok": True, "data": dict(row)})

@app.route("/api/versions/<vid>", methods=["GET"])
def get_version(vid):
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
