import { Router } from 'express';
import { health, live, ready } from '../../../controllers/health';

const router = Router();

// No rate limiter here: the global limiter in app.ts already applies (route
// middleware would double-count every probe), and it skips /health outright
// so orchestrator and load-balancer probes can never be throttled into an
// unhealthy flap.
router.get('/', health);
router.get('/live', live);
router.get('/ready', ready);

export default router;
