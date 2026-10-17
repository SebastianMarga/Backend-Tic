import { Router } from 'express';
import { handleStockAlert } from './iot.controller.js';

const router = Router();

router.post('/alerta-stock', handleStockAlert);

export default router;