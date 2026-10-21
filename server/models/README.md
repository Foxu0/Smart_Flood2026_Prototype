# SmartFlood Models Directory

| File | What it is |
|---|---|
| `flood_lstm.onnx` | The trained 2-layer LSTM, **one self-contained file** (weights included, ~225 KB) |
| `scaler_params.json` | Min/max values used to scale inputs before the model and convert outputs back to metres |
| `test_metrics.json` | Scores on the held-out test set (data the model never saw during training) |
| `training_curves.png`, `hydrograph_samples.png` | Figures for the manuscript |
| `SmartFlood_2026_LSTM_Retrain_2Feature.ipynb` | The notebook that generates the data, trains and exports everything above |

**Inputs:** last 6 readings (10-minute steps = 1 hour): water level (m) and surge rate (m/h).
**Outputs:** predicted water level in 30 and 60 minutes.

**Current test scores** (retrained Oct 19, 2026 with the fixed export):

| Horizon | R² (NSE) | MAE | RMSE |
|---|---|---|---|
| 30 min | 0.800 | 1.65 cm | 2.05 cm |
| 60 min | 0.608 | 2.33 cm | 2.86 cm |

If the model file is missing or broken, the server falls back to a simple formula
(current level + surge rate × time) and the dashboard badge says **"Backup formula"**.

> Re-exporting: run the notebook top to bottom. Cell 11 forces a single-file export;
> if you ever see a `flood_lstm.onnx.data` file, the export is wrong. The server needs only `flood_lstm.onnx`.
