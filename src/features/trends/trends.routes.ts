import { Router } from 'express';
import { triggerRpaScraping, receiveRpaResults, getAll, approve, reject } from './trends.controller.js';
import { verifyToken, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

router.post('/scan', verifyToken, requireAdmin, triggerRpaScraping);
router.get('/trend-products', verifyToken, requireAdmin, getAll);
router.patch('/approve', verifyToken, requireAdmin, approve);
router.patch('/reject', verifyToken, requireAdmin, reject);

// Endpoint para RPA
router.post('/results', receiveRpaResults);

export default router;