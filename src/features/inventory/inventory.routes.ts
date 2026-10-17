import { Router } from 'express';
import { processUserQuery, getRestockSuggestions } from './inventory.controller.js';
import { verifyToken, requireAdmin } from '../auth/auth.middleware.js';

const router = Router();

router.post('/query', verifyToken, requireAdmin, processUserQuery);
router.get('/restocks', verifyToken, requireAdmin, getRestockSuggestions); // alertas de reestock pendientes de aprobación

export default router;
