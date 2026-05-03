import json
import os
import uuid
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db, init_db

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'dist'),
    static_url_path=''
)
CORS(app)

# ── init on startup ──────────────────────────────────────────────────────────
with app.app_context():
    init_db()


# ── helpers ──────────────────────────────────────────────────────────────────
def row_to_dict(row):
    return dict(row)


# ── trades ───────────────────────────────────────────────────────────────────
@app.route('/api/trades', methods=['GET'])
def get_trades():
    db = get_db()
    rows = db.execute(
        'SELECT * FROM trades ORDER BY datetime DESC'
    ).fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/trades', methods=['POST'])
def add_trade():
    data = request.get_json()
    db   = get_db()
    db.execute('''
        INSERT INTO trades
            (datetime, symbol, direction, entry, exit, quantity,
             ticks, r_multiple, pnl, commission, notes, tags, has_screenshot)
        VALUES (:datetime,:symbol,:direction,:entry,:exit,:quantity,
                :ticks,:r_multiple,:pnl,:commission,:notes,:tags,:has_screenshot)
    ''', {
        'datetime':       data.get('datetime', ''),
        'symbol':         data.get('symbol', ''),
        'direction':      data.get('direction', 'Long'),
        'entry':          float(data.get('entry', 0)),
        'exit':           float(data.get('exit', 0)),
        'quantity':       int(data.get('quantity', 1)),
        'ticks':          data.get('ticks'),
        'r_multiple':     data.get('r_multiple'),
        'pnl':            float(data.get('pnl', 0)),
        'commission':     float(data.get('commission', 0)),
        'notes':          data.get('notes', ''),
        'tags':           json.dumps(data.get('tags', [])),
        'has_screenshot': int(data.get('has_screenshot', 0)),
    })
    db.commit()
    trade_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = db.execute('SELECT * FROM trades WHERE id=?', (trade_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/trades/<int:trade_id>', methods=['PUT'])
def update_trade(trade_id):
    data = request.get_json()
    db   = get_db()
    db.execute('''
        UPDATE trades SET
            datetime=:datetime, symbol=:symbol, direction=:direction,
            entry=:entry, exit=:exit, quantity=:quantity,
            ticks=:ticks, r_multiple=:r_multiple, pnl=:pnl,
            commission=:commission, notes=:notes, tags=:tags,
            has_screenshot=:has_screenshot
        WHERE id=:id
    ''', {
        'id':             trade_id,
        'datetime':       data.get('datetime', ''),
        'symbol':         data.get('symbol', ''),
        'direction':      data.get('direction', 'Long'),
        'entry':          float(data.get('entry', 0)),
        'exit':           float(data.get('exit', 0)),
        'quantity':       int(data.get('quantity', 1)),
        'ticks':          data.get('ticks'),
        'r_multiple':     data.get('r_multiple'),
        'pnl':            float(data.get('pnl', 0)),
        'commission':     float(data.get('commission', 0)),
        'notes':          data.get('notes', ''),
        'tags':           json.dumps(data.get('tags', [])),
        'has_screenshot': int(data.get('has_screenshot', 0)),
    })
    db.commit()
    row = db.execute('SELECT * FROM trades WHERE id=?', (trade_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/trades/<int:trade_id>', methods=['DELETE'])
def delete_trade(trade_id):
    db = get_db()
    db.execute('DELETE FROM trades WHERE id=?', (trade_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── instruments ──────────────────────────────────────────────────────────────
@app.route('/api/instruments', methods=['GET'])
def get_instruments():
    db   = get_db()
    rows = db.execute('SELECT * FROM instruments ORDER BY symbol').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


# ── tags ─────────────────────────────────────────────────────────────────────
@app.route('/api/tags', methods=['GET'])
def get_tags():
    db   = get_db()
    rows = db.execute('SELECT * FROM tags ORDER BY label').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/tags', methods=['POST'])
def add_tag():
    data = request.get_json()
    tag_id = 'tag_' + uuid.uuid4().hex[:8]
    db = get_db()
    db.execute('INSERT INTO tags VALUES (?,?,?)',
               (tag_id, data.get('label', ''), data.get('color', '#8a9bb0')))
    db.commit()
    row = db.execute('SELECT * FROM tags WHERE id=?', (tag_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    db = get_db()
    db.execute('DELETE FROM tags WHERE id=?', (tag_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── checklist ────────────────────────────────────────────────────────────────
@app.route('/api/checklist', methods=['GET'])
def get_checklist():
    db   = get_db()
    rows = db.execute(
        'SELECT * FROM checklist ORDER BY sort_order'
    ).fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/checklist', methods=['POST'])
def add_checklist_item():
    data = request.get_json()
    item_id = 'cl_' + uuid.uuid4().hex[:8]
    db = get_db()
    max_order = db.execute(
        'SELECT COALESCE(MAX(sort_order),0) FROM checklist'
    ).fetchone()[0]
    db.execute('INSERT INTO checklist VALUES (?,?,?,?)',
               (item_id, data.get('text', ''), 0, max_order + 1))
    db.commit()
    row = db.execute('SELECT * FROM checklist WHERE id=?', (item_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/checklist/<item_id>', methods=['PUT'])
def update_checklist_item(item_id):
    data = request.get_json()
    db   = get_db()
    db.execute('''
        UPDATE checklist SET text=:text, done=:done, sort_order=:sort_order
        WHERE id=:id
    ''', {
        'id':         item_id,
        'text':       data.get('text', ''),
        'done':       int(data.get('done', 0)),
        'sort_order': data.get('sort_order', 0),
    })
    db.commit()
    row = db.execute('SELECT * FROM checklist WHERE id=?', (item_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/checklist/<item_id>', methods=['DELETE'])
def delete_checklist_item(item_id):
    db = get_db()
    db.execute('DELETE FROM checklist WHERE id=?', (item_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── settings ─────────────────────────────────────────────────────────────────
@app.route('/api/settings', methods=['GET'])
def get_settings():
    db   = get_db()
    rows = db.execute('SELECT * FROM settings').fetchall()
    db.close()
    return jsonify({r['key']: r['value'] for r in rows})


@app.route('/api/settings/<key>', methods=['PUT'])
def update_setting(key):
    data  = request.get_json()
    value = data.get('value', '')
    db    = get_db()
    db.execute('INSERT OR REPLACE INTO settings VALUES (?,?)', (key, value))
    db.commit()
    db.close()
    return jsonify({'key': key, 'value': value})


# ── SPA catch-all ─────────────────────────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_spa(path):
    dist = app.static_folder
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
