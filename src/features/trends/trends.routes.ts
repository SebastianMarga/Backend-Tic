import { Router } from 'express';
import { triggerRpaScraping, receiveRpaResults, getAll, approve, reject } from './trends.controller.js';
import { verifyToken, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

router.post('/scan', verifyToken, requireAdmin, triggerRpaScraping);
router.get('/trend-products', verifyToken, requireAdmin, getAll);
router.patch('/:id/approve', verifyToken, requireAdmin, approve);
router.patch('/:id/reject', verifyToken, requireAdmin, reject);

// Endpoint para RPA
router.post('/results', receiveRpaResults);

export default router;