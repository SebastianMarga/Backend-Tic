import { Router } from 'express';
import { processUserQuery } from './inventory.controller.js';
import { verifyToken, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

router.post('/query', verifyToken, requireAdmin, processUserQuery);

export default router;