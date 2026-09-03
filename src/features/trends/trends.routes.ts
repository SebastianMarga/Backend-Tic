import { Router } from 'express';
import { triggerRpaScraping, receiveRpaResults } from './trends.controller.js';
import { verifyToken, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

router.post('/scan', verifyToken, requireAdmin, triggerRpaScraping);

// Endpoint para RPA
router.post('/results', receiveRpaResults);

export default router;