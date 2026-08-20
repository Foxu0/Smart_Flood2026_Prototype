import express from 'express';
import { getCachedOrFetchWeather, fetchWeatherData } from '../services/weatherService.js';

const router = express.Router();

// GET /api/v1/weather — Returns live cached OpenWeatherMap data for Antipolo City
router.get('/', async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const weather = refresh ? await fetchWeatherData() : await getCachedOrFetchWeather();

    if (!weather) {
      return res.status(503).json({
        success: false,
        error: 'Weather data unavailable. Please verify API key configuration.',
      });
    }

    res.json({ success: true, data: weather });
  } catch (err) {
    console.error('[GET /weather]', err);
    res.status(500).json({ success: false, error: 'Internal server error', detail: err.message });
  }
});

export default router;
