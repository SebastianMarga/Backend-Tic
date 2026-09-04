import express from 'express';
import cors from 'cors';

import authRoutes from './features/auth/auth.routes.js'
import trendRoutes from './features/trends/trends.routes.js'
import inventoryRoutes from './features/inventory/inventory.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN;
const CREDENTIALS = process.env.CORS_CREDENTIALS === "true" ? true : false;

app.use(cors({
    origin: ORIGIN,
    credentials: CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/api/inventory', inventoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/trends', trendRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor de Inventario Inteligente corriendo 🚀' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});