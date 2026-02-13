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
  
  // Новые состояния для гео-логики
  const [zone, setZone] = useState<{center: [number, number], radius: number} | null>(null);
  const [isInside, setIsInside] = useState(false);

  const peerRef = useRef<any>(null);

  const startPeer = () => {
    if (peerRef.current || typeof Peer === 'undefined') return;
    
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
    });

    peer.on('error', (err: any) => {
      console.error('Peer error:', err.type);
      if (err.type === 'network' || err.type === 'server-error') {
        setPeerId('');
        peerRef.current = null;
        setTimeout(startPeer, 5000);
      }
    });

    peerRef.current = peer;
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Слушаем обновление зоны от админа
    socket.on('zone-updated', (newZone) => {
      console.log("Получена новая зона:", newZone);
      setZone(newZone);
    });

    return () => { 
      socket.off('connect');
      socket.off('disconnect');
      socket.off('zone-updated');
      if (peerRef.current) peerRef.current.destroy(); 
    };
  }, []);

  // Логика проверки дистанции (для участника)
  useEffect(() => {
    if (role === 'user' && zone) {
      const watchId = navigator.geolocation.watchPosition((pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        
        // Формула Haversine или простая проверка через Leaflet
        const center = L.latLng(zone.center[0], zone.center[1]);
        const userLoc = L.latLng(userLat, userLng);
        const distance = center.distanceTo(userLoc); // Расстояние в метрах

        setIsInside(distance <= zone.radius);
      }, (err) => console.error(err), { enableHighAccuracy: true });

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [role, zone]);

  const handleJoin = (selectedRole: 'admin' | 'user', name: string) => {
    setRole(selectedRole);
    setUserName(name);
    socket.emit('join', { name, role: selectedRole });
    setTimeout(startPeer, 1000);
  };

  if (!role) return <RoleSelection onSelect={handleJoin} />;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {peerId && peerRef.current ? (
        role === 'admin' ? (
          <AdminView 
            socket={socket} 
            peer={peerRef.current} 
            adminName={userName} 
          />
        ) : (
          <ParticipantView 
            socket={socket} 
            peer={peerRef.current} 
            userName={userName}
            isInside={isInside} // Передаем статус "в зоне"
          />
        )
      ) : (
        <div className="flex h-screen items-center justify-center flex-col gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-300 animate-pulse text-sm font-black uppercase tracking-widest">
            Connecting...
          </p>
        </div>
      )}
      
      {/* Статус-бар */}
      <div className="fixed bottom-4 left-4 flex gap-3 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[8px] font-bold tracking-tighter uppercase z-[9999]">
        <div className="flex items-center gap-1.5">
          <span className={peerId ? "text-green-400" : "text-yellow-400"}>●</span> Voice
        </div>
        <div className="flex items-center gap-1.5">
          <span className={isConnected ? "text-green-400" : "text-red-400"}>●</span> Server
        </div>
        {role === 'user' && (
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
            <span className={isInside ? "text-green-400" : "text-red-400"}>●</span> Zone
          </div>
        )}
      </div>
    </div>
  );
};

export default App;