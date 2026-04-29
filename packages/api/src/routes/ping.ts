import { Router } from 'express';
import type { Request, Response } from 'express';
import { ok } from '../lib/response.js';

const router: Router = Router();

/**
 * GET /api/v1/ping
 * Simple authenticated endpoint for testing auth middleware.
 */
router.get('/', (req: Request, res: Response) => {
  res.json(ok({
    message: 'pong',
    user: req.user,
  }));
});

export default router;
