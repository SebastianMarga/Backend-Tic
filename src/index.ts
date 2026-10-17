import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { initSocket } from './lib/socket.js';

import authRoutes from './features/auth/auth.routes.js'
import trendRoutes from './features/trends/trends.routes.js'
import inventoryRoutes from './features/inventory/inventory.routes.js';
import userRoutes from './features/user/user.routes.js'
import iotRoutes from './features/iot/iot.routes.js'

import { errorHandler } from './lib/middleware/error-handler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN;

const httpServer = createServer(app);

initSocket(httpServer, ORIGIN);

app.set('trust proxy', 1);

app.use(cors({
    origin: ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());
app.use('/api/inventory', inventoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/trends', trendRoutes);
app.use('/api/user', userRoutes);
app.use('/api/iot', iotRoutes)

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor de Inventario Inteligente corriendo 🚀' });
});

app.use(errorHandler);

httpServer.listen(PORT, () => {
    console.log(`Servidor HTTP y WebSocket escuchando en http://localhost:${PORT}`);
});