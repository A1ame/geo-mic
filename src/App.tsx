import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

declare const Peer: any;

const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true
});

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isPeerLoading, setIsPeerLoading] = useState(false);

  const peerRef = useRef<any>(null);

  const startPeer = () => {
    if (peerRef.current || typeof Peer === 'undefined') return;
    
    setIsPeerLoading(true);
    const customId = `id-${Math.random().toString(36).substr(2, 9)}`;
    
    const peer = new Peer(customId, {
      host: 'geo-mic-production-2da6.up.railway.app',
      port: 443,
      path: '/peerjs',
      secure: true,
      debug: 1
    });

    peer.on('open', (id: string) => {
      console.log('✅ Voice Connected:', id);
      setPeerId(id);
      setIsPeerLoading(false);
    });

    peer.on('error', (err: any) => {
      console.error('Peer error:', err.type);
      setIsPeerLoading(false);
      if (err.type !== 'peer-unavailable') {
        peer.destroy();
        peerRef.current = null;
        setTimeout(startPeer, 5000);
      }
    });

    peerRef.current = peer;
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, []);

  const handleJoin = (selectedRole: 'admin' | 'user', name: string) => {
    setRole(selectedRole);
    setUserName(name);
    socket.emit('join', { name, role: selectedRole });
    // Даем серверу «продышаться» перед запуском тяжелого PeerJS
    setTimeout(startPeer, 1500);
  };

  if (!role) return <RoleSelection onSelect={handleJoin} />;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {!peerId && isPeerLoading ? (
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-300 animate-pulse">Настройка голосовой связи...</p>
        </div>
      ) : (
        role === 'admin' ? 
          <AdminView socket={socket} peer={peerRef.current} /> : 
          <ParticipantView socket={socket} peer={peerRef.current} userName={userName} />
      )}
      
      <div className="fixed bottom-4 right-4 flex gap-3 px-3 py-2 bg-black/60 rounded-lg border border-white/10 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={peerId ? "text-green-400" : "text-yellow-400"}>●</span> VOICE
        </div>
        <div className="flex items-center gap-1.5">
          <span className={isConnected ? "text-green-400" : "text-red-400"}>●</span> SERVER
        </div>
      </div>
    </div>
  );
};

export default App;