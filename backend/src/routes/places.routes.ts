import { Router } from 'express';
import { placeService } from '../services/place.service.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';

    if (!query.trim()) {
      res.json({ success: false, message: 'query is required', items: [] });
      return;
    }

    const latitude = typeof req.query.latitude === 'string' ? Number(req.query.latitude) : undefined;
    const longitude = typeof req.query.longitude === 'string' ? Number(req.query.longitude) : undefined;
    const result = await placeService.searchPlaces(query, { latitude, longitude });

    res.json({
      success: true,
      query: result.query,
      items: result.items
    });
  } catch (error) {
    next(error);
  }
});

export default router;
