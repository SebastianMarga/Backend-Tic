import express from 'express';

import authRoutes from './features/auth/auth.routes.js'
import trendRoutes from './features/trends/trends.routes.js'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/trends', trendRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor de Inventario Inteligente corriendo 🚀' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});