import { Router } from 'express';
import { processUserQuery } from './inventory.controller.js';

const router = Router();

router.post('/query', processUserQuery);

export default router;