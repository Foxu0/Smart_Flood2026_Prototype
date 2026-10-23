"""
Is the LSTM worth it? Compare it with two simple methods on the SAME test data.

    python server/models/compare_baselines.py

The training notebook (SmartFlood_2026_LSTM_Retrain_2Feature.ipynb) makes its data with a
fixed random seed, so the exact same test events can be rebuilt here without retraining.
Each flood event goes whole into train, validation or test (70/15/15 within each event
type), so the test set has every kind of event and none were seen during training.

Methods compared (all predict the water level 30 and 60 minutes ahead):
  1. Persistence      — "the level stays the same" (the simplest possible forecast)
  2. Simple formula   — current level + surge rate × time (the server's backup method)
  3. LSTM             — flood_lstm.onnx, the model used by Smart Flood

Scores are shown for all test events and for flood events only (typhoon, flash, moderate).
Writes baseline_comparison.json next to this file. Needs: numpy, onnxruntime.
"""
import json
import os

import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Same settings and data generator as the notebook (cells 2–5) ──────────────
SEED = 42
np.random.seed(SEED)
SEQ_LEN, H30, H60 = 6, 3, 6  # 6 steps of 10 minutes; +30 min = 3 steps, +60 min = 6 steps
TYPES = ['typhoon', 'flash', 'moderate', 'minor', 'baseline']
FLOOD_TYPES = ['typhoon', 'flash', 'moderate']


def generate_hydrograph_scenario(n_points=200, scenario='typhoon'):
    t = np.linspace(0, 1, n_points)
    noise = np.random.normal(0, 0.008, n_points)
    if scenario == 'typhoon':
        base = 0.35
        peak = np.random.uniform(1.55, 1.75)
        rise = np.random.uniform(0.30, 0.50)
        levels = base + (peak - base) * np.where(t < rise, (t / rise) ** 1.8, np.exp(-4.5 * (t - rise)))
    elif scenario == 'moderate':
        base = 0.35
        peak = np.random.uniform(1.05, 1.25)
        rise = np.random.uniform(0.35, 0.55)
        levels = base + (peak - base) * np.where(t < rise, (t / rise) ** 2.0, np.exp(-3.0 * (t - rise)))
    elif scenario == 'flash':
        base = 0.35
        peak = np.random.uniform(1.60, 1.85)
        rise = np.random.uniform(0.15, 0.30)
        levels = base + (peak - base) * np.where(t < rise, (t / rise) ** 1.2, np.exp(-7.0 * (t - rise)))
    elif scenario == 'baseline':
        levels = np.full(n_points, np.random.uniform(0.33, 0.40))
    else:
        base = 0.35
        peak = np.random.uniform(0.55, 0.90)
        rise = np.random.uniform(0.30, 0.50)
        levels = base + (peak - base) * np.where(t < rise, (t / rise) ** 2.2, np.exp(-2.5 * (t - rise)))
    return np.clip(levels + noise, 0.30, 3.50)


events = []
for scen, share in [('typhoon', 0.25), ('flash', 0.20), ('moderate', 0.25), ('minor', 0.15), ('baseline', 0.15)]:
    for _ in range(int(600 * share)):
        events.append((scen, generate_hydrograph_scenario(np.random.randint(80, 250), scen)))

# Same event split as notebook cell 4
rng = np.random.RandomState(SEED)
test_events = []
for scen in TYPES:
    evs = [lv for s, lv in events if s == scen]
    order = rng.permutation(len(evs))
    n_tr, n_va = int(len(evs) * 0.70), int(len(evs) * 0.15)
    test_events += [(scen, evs[i]) for k, i in enumerate(order) if k >= n_tr + n_va]


def surge_of(levels):
    s = np.zeros_like(levels)
    s[1:] = (levels[1:] - levels[:-1]) * 6.0  # m/h for 10-minute steps
    return np.clip(s, -2.0, 3.5)


with open(os.path.join(HERE, 'scaler_params.json'), encoding='utf-8') as f:
    scaler = json.load(f)
fmin, frange = np.array(scaler['min']), np.array(scaler['range'])

X, now, rate, true30, true60, types = [], [], [], [], [], []
for scen, lv in test_events:
    feats = np.column_stack([lv, surge_of(lv)])
    feats_n = (feats - fmin) / frange
    for i in range(len(lv) - SEQ_LEN - H60 + 1):
        X.append(feats_n[i:i + SEQ_LEN])
        now.append(lv[i + SEQ_LEN - 1]); rate.append(feats[i + SEQ_LEN - 1, 1])
        true30.append(lv[i + SEQ_LEN + H30 - 1]); true60.append(lv[i + SEQ_LEN + H60 - 1])
        types.append(scen)
X = np.array(X, dtype=np.float32)
now, rate, true30, true60, types = map(np.array, (now, rate, true30, true60, types))

# ── Forecasts ─────────────────────────────────────────────────────────────────
sess = ort.InferenceSession(os.path.join(HERE, 'flood_lstm.onnx'))
out = sess.run(None, {sess.get_inputs()[0].name: X})[0]
methods = {
    'Persistence (level stays the same)': (now, now),
    'Simple formula (level + surge rate x time)': (np.clip(now + rate * 0.5, 0, 3.5), np.clip(now + rate * 1.0, 0, 3.5)),
    'LSTM (Smart Flood model)': (out[:, 0] * frange[0] + fmin[0], out[:, 1] * frange[0] + fmin[0]),
}


def scores(true, pred):
    err = pred - true
    return {
        'MAE_cm': round(float(np.mean(np.abs(err))) * 100, 2),
        'RMSE_cm': round(float(np.sqrt(np.mean(err ** 2))) * 100, 2),
        'R2': round(float(1 - np.sum(err ** 2) / np.sum((true - true.mean()) ** 2)), 3),
    }


result = {}
for group, mask in [('all_test_events', np.ones(len(types), bool)), ('flood_events_only', np.isin(types, FLOOD_TYPES))]:
    result[group] = {'windows': int(mask.sum())}
    print(f"\n{group} ({mask.sum():,} windows)")
    print(f"{'Method':45s} {'30 min: MAE / RMSE / R2':28s} {'60 min: MAE / RMSE / R2'}")
    for name, (p30, p60) in methods.items():
        s30, s60 = scores(true30[mask], p30[mask]), scores(true60[mask], p60[mask])
        result[group][name] = {'30_min': s30, '60_min': s60}
        print(f"{name:45s} {s30['MAE_cm']:5.2f} cm / {s30['RMSE_cm']:5.2f} cm / {s30['R2']:.3f}   "
              f"{s60['MAE_cm']:5.2f} cm / {s60['RMSE_cm']:5.2f} cm / {s60['R2']:.3f}")

with open(os.path.join(HERE, 'baseline_comparison.json'), 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2)
print('\nSaved baseline_comparison.json')
