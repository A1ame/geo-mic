import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

declare const Peer: any;

const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnection: true
});

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  const peerRef = useRef<any>(null);

  const startPeerConnection = () => {
    // Проверка, загрузилась ли библиотека из CDN
    if (typeof Peer === 'undefined') {
      console.error("Библиотека PeerJS не загружена!");
      setTimeout(startPeerConnection, 1000);
      return;
    }

    if (peerRef.current) return;

    const newId = `id-${Math.random().toString(36).substring(2, 11)}`;
    
    try {
      const peer = new Peer(newId, {
        host: 'geo-mic-production-2da6.up.railway.app',
        port: 443,
        path: '/peerjs',
        secure: true,
        debug: 1
      });

      peer.on('open', (id: string) => {
        console.log('✅ Voice OK:', id);
        setPeerId(id);
      });

      peer.on('error', (err: any) => {
        console.error('Peer error:', err.type);
        if (err.type === 'network' || err.type === 'server-error') {
          peer.destroy();
          peerRef.current = null;
          setPeerId('');
          setTimeout(startPeerConnection, 3000);
        }
      });

      peerRef.current = peer;
    } catch (e) {
      console.error("Ошибка при создании Peer:", e);
    }
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setPeerId('');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, []);

  const handleJoin = (selectedRole: 'admin' | 'user', name: string) => {
    setRole(selectedRole);
    setUserName(name);
    socket.emit('join', { name, role: selectedRole });
    // Запуск Peer с небольшой задержкой, чтобы сокет успел соединиться
    setTimeout(startPeerConnection, 1000);
  };

  if (!role) {
    return <RoleSelection onSelect={handleJoin} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Пробрасываем peer только если он создан */}
      {role === 'admin' ? (
        <AdminView socket={socket} peer={peerRef.current} />
      ) : (
        <ParticipantView 
          socket={socket} 
          peer={peerRef.current} 
          userName={userName}
        />
      )}
      
      <div className="fixed bottom-4 right-4 flex gap-3 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={peerId ? "text-green-400" : "text-red-400"}>●</span> VOICE
        </div>
        <div className="flex items-center gap-1.5">
          <span className={isConnected ? "text-green-400" : "text-red-400"}>●</span> SERVER
        </div>
      </div>
    </div>
  );
};

export default App;