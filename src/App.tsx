import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import L from 'leaflet'; // Важно для расчета дистанции
import 'leaflet/dist/leaflet.css';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

// Указываем TS, что Peer придет из внешнего скрипта в index.html
declare const Peer: any;

const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

// Инициализация сокета за пределами компонента, чтобы избежать лишних переподключений
const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true
});

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Гео-логика: координаты центра зоны и радиус
  const [zone, setZone] = useState<{center: [number, number], radius: number} | null>(null);
  const [isInside, setIsInside] = useState(false);

  const peerRef = useRef<any>(null);

  // Функция запуска голосового движка
  const startPeer = () => {
    if (peerRef.current || typeof Peer === 'undefined') return;
    
    const customId = `id-${Math.random().toString(36).substring(2, 11)}`;
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
      console.error('PeerJS Error:', err.type);
      if (err.type === 'network' || err.type === 'server-error') {
        setPeerId('');
        peerRef.current = null;
        setTimeout(startPeer, 5000); // Реконнект при сбое сети
      }
    });

    peerRef.current = peer;
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Слушаем сигнал от админа об изменении активной зоны
    socket.on('zone-updated', (newZone) => {
      console.log("📍 Обновление зоны:", newZone);
      setZone(newZone);
    });

    return () => { 
      socket.off('connect');
      socket.off('disconnect');
      socket.off('zone-updated');
      if (peerRef.current) peerRef.current.destroy(); 
    };
  }, []);

  // Слежка за местоположением пользователя (только для участников)
  useEffect(() => {
    if (role === 'user' && zone) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          
          // Используем Leaflet для расчета расстояния между точками
          const centerPoint = L.latLng(zone.center[0], zone.center[1]);
          const userPoint = L.latLng(latitude, longitude);
          const distance = centerPoint.distanceTo(userPoint);

          setIsInside(distance <= zone.radius);
        },
        (err) => console.error("Geo Watch Error:", err),
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [role, zone]);

  const handleJoin = (selectedRole: 'admin' | 'user', name: string) => {
    setRole(selectedRole);
    setUserName(name);
    socket.emit('join', { name, role: selectedRole });
    // Даем небольшую паузу перед запуском PeerJS
    setTimeout(startPeer, 500);
  };

  if (!role) return <RoleSelection onSelect={handleJoin} />;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500/30">
      {/* Рендерим интерфейс только после того, как Voice ID получен */}
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
            isInside={isInside}
          />
        )
      ) : (
        <div className="flex h-screen items-center justify-center flex-col gap-6 bg-slate-950">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-indigo-400 font-black uppercase tracking-[0.3em] text-[10px] mb-2">
              Establishing Secure Line
            </p>
            <p className="text-slate-500 text-xs animate-pulse italic">
              Подключение к голосовому серверу...
            </p>
          </div>
        </div>
      )}
      
      {/* Индикаторы состояния (Connection HUD) */}
      <div className="fixed bottom-6 left-6 flex gap-4 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 text-[9px] font-bold tracking-widest uppercase z-[9999] shadow-2xl">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${peerId ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-yellow-500"}`}></span>
          <span className="opacity-70">Voice</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"}`}></span>
          <span className="opacity-70">Signal</span>
        </div>
        {role === 'user' && zone && (
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <span className={`w-1.5 h-1.5 rounded-full ${isInside ? "bg-indigo-500 shadow-[0_0_8px_#6366f1]" : "bg-red-500"}`}></span>
            <span className="opacity-70">{isInside ? "In Zone" : "Out of Range"}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;