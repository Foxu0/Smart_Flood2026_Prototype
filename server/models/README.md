# SmartFlood Models Directory

| File | What it is |
|---|---|
| `flood_lstm.onnx` | The trained 2-layer LSTM, **one self-contained file** (weights included, ~225 KB) |
| `scaler_params.json` | Min/max values used to scale inputs before the model and convert outputs back to metres |
| `test_metrics.json` | Scores on the held-out test events (never seen during training) |
| `baseline_comparison.json` | LSTM vs two simple methods on the same test events |
| `compare_baselines.py` | Rebuilds the test events and re-checks the comparison from the saved model: `python server/models/compare_baselines.py` |
| `training_curves.png`, `hydrograph_samples.png` | Figures for the manuscript |
| `SmartFlood_2026_LSTM_Retrain_2Feature.ipynb` | The notebook that generates the data, trains and exports everything above |

**Inputs:** the last hour as 6 points, 10 minutes apart: water level (m) and surge rate (m/h).
The server turns live readings (every few seconds) into six 10-minute averages before calling the model.
**Outputs:** predicted water level in 30 and 60 minutes.

**Training data:** simulated flood events (typhoon, flash flood, moderate rain, minor rise, calm days),
600 events. Each event goes **whole** into train / validation / test (70/15/15 within each event type),
so every kind of event is tested and no test event was seen during training.

**Test scores** (retrained Oct 22, 2026):

| | 30 min MAE | 30 min R² | 60 min MAE | 60 min R² |
|---|---|---|---|---|
| All test events | 1.25 cm | 0.996 | 1.81 cm | 0.990 |
| Flood events only | 1.33 cm | 0.996 | 1.98 cm | 0.989 |

**Compared with simple methods** (flood events only, average error):

| Method | 30 min | 60 min |
|---|---|---|
| Persistence (level stays the same) | 4.03 cm | 7.61 cm |
| Simple formula (level + surge rate × time) | 3.46 cm | 6.67 cm |
| **LSTM** | **1.33 cm** | **1.98 cm** |

> Note: the data is simulated, so these scores show the model learned the simulated flood patterns.
> Real-river accuracy must be measured once the sensors are installed.

If the model file is missing or broken, the server falls back to a simple formula
(current level + surge rate × time) and the dashboard badge says **"Backup formula"**.

> Re-exporting: run the notebook top to bottom. Cell 11 forces a single-file export;
> if you ever see a `flood_lstm.onnx.data` file, the export is wrong. The server needs only `flood_lstm.onnx`.
