import sqlite3
import json
import os
import random
from datetime import datetime, timedelta

DB_PATH = os.environ.get('DB_PATH', '/app/data/trading_journal.db')

MOCK_INSTRUMENTS = [
    ('ES',  'E-mini S&P 500',          12.50, '#4f9cf9'),
    ('NQ',  'E-mini Nasdaq-100',         5.00, '#a78bfa'),
    ('MES', 'Micro E-mini S&P 500',      1.25, '#38bdf8'),
    ('MNQ', 'Micro E-mini Nasdaq-100',   0.50, '#c084fc'),
    ('YM',  'E-mini Dow Jones',          5.00, '#fb923c'),
    ('CL',  'Crude Oil',                10.00, '#facc15'),
    ('GC',  'Gold',                     10.00, '#fbbf24'),
    ('RTY', 'E-mini Russell 2000',       5.00, '#34d399'),
]

MOCK_TAGS = [
    ('tag_breakout', 'Breakout',     '#4f9cf9'),
    ('tag_reversal', 'Reversal',     '#a78bfa'),
    ('tag_trend',    'Trend Follow', '#2bd97c'),
    ('tag_fomo',     'FOMO',         '#ef5e5e'),
    ('tag_revenge',  'Revenge',      '#ef5e5e'),
    ('tag_setup_a',  'Setup A',      '#f5b942'),
    ('tag_setup_b',  'Setup B',      '#fb923c'),
    ('tag_news',     'News Play',    '#38bdf8'),
    ('tag_scalp',    'Scalp',        '#34d399'),
    ('tag_swing',    'Swing',        '#c084fc'),
]


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript('''
        CREATE TABLE IF NOT EXISTS trades (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            datetime      TEXT    NOT NULL,
            symbol        TEXT    NOT NULL,
            direction     TEXT    NOT NULL,
            entry         REAL    NOT NULL,
            exit          REAL    NOT NULL,
            quantity      INTEGER NOT NULL,
            ticks         REAL,
            r_multiple    REAL,
            pnl           REAL    NOT NULL,
            commission    REAL    DEFAULT 0,
            notes         TEXT    DEFAULT '',
            tags          TEXT    DEFAULT '[]',
            has_screenshot INTEGER DEFAULT 0,
            created_at    TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS instruments (
            symbol     TEXT PRIMARY KEY,
            name       TEXT,
            tick_value REAL,
            color      TEXT
        );

        CREATE TABLE IF NOT EXISTS tags (
            id    TEXT PRIMARY KEY,
            label TEXT,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS checklist (
            id         TEXT PRIMARY KEY,
            text       TEXT,
            done       INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    ''')

    # Seed instruments
    c.execute('SELECT COUNT(*) FROM instruments')
    if c.fetchone()[0] == 0:
        c.executemany('INSERT INTO instruments VALUES (?,?,?,?)', MOCK_INSTRUMENTS)

    # Seed tags
    c.execute('SELECT COUNT(*) FROM tags')
    if c.fetchone()[0] == 0:
        c.executemany('INSERT INTO tags VALUES (?,?,?)', MOCK_TAGS)

    # Seed checklist
    c.execute('SELECT COUNT(*) FROM checklist')
    if c.fetchone()[0] == 0:
        default_checklist = [
            ('cl_1', 'Check pre-market levels',          0, 1),
            ('cl_2', 'Review economic calendar',         0, 2),
            ('cl_3', 'Identify key support / resistance',0, 3),
            ('cl_4', 'Set daily loss limit',             0, 4),
            ('cl_5', 'Define trade setups for today',    0, 5),
        ]
        c.executemany('INSERT INTO checklist VALUES (?,?,?,?)', default_checklist)

    # Seed settings
    default_settings = [
        ('visible_widgets',
         json.dumps(['equity_curve', 'daily_pnl', 'win_rate',
                     'checklist', 'calendar', 'streak'])),
        ('theme',          'dark'),
        ('default_symbol', 'ES'),
    ]
    for key, value in default_settings:
        c.execute('INSERT OR IGNORE INTO settings VALUES (?,?)', (key, value))

    # Seed sample trades so the dashboard looks live on first run
    c.execute('SELECT COUNT(*) FROM trades')
    if c.fetchone()[0] == 0:
        _seed_sample_trades(c)

    # Add journal columns to existing DBs (idempotent)
    journal_cols = [
        "ALTER TABLE trades ADD COLUMN strategy       TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN plan           TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN execution      TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN emotion        TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN entry_score    INTEGER DEFAULT 0",
        "ALTER TABLE trades ADD COLUMN exit_score     INTEGER DEFAULT 0",
        "ALTER TABLE trades ADD COLUMN risk_score     INTEGER DEFAULT 0",
        "ALTER TABLE trades ADD COLUMN plan_adherence        INTEGER DEFAULT 0",
        "ALTER TABLE trades ADD COLUMN lessons               TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN plan_followed         TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN biggest_mistake       TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN would_do_differently  TEXT    DEFAULT ''",
        "ALTER TABLE trades ADD COLUMN overall_rating        INTEGER DEFAULT 0",
        "ALTER TABLE trades ADD COLUMN chart_link            TEXT    DEFAULT ''",
    ]
    for sql in journal_cols:
        try:
            c.execute(sql)
        except Exception:
            pass  # column already exists

    conn.commit()
    conn.close()


def _seed_sample_trades(cursor):
    random.seed(42)
    now = datetime.now()

    instrument_cfg = {
        'ES':  {'base': 5050.0, 'tick': 0.25, 'tick_val': 12.50},
        'NQ':  {'base': 17800.0,'tick': 0.25, 'tick_val':  5.00},
        'MES': {'base': 5050.0, 'tick': 0.25, 'tick_val':  1.25},
        'MNQ': {'base': 17800.0,'tick': 0.25, 'tick_val':  0.50},
    }
    symbols     = ['ES', 'NQ', 'MES', 'MNQ']
    directions  = ['Long', 'Short']
    tag_pool    = ['tag_breakout', 'tag_reversal', 'tag_trend',
                   'tag_setup_a', 'tag_setup_b', 'tag_scalp']

    trades = []
    for i in range(55):
        days_back = random.randint(0, 89)
        hour      = random.randint(8, 15)
        minute    = random.randint(0, 59)
        dt        = (now - timedelta(days=days_back)).replace(
            hour=hour, minute=minute, second=0, microsecond=0)

        symbol    = random.choice(symbols)
        direction = random.choice(directions)
        cfg       = instrument_cfg[symbol]

        entry = round(cfg['base'] + random.uniform(-80, 80), 2)
        win   = random.random() < 0.58          # ~58 % win rate
        ticks = random.randint(4, 24) if win else -random.randint(2, 12)

        if direction == 'Long':
            exit_price = round(entry + ticks * cfg['tick'], 2)
        else:
            exit_price = round(entry - ticks * cfg['tick'], 2)

        qty        = random.randint(1, 3)
        gross_pnl  = round(ticks * cfg['tick_val'] * qty, 2)
        commission = round(qty * 2 * 2.09, 2)        # $2.09/side/contract
        net_pnl    = round(gross_pnl - commission, 2)
        r_mult     = round(ticks / 8, 2)             # assume 8-tick initial risk
        trade_tags = json.dumps(random.sample(tag_pool, random.randint(0, 2)))

        trades.append((
            dt.strftime('%Y-%m-%dT%H:%M'),
            symbol, direction,
            entry, exit_price, qty,
            ticks, r_mult, net_pnl, commission,
            '', trade_tags, 0,
        ))

    cursor.executemany('''
        INSERT INTO trades
            (datetime, symbol, direction, entry, exit, quantity,
             ticks, r_multiple, pnl, commission, notes, tags, has_screenshot)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', trades)
