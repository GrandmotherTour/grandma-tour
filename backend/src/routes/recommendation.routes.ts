import { Router } from 'express';
import { recommendationService } from '../services/recommendation.service.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const result = await recommendationService.buildRecommendation(req.body);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
