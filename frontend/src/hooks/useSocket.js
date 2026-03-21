import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export const getSocket = () => {
    if (!socketInstance) {
        socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
            transports: ['websocket'],
            autoConnect: true,
        });
    }
    return socketInstance;
};

// Hook: joins a room and listens for events
export const useSocket = (room, eventHandlers = {}) => {
    const socket = getSocket();
    const handlersRef = useRef(eventHandlers);
    handlersRef.current = eventHandlers;

    useEffect(() => {
        if (room) socket.emit('join_shop', room);

        const entries = Object.entries(handlersRef.current);
        entries.forEach(([event, handler]) => socket.on(event, handler));

        return () => {
            entries.forEach(([event, handler]) => socket.off(event, handler));
        };
    }, [room]);

    return socket;
};

export default useSocket;
