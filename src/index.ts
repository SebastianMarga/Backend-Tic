import express from 'express';

import authRoutes from '../src/features/auth/auth.routes.js'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Servidor de Inventario Inteligente corriendo 🚀' });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});