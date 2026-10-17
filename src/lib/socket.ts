import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initSocket = (server: HTTPServer, origin: string | undefined): SocketIOServer => {
    io = new SocketIOServer(server, {
        cors: {
            origin: origin || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] 🟢 Nuevo cliente conectado: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`[Socket] 🔴 Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
};

// Función para obtener la instancia desde cualquier otro servicio
export const getIO = (): SocketIOServer => {
    if (!io) {
        throw new Error('Socket.io no ha sido inicializado. Llama a initSocket primero.');
    }
    return io;
};