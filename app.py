import csv
import io
import json
import os
import re
import shutil
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from database import get_db, init_db

IMAGES_DIR = os.environ.get('IMAGES_DIR', '/app/data/images')

# Tick sizes (price increment per tick) for common futures instruments
TICK_SIZES = {
    'ES': 0.25, 'MES': 0.25,
    'NQ': 0.25, 'MNQ': 0.25,
    'YM': 1.0,  'MYM': 1.0,
    'CL': 0.01, 'GC':  0.10,
    'RTY': 0.10, 'M2K': 0.10,
}


def _parse_tradovate_dt(s):
    s = s.strip()
    for fmt in ('%m/%d/%Y %H:%M:%S', '%m/%d/%Y %H:%M',
                '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%dT%H:%M')
        except ValueError:
            pass
    return s or None


def _normalize_order_row(r):
    """
    Normalizes a row from either the Tradovate 'Orders' export
    (orderId,Account,...,B/S,Contract,Product,...,avgPrice,filledQty,Fill Time,Status,...)
    or the TradingView/Tradovate trading-panel export
    (Symbol,Side,Type,Qty,...,Avg Fill Price,Status,Update Time,...)
    into a common dict: {symbol, side, price, qty, status, datetime}
    """
    status = (r.get('Status') or '').strip()

    side = (r.get('B/S') or r.get('Side') or '').strip()

    symbol = (r.get('Product') or '').strip()
    if not symbol:
        raw_symbol = (r.get('Contract') or r.get('Symbol') or '').strip()
        symbol = re.sub(r'[FGHJKMNQUVXZ]\d{1,2}$', '', raw_symbol)

    price_raw = r.get('avgPrice') or r.get('Avg Fill Price') or ''
    qty_raw   = r.get('filledQty') or r.get('Filled Qty') or ''

    dt_raw = r.get('Fill Time') or r.get('Timestamp') or r.get('Update Time') or ''

    return {
        'symbol': symbol,
        'side':   side,
        'status': status,
        'price_raw': price_raw,
        'qty_raw':   qty_raw,
        'datetime':  _parse_tradovate_dt(dt_raw),
        'sort_key':  dt_raw,
    }

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), 'frontend', 'dist'),
    static_url_path=''
)
CORS(app)

# ── init on startup ──────────────────────────────────────────────────────────
os.makedirs(IMAGES_DIR, exist_ok=True)
with app.app_context():
    init_db()


# ── helpers ──────────────────────────────────────────────────────────────────
def row_to_dict(row):
    return dict(row)


def trade_to_dict(row):
    d = dict(row)
    try:
        d['tags'] = json.loads(d.get('tags') or '[]')
    except Exception:
        d['tags'] = []
    return d


# ── trades ───────────────────────────────────────────────────────────────────
@app.route('/api/trades', methods=['GET'])
def get_trades():
    db = get_db()
    rows = db.execute(
        'SELECT * FROM trades ORDER BY datetime DESC'
    ).fetchall()
    db.close()
    return jsonify([trade_to_dict(r) for r in rows])


@app.route('/api/trades', methods=['POST'])
def add_trade():
    data = request.get_json()
    db   = get_db()
    db.execute('''
        INSERT INTO trades
            (datetime, symbol, direction, entry, exit, quantity,
             ticks, r_multiple, pnl, commission, notes, tags, has_screenshot,
             strategy, plan, execution, emotion,
             entry_score, exit_score, risk_score, plan_adherence, lessons,
             plan_followed, biggest_mistake, would_do_differently, overall_rating,
             chart_link, account_id, stop_loss, take_profit)
        VALUES (:datetime,:symbol,:direction,:entry,:exit,:quantity,
                :ticks,:r_multiple,:pnl,:commission,:notes,:tags,:has_screenshot,
                :strategy,:plan,:execution,:emotion,
                :entry_score,:exit_score,:risk_score,:plan_adherence,:lessons,
                :plan_followed,:biggest_mistake,:would_do_differently,:overall_rating,
                :chart_link,:account_id,:stop_loss,:take_profit)
    ''', {
        'datetime':             data.get('datetime', ''),
        'symbol':               data.get('symbol', ''),
        'direction':            data.get('direction', 'Long'),
        'entry':                float(data.get('entry', 0)),
        'exit':                 float(data.get('exit', 0)),
        'quantity':             int(data.get('quantity', 1)),
        'ticks':                data.get('ticks'),
        'r_multiple':           data.get('r_multiple'),
        'pnl':                  float(data.get('pnl', 0)),
        'commission':           float(data.get('commission', 0)),
        'notes':                data.get('notes', ''),
        'tags':                 json.dumps(data.get('tags', [])),
        'has_screenshot':       int(data.get('has_screenshot', 0)),
        'strategy':             data.get('strategy', ''),
        'plan':                 data.get('plan', ''),
        'execution':            data.get('execution', ''),
        'emotion':              data.get('emotion', ''),
        'entry_score':          int(data.get('entry_score', 0)),
        'exit_score':           int(data.get('exit_score', 0)),
        'risk_score':           int(data.get('risk_score', 0)),
        'plan_adherence':       int(data.get('plan_adherence', 0)),
        'lessons':              data.get('lessons', ''),
        'plan_followed':        data.get('plan_followed', ''),
        'biggest_mistake':      data.get('biggest_mistake', ''),
        'would_do_differently': data.get('would_do_differently', ''),
        'overall_rating':       int(data.get('overall_rating', 0)),
        'chart_link':           data.get('chart_link', ''),
        'account_id':           data.get('account_id'),
        'stop_loss':            data.get('stop_loss'),
        'take_profit':          data.get('take_profit'),
    })
    db.commit()
    trade_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = db.execute('SELECT * FROM trades WHERE id=?', (trade_id,)).fetchone()
    db.close()
    return jsonify(trade_to_dict(row)), 201


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
            has_screenshot=:has_screenshot,
            strategy=:strategy, plan=:plan, execution=:execution,
            emotion=:emotion, entry_score=:entry_score, exit_score=:exit_score,
            risk_score=:risk_score, plan_adherence=:plan_adherence, lessons=:lessons,
            plan_followed=:plan_followed, biggest_mistake=:biggest_mistake,
            would_do_differently=:would_do_differently, overall_rating=:overall_rating,
            chart_link=:chart_link, account_id=:account_id, stop_loss=:stop_loss,
            take_profit=:take_profit
        WHERE id=:id
    ''', {
        'id':                   trade_id,
        'datetime':             data.get('datetime', ''),
        'symbol':               data.get('symbol', ''),
        'direction':            data.get('direction', 'Long'),
        'entry':                float(data.get('entry', 0)),
        'exit':                 float(data.get('exit', 0)),
        'quantity':             int(data.get('quantity', 1)),
        'ticks':                data.get('ticks'),
        'r_multiple':           data.get('r_multiple'),
        'pnl':                  float(data.get('pnl', 0)),
        'commission':           float(data.get('commission', 0)),
        'notes':                data.get('notes', ''),
        'tags':                 json.dumps(data.get('tags', [])),
        'has_screenshot':       int(data.get('has_screenshot', 0)),
        'strategy':             data.get('strategy', ''),
        'plan':                 data.get('plan', ''),
        'execution':            data.get('execution', ''),
        'emotion':              data.get('emotion', ''),
        'entry_score':          int(data.get('entry_score')  or 0),
        'exit_score':           int(data.get('exit_score')   or 0),
        'risk_score':           int(data.get('risk_score')   or 0),
        'plan_adherence':       int(data.get('plan_adherence') or 0),
        'lessons':              data.get('lessons', ''),
        'plan_followed':        data.get('plan_followed', ''),
        'biggest_mistake':      data.get('biggest_mistake', ''),
        'would_do_differently': data.get('would_do_differently', ''),
        'overall_rating':       int(data.get('overall_rating') or 0),
        'chart_link':           data.get('chart_link', ''),
        'account_id':           data.get('account_id'),
        'stop_loss':            data.get('stop_loss'),
        'take_profit':          data.get('take_profit'),
    })
    db.commit()
    row = db.execute('SELECT * FROM trades WHERE id=?', (trade_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(trade_to_dict(row))


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
    tags = [row_to_dict(r) for r in db.execute('SELECT * FROM tags ORDER BY label').fetchall()]
    trade_rows = db.execute('SELECT tags FROM trades').fetchall()
    db.close()
    counts = {}
    for row in trade_rows:
        try:
            for tid in json.loads(row['tags'] or '[]'):
                counts[tid] = counts.get(tid, 0) + 1
        except Exception:
            pass
    for tag in tags:
        tag['count'] = counts.get(tag['id'], 0)
    return jsonify(tags)


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
    result = row_to_dict(row)
    result['count'] = 0
    return jsonify(result), 201


@app.route('/api/tags/<tag_id>', methods=['PUT'])
def update_tag(tag_id):
    data = request.get_json()
    db = get_db()
    db.execute('UPDATE tags SET label=?, color=? WHERE id=?',
               (data.get('label', ''), data.get('color', '#8a9bb0'), tag_id))
    db.commit()
    row = db.execute('SELECT * FROM tags WHERE id=?', (tag_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    db = get_db()
    trade_rows = db.execute('SELECT tags FROM trades').fetchall()
    for row in trade_rows:
        try:
            if tag_id in json.loads(row['tags'] or '[]'):
                db.close()
                return jsonify({'error': 'Tag is in use by one or more trades'}), 409
        except Exception:
            pass
    db.execute('DELETE FROM tags WHERE id=?', (tag_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── accounts ──────────────────────────────────────────────────────────────────
@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    db   = get_db()
    rows = db.execute('SELECT * FROM accounts ORDER BY sort_order').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/accounts', methods=['POST'])
def add_account():
    data = request.get_json()
    acc_id = 'acc_' + uuid.uuid4().hex[:8]
    db = get_db()
    db.execute(
        '''INSERT INTO accounts
               (id, name, firm, account_type, status, account_size,
                risk_per_trade, max_daily_loss, max_weekly_loss, color, sort_order)
           VALUES (:id,:name,:firm,:account_type,:status,:account_size,
                   :risk_per_trade,:max_daily_loss,:max_weekly_loss,:color,:sort_order)''',
        {
            'id':              acc_id,
            'name':            data.get('name', ''),
            'firm':            data.get('firm', ''),
            'account_type':    data.get('account_type', 'live'),
            'status':          data.get('status', 'active'),
            'account_size':    data.get('account_size'),
            'risk_per_trade':  data.get('risk_per_trade'),
            'max_daily_loss':  data.get('max_daily_loss'),
            'max_weekly_loss': data.get('max_weekly_loss'),
            'color':           data.get('color', '#4f9cf9'),
            'sort_order':      data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM accounts WHERE id=?', (acc_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/accounts/<acc_id>', methods=['PUT'])
def update_account(acc_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        '''UPDATE accounts SET
               name=:name, firm=:firm, account_type=:account_type, status=:status,
               account_size=:account_size, risk_per_trade=:risk_per_trade,
               max_daily_loss=:max_daily_loss, max_weekly_loss=:max_weekly_loss,
               color=:color, sort_order=:sort_order
           WHERE id=:id''',
        {
            'id':              acc_id,
            'name':            data.get('name', ''),
            'firm':            data.get('firm', ''),
            'account_type':    data.get('account_type', 'live'),
            'status':          data.get('status', 'active'),
            'account_size':    data.get('account_size'),
            'risk_per_trade':  data.get('risk_per_trade'),
            'max_daily_loss':  data.get('max_daily_loss'),
            'max_weekly_loss': data.get('max_weekly_loss'),
            'color':           data.get('color', '#4f9cf9'),
            'sort_order':      data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM accounts WHERE id=?', (acc_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/accounts/<acc_id>', methods=['DELETE'])
def delete_account(acc_id):
    db = get_db()
    count = db.execute(
        'SELECT COUNT(*) FROM trades WHERE account_id=?', (acc_id,)
    ).fetchone()[0]
    if count > 0:
        db.close()
        return jsonify({'error': 'Account has trades assigned to it'}), 409
    db.execute('DELETE FROM accounts WHERE id=?', (acc_id,))
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


@app.route('/api/checklist/reset', methods=['POST'])
def reset_checklist():
    db = get_db()
    db.execute('UPDATE checklist SET done=0')
    db.commit()
    rows = db.execute('SELECT * FROM checklist ORDER BY sort_order').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


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


# ── AI analysis ──────────────────────────────────────────────────────────────
@app.route('/api/ai-analysis', methods=['POST'])
def ai_analysis():
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return jsonify({'error': 'ANTHROPIC_API_KEY is not configured on this server.'}), 503

    data  = request.get_json()
    trade = data.get('trade', {})

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        prompt = f"""You are an expert trading coach reviewing a futures trade. Be concise and specific.

Trade: {trade.get('symbol')} {trade.get('direction')} — P&L: ${trade.get('pnl')}, Ticks: {trade.get('ticks')}, R: {trade.get('r_multiple')}
Entry: {trade.get('entry')} → Exit: {trade.get('exit')} | Qty: {trade.get('quantity')}

Journal:
- Strategy: {trade.get('strategy') or 'Not specified'}
- Plan: {trade.get('plan') or 'Not specified'}
- Execution: {trade.get('execution') or 'Not specified'}
- Emotion: {trade.get('emotion') or 'Not specified'}
- Entry score: {trade.get('entry_score', 0)}/10  Exit score: {trade.get('exit_score', 0)}/10  Risk score: {trade.get('risk_score', 0)}/10
- Plan adherence: {trade.get('plan_adherence', 0)}%
- Lessons noted: {trade.get('lessons') or 'None'}

Provide feedback with three short sections: ✅ What went well, ⚠️ What to improve, 💡 Key takeaway. Under 180 words total."""

        msg = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=400,
            messages=[{'role': 'user', 'content': prompt}]
        )
        return jsonify({'analysis': msg.content[0].text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── images ───────────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS       = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.mkv'}
VIDEO_MAX_BYTES          = 500 * 1024 * 1024   # 500 MB


@app.route('/api/trades/<int:trade_id>/images', methods=['GET'])
def get_trade_images(trade_id):
    folder = os.path.join(IMAGES_DIR, str(trade_id))
    if not os.path.exists(folder):
        return jsonify([])
    files = sorted(
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    )
    return jsonify([f'/api/images/{trade_id}/{f}' for f in files])


@app.route('/api/trades/<int:trade_id>/images', methods=['POST'])
def upload_trade_images(trade_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    files = request.files.getlist('file')
    folder = os.path.join(IMAGES_DIR, str(trade_id))
    os.makedirs(folder, exist_ok=True)
    saved = []
    for f in files:
        raw = secure_filename(f.filename or '')
        if not raw:
            continue
        base, ext = os.path.splitext(raw)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            continue
        unique = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
        f.save(os.path.join(folder, unique))
        saved.append(f'/api/images/{trade_id}/{unique}')
    return jsonify(saved), 201


@app.route('/api/trades/<int:trade_id>/images/<filename>', methods=['DELETE'])
def delete_trade_image(trade_id, filename):
    filename = os.path.basename(filename)
    path = os.path.join(IMAGES_DIR, str(trade_id), filename)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({'ok': True})


@app.route('/api/images/<int:trade_id>/<filename>')
def serve_trade_image(trade_id, filename):
    filename = os.path.basename(filename)
    folder = os.path.join(IMAGES_DIR, str(trade_id))
    return send_from_directory(folder, filename)


# ── trade videos ──────────────────────────────────────────────────────────────
@app.route('/api/trades/<int:trade_id>/videos', methods=['GET'])
def get_trade_videos(trade_id):
    folder = os.path.join(IMAGES_DIR, str(trade_id), 'videos')
    if not os.path.exists(folder):
        return jsonify([])
    files = sorted(
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_VIDEO_EXTENSIONS
    )
    return jsonify([f'/api/videos/{trade_id}/{f}' for f in files])


@app.route('/api/trades/<int:trade_id>/videos', methods=['POST'])
def upload_trade_video(trade_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    f = request.files['file']
    raw = secure_filename(f.filename or '')
    if not raw:
        return jsonify({'error': 'Empty filename'}), 400
    base, ext = os.path.splitext(raw)
    if ext.lower() not in ALLOWED_VIDEO_EXTENSIONS:
        return jsonify({'error': f'Unsupported format: {ext}'}), 400
    folder = os.path.join(IMAGES_DIR, str(trade_id), 'videos')
    os.makedirs(folder, exist_ok=True)
    unique = f'{base}_{uuid.uuid4().hex[:6]}{ext}'
    f.save(os.path.join(folder, unique))
    return jsonify({'url': f'/api/videos/{trade_id}/{unique}'}), 201


@app.route('/api/trades/<int:trade_id>/videos/<filename>', methods=['DELETE'])
def delete_trade_video(trade_id, filename):
    filename = os.path.basename(filename)
    path = os.path.join(IMAGES_DIR, str(trade_id), 'videos', filename)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({'ok': True})


@app.route('/api/videos/<int:trade_id>/<filename>')
def serve_trade_video(trade_id, filename):
    filename = os.path.basename(filename)
    folder = os.path.join(IMAGES_DIR, str(trade_id), 'videos')
    return send_from_directory(folder, filename)


# ── business expenses ────────────────────────────────────────────────────────
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    db   = get_db()
    rows = db.execute('SELECT * FROM business_expenses ORDER BY date DESC').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data   = request.get_json()
    exp_id = 'exp_' + uuid.uuid4().hex[:8]
    db     = get_db()
    db.execute(
        '''INSERT INTO business_expenses
               (id, date, category, vendor, amount, currency, account_id, recurring, notes)
           VALUES (:id,:date,:category,:vendor,:amount,:currency,:account_id,:recurring,:notes)''',
        {
            'id':         exp_id,
            'date':       data.get('date', ''),
            'category':   data.get('category', 'Other'),
            'vendor':     data.get('vendor', ''),
            'amount':     float(data.get('amount', 0)),
            'currency':   data.get('currency', 'USD'),
            'account_id': data.get('account_id'),
            'recurring':  int(data.get('recurring', 0)),
            'notes':      data.get('notes', ''),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM business_expenses WHERE id=?', (exp_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/expenses/<exp_id>', methods=['PUT'])
def update_expense(exp_id):
    data = request.get_json()
    db   = get_db()
    db.execute(
        '''UPDATE business_expenses SET
               date=:date, category=:category, vendor=:vendor,
               amount=:amount, currency=:currency, account_id=:account_id,
               recurring=:recurring, notes=:notes
           WHERE id=:id''',
        {
            'id':         exp_id,
            'date':       data.get('date', ''),
            'category':   data.get('category', 'Other'),
            'vendor':     data.get('vendor', ''),
            'amount':     float(data.get('amount', 0)),
            'currency':   data.get('currency', 'USD'),
            'account_id': data.get('account_id'),
            'recurring':  int(data.get('recurring', 0)),
            'notes':      data.get('notes', ''),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM business_expenses WHERE id=?', (exp_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/expenses/<exp_id>', methods=['DELETE'])
def delete_expense(exp_id):
    folder = os.path.join(IMAGES_DIR, 'expenses', exp_id)
    shutil.rmtree(folder, ignore_errors=True)
    db = get_db()
    db.execute('DELETE FROM business_expenses WHERE id=?', (exp_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── expense receipt images ────────────────────────────────────────────────────
@app.route('/api/expenses/<exp_id>/images', methods=['GET'])
def get_expense_images(exp_id):
    folder = os.path.join(IMAGES_DIR, 'expenses', exp_id)
    if not os.path.exists(folder):
        return jsonify([])
    files = sorted(
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    )
    return jsonify([f'/api/expense-images/{exp_id}/{f}' for f in files])


@app.route('/api/expenses/<exp_id>/images', methods=['POST'])
def upload_expense_images(exp_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    files  = request.files.getlist('file')
    folder = os.path.join(IMAGES_DIR, 'expenses', exp_id)
    os.makedirs(folder, exist_ok=True)
    saved  = []
    for f in files:
        raw = secure_filename(f.filename or '')
        if not raw:
            continue
        base, ext = os.path.splitext(raw)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            continue
        unique = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
        f.save(os.path.join(folder, unique))
        saved.append(f'/api/expense-images/{exp_id}/{unique}')
    if saved:
        db = get_db()
        db.execute('UPDATE business_expenses SET has_receipt=1 WHERE id=?', (exp_id,))
        db.commit()
        db.close()
    return jsonify(saved), 201


@app.route('/api/expenses/<exp_id>/images/<filename>', methods=['DELETE'])
def delete_expense_image(exp_id, filename):
    filename = os.path.basename(filename)
    folder   = os.path.join(IMAGES_DIR, 'expenses', exp_id)
    path     = os.path.join(folder, filename)
    if os.path.exists(path):
        os.remove(path)
    remaining = [
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    ] if os.path.exists(folder) else []
    if not remaining:
        db = get_db()
        db.execute('UPDATE business_expenses SET has_receipt=0 WHERE id=?', (exp_id,))
        db.commit()
        db.close()
    return jsonify({'ok': True})


@app.route('/api/expense-images/<exp_id>/<filename>')
def serve_expense_image(exp_id, filename):
    filename = os.path.basename(filename)
    folder   = os.path.join(IMAGES_DIR, 'expenses', exp_id)
    return send_from_directory(folder, filename)


# ── strategies ────────────────────────────────────────────────────────────────
@app.route('/api/strategies', methods=['GET'])
def get_strategies():
    db   = get_db()
    rows = db.execute('SELECT * FROM strategies ORDER BY sort_order').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/strategies', methods=['POST'])
def add_strategy():
    data     = request.get_json()
    strat_id = 'strat_' + uuid.uuid4().hex[:8]
    db       = get_db()
    db.execute(
        '''INSERT INTO strategies (id, name, parent_id, description, status, color, sort_order)
           VALUES (:id,:name,:parent_id,:description,:status,:color,:sort_order)''',
        {
            'id':          strat_id,
            'name':        data.get('name', ''),
            'parent_id':   data.get('parent_id'),
            'description': data.get('description', ''),
            'status':      data.get('status', 'testing'),
            'color':       data.get('color', '#4f9cf9'),
            'sort_order':  data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM strategies WHERE id=?', (strat_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/strategies/<strat_id>', methods=['PUT'])
def update_strategy(strat_id):
    data = request.get_json()
    db   = get_db()
    db.execute(
        '''UPDATE strategies SET
               name=:name, parent_id=:parent_id, description=:description,
               status=:status, color=:color, sort_order=:sort_order
           WHERE id=:id''',
        {
            'id':          strat_id,
            'name':        data.get('name', ''),
            'parent_id':   data.get('parent_id'),
            'description': data.get('description', ''),
            'status':      data.get('status', 'testing'),
            'color':       data.get('color', '#4f9cf9'),
            'sort_order':  data.get('sort_order', 0),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM strategies WHERE id=?', (strat_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/strategies/<strat_id>', methods=['DELETE'])
def delete_strategy(strat_id):
    db          = get_db()
    child_count = db.execute('SELECT COUNT(*) FROM strategies WHERE parent_id=?', (strat_id,)).fetchone()[0]
    obs_count   = db.execute('SELECT COUNT(*) FROM observations WHERE strategy_id=?', (strat_id,)).fetchone()[0]
    if child_count > 0 or obs_count > 0:
        db.close()
        return jsonify({'error': 'Strategy has variants or observations linked to it'}), 409
    db.execute('DELETE FROM strategies WHERE id=?', (strat_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── observations ──────────────────────────────────────────────────────────────
@app.route('/api/observations', methods=['GET'])
def get_observations():
    db   = get_db()
    rows = db.execute('SELECT * FROM observations ORDER BY date DESC').fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route('/api/observations', methods=['POST'])
def add_observation():
    data   = request.get_json()
    obs_id = 'obs_' + uuid.uuid4().hex[:8]
    db     = get_db()
    db.execute(
        '''INSERT INTO observations
               (id, date, strategy_id, outcome, match_quality, traded, trade_id, notes, r_multiple)
           VALUES (:id,:date,:strategy_id,:outcome,:match_quality,:traded,:trade_id,:notes,:r_multiple)''',
        {
            'id':            obs_id,
            'date':          data.get('date', ''),
            'strategy_id':   data.get('strategy_id', ''),
            'outcome':       data.get('outcome', 'partial'),
            'match_quality': data.get('match_quality', 'b'),
            'traded':        int(data.get('traded', 0)),
            'trade_id':      data.get('trade_id'),
            'notes':         data.get('notes', ''),
            'r_multiple':    data.get('r_multiple'),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM observations WHERE id=?', (obs_id,)).fetchone()
    db.close()
    return jsonify(row_to_dict(row)), 201


@app.route('/api/observations/<obs_id>', methods=['PUT'])
def update_observation(obs_id):
    data = request.get_json()
    db   = get_db()
    db.execute(
        '''UPDATE observations SET
               date=:date, strategy_id=:strategy_id, outcome=:outcome,
               match_quality=:match_quality, traded=:traded, trade_id=:trade_id, notes=:notes,
               r_multiple=:r_multiple
           WHERE id=:id''',
        {
            'id':            obs_id,
            'date':          data.get('date', ''),
            'strategy_id':   data.get('strategy_id', ''),
            'outcome':       data.get('outcome', 'partial'),
            'match_quality': data.get('match_quality', 'b'),
            'traded':        int(data.get('traded', 0)),
            'trade_id':      data.get('trade_id'),
            'notes':         data.get('notes', ''),
            'r_multiple':    data.get('r_multiple'),
        }
    )
    db.commit()
    row = db.execute('SELECT * FROM observations WHERE id=?', (obs_id,)).fetchone()
    db.close()
    if row is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row_to_dict(row))


@app.route('/api/observations/<obs_id>', methods=['DELETE'])
def delete_observation(obs_id):
    folder = os.path.join(IMAGES_DIR, 'observations', obs_id)
    shutil.rmtree(folder, ignore_errors=True)
    db = get_db()
    db.execute('DELETE FROM observations WHERE id=?', (obs_id,))
    db.commit()
    db.close()
    return jsonify({'ok': True})


# ── strategy reference images ──────────────────────────────────────────────────
@app.route('/api/strategies/<strat_id>/images', methods=['GET'])
def get_strategy_images(strat_id):
    folder = os.path.join(IMAGES_DIR, 'strategies', strat_id)
    if not os.path.exists(folder):
        return jsonify([])
    files = sorted(
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    )
    return jsonify([f'/api/strategy-images/{strat_id}/{f}' for f in files])


@app.route('/api/strategies/<strat_id>/images', methods=['POST'])
def upload_strategy_images(strat_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    files  = request.files.getlist('file')
    folder = os.path.join(IMAGES_DIR, 'strategies', strat_id)
    os.makedirs(folder, exist_ok=True)
    saved  = []
    for f in files:
        raw = secure_filename(f.filename or '')
        if not raw:
            continue
        base, ext = os.path.splitext(raw)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            continue
        unique = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
        f.save(os.path.join(folder, unique))
        saved.append(f'/api/strategy-images/{strat_id}/{unique}')
    return jsonify(saved), 201


@app.route('/api/strategies/<strat_id>/images/<filename>', methods=['DELETE'])
def delete_strategy_image(strat_id, filename):
    filename = os.path.basename(filename)
    path     = os.path.join(IMAGES_DIR, 'strategies', strat_id, filename)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({'ok': True})


@app.route('/api/strategy-images/<strat_id>/<filename>')
def serve_strategy_image(strat_id, filename):
    filename = os.path.basename(filename)
    folder   = os.path.join(IMAGES_DIR, 'strategies', strat_id)
    return send_from_directory(folder, filename)


# ── observation images ────────────────────────────────────────────────────────
@app.route('/api/observations/<obs_id>/images', methods=['GET'])
def get_observation_images(obs_id):
    folder = os.path.join(IMAGES_DIR, 'observations', obs_id)
    if not os.path.exists(folder):
        return jsonify([])
    files = sorted(
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    )
    return jsonify([f'/api/observation-images/{obs_id}/{f}' for f in files])


@app.route('/api/observations/<obs_id>/images', methods=['POST'])
def upload_observation_images(obs_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    files  = request.files.getlist('file')
    folder = os.path.join(IMAGES_DIR, 'observations', obs_id)
    os.makedirs(folder, exist_ok=True)
    saved  = []
    for f in files:
        raw = secure_filename(f.filename or '')
        if not raw:
            continue
        base, ext = os.path.splitext(raw)
        if ext.lower() not in ALLOWED_EXTENSIONS:
            continue
        unique = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
        f.save(os.path.join(folder, unique))
        saved.append(f'/api/observation-images/{obs_id}/{unique}')
    if saved:
        db = get_db()
        db.execute('UPDATE observations SET has_image=1 WHERE id=?', (obs_id,))
        db.commit()
        db.close()
    return jsonify(saved), 201


@app.route('/api/observations/<obs_id>/images/<filename>', methods=['DELETE'])
def delete_observation_image(obs_id, filename):
    filename  = os.path.basename(filename)
    folder    = os.path.join(IMAGES_DIR, 'observations', obs_id)
    path      = os.path.join(folder, filename)
    if os.path.exists(path):
        os.remove(path)
    remaining = [
        f for f in os.listdir(folder)
        if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS
    ] if os.path.exists(folder) else []
    if not remaining:
        db = get_db()
        db.execute('UPDATE observations SET has_image=0 WHERE id=?', (obs_id,))
        db.commit()
        db.close()
    return jsonify({'ok': True})


@app.route('/api/observation-images/<obs_id>/<filename>')
def serve_observation_image(obs_id, filename):
    filename = os.path.basename(filename)
    folder   = os.path.join(IMAGES_DIR, 'observations', obs_id)
    return send_from_directory(folder, filename)


# ── CSV import (Tradovate Orders export) ──────────────────────────────────────
@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file       = request.files['file']
    account_id = request.form.get('account_id') or None

    try:
        content = file.read().decode('utf-8-sig')
    except Exception as e:
        return jsonify({'error': f'Could not read file: {e}'}), 400

    reader = csv.DictReader(io.StringIO(content))
    raw_rows = []
    for row in reader:
        raw_rows.append({k.strip(): (v.strip() if v else '') for k, v in row.items() if k and k.strip()})

    if not raw_rows:
        return jsonify({'imported': 0, 'skipped': 0, 'errors': ['CSV is empty or unreadable']}), 200

    rows = [_normalize_order_row(r) for r in raw_rows]

    # Only process filled orders
    filled = [r for r in rows if r['status'] == 'Filled']
    if not filled:
        return jsonify({
            'imported': 0,
            'skipped':  len(rows),
            'errors':   ['No filled orders found. Export "Orders" from Tradovate or TradingView and make sure some were filled.'],
        }), 200

    filled.sort(key=lambda r: r['sort_key'])

    # Fetch tick values from instruments table
    db = get_db()
    tv_rows = db.execute('SELECT symbol, tick_value FROM instruments').fetchall()
    tick_value_map = {r['symbol']: r['tick_value'] for r in tv_rows}

    # Group by symbol
    from collections import defaultdict
    by_symbol = defaultdict(list)
    for r in filled:
        if r['symbol']:
            by_symbol[r['symbol']].append(r)

    trades_to_insert = []
    total_skipped    = len(rows) - len(filled)   # canceled/not-filled rows
    errors           = []

    for symbol, orders in by_symbol.items():
        tick_size  = TICK_SIZES.get(symbol, 0.25)
        tick_value = tick_value_map.get(symbol, 1.0)

        # FIFO position matching: pair each entry fill with the next exit fill
        long_queue  = []   # [[price, qty, datetime]]
        short_queue = []

        for order in orders:
            side = order['side']
            try:
                price = float(order['price_raw'] or 0)
                qty   = int(float(order['qty_raw'] or 0))
            except (ValueError, TypeError) as exc:
                errors.append(f'{symbol}: bad price/qty — {exc}')
                total_skipped += 1
                continue

            if not price or not qty:
                total_skipped += 1
                continue

            fill_fmt  = order['datetime']
            remaining = qty

            if side == 'Buy':
                # Close any open shorts first (FIFO)
                while remaining > 0 and short_queue:
                    ep, eq, edt = short_queue[0]
                    matched = min(remaining, eq)
                    pnl     = round((ep - price) / tick_size * tick_value * matched, 2)
                    ticks   = round((ep - price) / tick_size)
                    trades_to_insert.append({
                        'datetime': edt, 'symbol': symbol, 'direction': 'Short',
                        'entry': ep, 'exit': price, 'quantity': matched,
                        'ticks': ticks, 'pnl': pnl, 'commission': 0,
                        'tags': '[]', 'account_id': account_id,
                    })
                    remaining -= matched
                    left = eq - matched
                    if left > 0:
                        short_queue[0] = [ep, left, edt]
                    else:
                        short_queue.pop(0)
                if remaining > 0:
                    long_queue.append([price, remaining, fill_fmt])

            elif side == 'Sell':
                # Close any open longs first (FIFO)
                while remaining > 0 and long_queue:
                    ep, eq, edt = long_queue[0]
                    matched = min(remaining, eq)
                    pnl     = round((price - ep) / tick_size * tick_value * matched, 2)
                    ticks   = round((price - ep) / tick_size)
                    trades_to_insert.append({
                        'datetime': edt, 'symbol': symbol, 'direction': 'Long',
                        'entry': ep, 'exit': price, 'quantity': matched,
                        'ticks': ticks, 'pnl': pnl, 'commission': 0,
                        'tags': '[]', 'account_id': account_id,
                    })
                    remaining -= matched
                    left = eq - matched
                    if left > 0:
                        long_queue[0] = [ep, left, edt]
                    else:
                        long_queue.pop(0)
                if remaining > 0:
                    short_queue.append([price, remaining, fill_fmt])

        unclosed = sum(q for _, q, _ in long_queue) + sum(q for _, q, _ in short_queue)
        if unclosed:
            total_skipped += unclosed
            errors.append(f'{symbol}: {unclosed} contract(s) left open (no matching close)')

    for t in trades_to_insert:
        db.execute('''
            INSERT INTO trades
                (datetime, symbol, direction, entry, exit, quantity,
                 ticks, pnl, commission, tags, account_id)
            VALUES
                (:datetime,:symbol,:direction,:entry,:exit,:quantity,
                 :ticks,:pnl,:commission,:tags,:account_id)
        ''', t)
    db.commit()
    db.close()

    return jsonify({
        'imported': len(trades_to_insert),
        'skipped':  total_skipped,
        'errors':   errors[:20],
    })


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
