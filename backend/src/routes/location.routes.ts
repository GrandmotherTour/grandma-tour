import { Router } from 'express';

const router = Router();

router.get('/current', (_req, res) => {
  res.json({
    success: true,
    data: {
      latitude: 37.5665,
      longitude: 126.978,
      address: '서울시 중구'
    }
  });
});

export default router;
