import os
import tempfile
import unittest

_TMP_DIR = tempfile.mkdtemp()
os.environ['DB_PATH'] = os.path.join(_TMP_DIR, 'test.db')
os.environ['IMAGES_DIR'] = os.path.join(_TMP_DIR, 'images')

from app import app  # noqa: E402  (must import after env vars are set)


class TradeJournalPreservationTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_editing_core_fields_preserves_journal_data(self):
        create_resp = self.client.post('/api/trades', json={
            'datetime': '2026-06-29T16:30',
            'symbol': 'MNQ',
            'direction': 'Long',
            'entry': 100.0,
            'exit': 105.0,
            'quantity': 1,
            'pnl': 250.5,
            'strategy': 'SB',
            'plan': 'Classic SB entry below range',
            'execution': 'Worked as planned',
            'emotion': 'calm',
            'entry_score': 7,
            'exit_score': 5,
            'risk_score': 9,
            'plan_followed': 'yes',
        })
        trade_id = create_resp.get_json()['id']

        # Mirrors the real "Edit Trade" modal payload: only core fields,
        # no knowledge of the journal fields at all.
        self.client.put(f'/api/trades/{trade_id}', json={
            'datetime': '2026-06-29T16:30',
            'symbol': 'MNQ',
            'direction': 'Long',
            'entry': 100.0,
            'exit': 105.0,
            'quantity': 1,
            'stop_loss': 95.0,
            'take_profit': 110.0,
            'pnl': 250.5,
        })

        trades = self.client.get('/api/trades').get_json()
        trade = next(t for t in trades if t['id'] == trade_id)

        self.assertEqual(trade['strategy'], 'SB')
        self.assertEqual(trade['plan'], 'Classic SB entry below range')
        self.assertEqual(trade['execution'], 'Worked as planned')
        self.assertEqual(trade['emotion'], 'calm')
        self.assertEqual(trade['entry_score'], 7)
        self.assertEqual(trade['exit_score'], 5)
        self.assertEqual(trade['risk_score'], 9)
        self.assertEqual(trade['plan_followed'], 'yes')
        self.assertEqual(trade['stop_loss'], 95.0)
        self.assertEqual(trade['take_profit'], 110.0)

    def test_full_payload_update_changes_all_included_fields(self):
        create_resp = self.client.post('/api/trades', json={
            'datetime': '2026-06-29T16:30', 'symbol': 'MNQ', 'direction': 'Long',
            'entry': 100.0, 'exit': 105.0, 'quantity': 1, 'pnl': 250.5,
            'strategy': 'SB',
        })
        trade_id = create_resp.get_json()['id']

        # Mirrors the Journal tab's save, which always spreads the full
        # trade object plus the edited journal fields.
        self.client.put(f'/api/trades/{trade_id}', json={
            'datetime': '2026-06-29T16:30', 'symbol': 'MNQ', 'direction': 'Long',
            'entry': 100.0, 'exit': 105.0, 'quantity': 1, 'pnl': 250.5,
            'strategy': 'ORB', 'plan': 'Updated plan',
        })

        trades = self.client.get('/api/trades').get_json()
        trade = next(t for t in trades if t['id'] == trade_id)
        self.assertEqual(trade['strategy'], 'ORB')
        self.assertEqual(trade['plan'], 'Updated plan')

    def test_explicit_empty_value_still_clears_field(self):
        create_resp = self.client.post('/api/trades', json={
            'datetime': '2026-06-29T16:30', 'symbol': 'MNQ', 'direction': 'Long',
            'entry': 100.0, 'exit': 105.0, 'quantity': 1, 'pnl': 250.5,
            'strategy': 'SB',
        })
        trade_id = create_resp.get_json()['id']

        # Explicitly sending an empty value must still be honored as an
        # intentional clear, not silently ignored in favor of the old value.
        self.client.put(f'/api/trades/{trade_id}', json={
            'datetime': '2026-06-29T16:30', 'symbol': 'MNQ', 'direction': 'Long',
            'entry': 100.0, 'exit': 105.0, 'quantity': 1, 'pnl': 250.5,
            'strategy': '',
        })

        trades = self.client.get('/api/trades').get_json()
        trade = next(t for t in trades if t['id'] == trade_id)
        self.assertEqual(trade['strategy'], '')


class OtherEndpointsPreservationTest(unittest.TestCase):
    """Same class of bug as trades: a PUT with a partial payload must not
    reset fields the caller didn't mention back to hardcoded defaults."""

    def setUp(self):
        self.client = app.test_client()

    def test_tag_update_preserves_omitted_color(self):
        created = self.client.post('/api/tags', json={'label': 'Breakout', 'color': '#111111'}).get_json()
        self.client.put(f"/api/tags/{created['id']}", json={'label': 'Reversal'})
        tags = self.client.get('/api/tags').get_json()
        tag = next(t for t in tags if t['id'] == created['id'])
        self.assertEqual(tag['label'], 'Reversal')
        self.assertEqual(tag['color'], '#111111')

    def test_account_update_preserves_omitted_sort_order(self):
        created = self.client.post('/api/accounts', json={'name': 'MFFU Live', 'sort_order': 5}).get_json()
        # Mirrors AccountRow's save payload, which never mentions sort_order.
        self.client.put(f"/api/accounts/{created['id']}", json={
            'name': 'MFFU Live 2', 'firm': 'MFFU', 'account_type': 'live',
            'status': 'active', 'account_size': None, 'risk_per_trade': None,
            'max_daily_loss': None, 'max_weekly_loss': None, 'color': '#4f9cf9',
        })
        accounts = self.client.get('/api/accounts').get_json()
        acc = next(a for a in accounts if a['id'] == created['id'])
        self.assertEqual(acc['name'], 'MFFU Live 2')
        self.assertEqual(acc['sort_order'], 5)

    def test_checklist_update_preserves_omitted_text(self):
        created = self.client.post('/api/checklist', json={'text': 'Check pre-market levels'}).get_json()
        # Mirrors the checklist widget's "toggle done" click, which only sends done.
        self.client.put(f"/api/checklist/{created['id']}", json={'done': 1})
        items = self.client.get('/api/checklist').get_json()
        item = next(i for i in items if i['id'] == created['id'])
        self.assertEqual(item['text'], 'Check pre-market levels')
        self.assertEqual(item['done'], 1)

    def test_expense_update_preserves_omitted_vendor(self):
        created = self.client.post('/api/expenses', json={
            'date': '2026-06-29', 'category': 'Software', 'vendor': 'TradingView', 'amount': 30,
        }).get_json()
        self.client.put(f"/api/expenses/{created['id']}", json={
            'date': '2026-06-29', 'category': 'Software', 'amount': 45,
        })
        expenses = self.client.get('/api/expenses').get_json()
        exp = next(e for e in expenses if e['id'] == created['id'])
        self.assertEqual(exp['vendor'], 'TradingView')
        self.assertEqual(exp['amount'], 45)

    def test_strategy_update_preserves_omitted_sort_order(self):
        created = self.client.post('/api/strategies', json={'name': 'Supply/Demand', 'sort_order': 3}).get_json()
        # Mirrors StrategyModal's save payload, which never mentions sort_order.
        self.client.put(f"/api/strategies/{created['id']}", json={
            'name': 'Supply/Demand v2', 'description': 'Updated criteria',
            'status': 'active', 'color': '#4f9cf9', 'parent_id': None,
        })
        strategies = self.client.get('/api/strategies').get_json()
        strat = next(s for s in strategies if s['id'] == created['id'])
        self.assertEqual(strat['name'], 'Supply/Demand v2')
        self.assertEqual(strat['sort_order'], 3)

    def test_observation_update_preserves_omitted_notes_and_r_multiple(self):
        created = self.client.post('/api/observations', json={
            'date': '2026-06-29', 'strategy_id': 'strat_x', 'notes': 'Clean break, no entry', 'r_multiple': 1.5,
        }).get_json()
        self.client.put(f"/api/observations/{created['id']}", json={
            'date': '2026-06-29', 'strategy_id': 'strat_x', 'outcome': 'win',
        })
        observations = self.client.get('/api/observations').get_json()
        obs = next(o for o in observations if o['id'] == created['id'])
        self.assertEqual(obs['outcome'], 'win')
        self.assertEqual(obs['notes'], 'Clean break, no entry')
        self.assertEqual(obs['r_multiple'], 1.5)


if __name__ == '__main__':
    unittest.main()
