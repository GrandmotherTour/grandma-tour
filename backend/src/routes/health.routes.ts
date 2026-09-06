import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'jaturip-backend',
    message: 'Service is healthy'
  });
});

export default router;
