import { Router, type Router as RouterType } from 'express';
import { ok } from '../lib/response.js';

const router: RouterType = Router();

router.get('/', (_req, res) => {
  res.json(
    ok({
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.0',
      timestamp: new Date().toISOString(),
    }),
  );
});

export default router;
