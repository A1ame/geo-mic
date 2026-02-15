import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

// Указываем TS, что Peer доступен глобально (если подключаете через CDN в index.html)
declare const Peer: any;

const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

// Инициализация сокета
const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true
});

const App: React.FC = () => {
  // Загружаем данные из localStorage, чтобы не вылетало при перезагрузке
  const [role, setRole] = useState<'admin' | 'user' | null>(() => {
    return (localStorage.getItem('userRole') as 'admin' | 'user') || null;
  });
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('userName') || '';
  });

  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [zone, setZone] = useState<{center: [number, number], radius: number} | null>(null);
  const [isInside, setIsInside] = useState(false);

  const peerRef = useRef<any>(null);

  // 1. Инициализация PeerJS
  useEffect(() => {
    if (!role || !userName || peerRef.current) return;

    const initPeer = () => {
      // Пытаемся создать Peer с фиксированным ID на основе имени (опционально) или случайным
      const p = new Peer(undefined, {
        host: 'geo-mic-production-2da6.up.railway.app', // Ваш хост
        port: 443,
        path: '/peerjs',
        secure: true,
        debug: 1
      });

      p.on('open', (id: string) => {
        console.log('My Peer ID:', id);
        setPeerId(id);
        // Как только получили ID, заходим в комнату
        socket.emit('join', { role, name: userName, peerId: id });
      });

      p.on('error', (err: any) => {
        console.error('Peer error:', err);
        if (err.type === 'network') setTimeout(initPeer, 5000); // Реконнект при ошибке сети
      });

      peerRef.current = p;
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [role, userName]);

  // 2. Обработка событий сокета
  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('zone-updated', (newZone) => {
      setZone(newZone);
      if (!newZone && role === 'user') {
        // Если админ завершил событие, сбрасываем состояние участника
        localStorage.removeItem('pStatus');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('zone-updated');
    };
  }, [role]);

  // 3. Гео-логика и проверка дистанции
  useEffect(() => {
    if (!zone) return;

    const checkDistance = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          
          // Простая формула Гаверсинуса или аппроксимация для дистанции в метрах
          const R = 6371e3; // радиус Земли в метрах
          const φ1 = latitude * Math.PI / 180;
          const φ2 = zone.center[0] * Math.PI / 180;
          const Δφ = (zone.center[0] - latitude) * Math.PI / 180;
          const Δλ = (zone.center[1] - longitude) * Math.PI / 180;

          const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          const inside = distance <= zone.radius;
          setIsInside(inside);

          // Отправляем координаты админу для отображения на карте
          socket.emit('update-coords', { coords: [latitude, longitude] });
        },
        (err) => console.error("Geo error:", err),
        { enableHighAccuracy: true }
      );
    };

    checkDistance();
    const interval = setInterval(checkDistance, 5000); // Проверка каждые 5 сек

    return () => clearInterval(interval);
  }, [zone]);

  // 4. Обработчик выбора роли
  const handleRoleSelect = (selectedRole: 'admin' | 'user', name: string) => {
    localStorage.setItem('userRole', selectedRole);
    localStorage.setItem('userName', name);
    setRole(selectedRole);
    setUserName(name);
  };

  // 5. Полный выход
  const handleExit = () => {
    localStorage.clear();
    socket.emit('leave');
    window.location.reload();
  };

  if (!role) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {role === 'admin' ? (
        <AdminView 
          socket={socket} 
          peer={peerRef.current} 
          adminName={userName} 
          onExit={handleExit}
        />
      ) : (
        <ParticipantView 
          socket={socket} 
          peer={peerRef.current} 
          isInside={isInside} 
          userName={userName}
          onExit={handleExit}
        />
      )}

      {/* Connection HUD - Индикаторы состояния */}
      <div className="fixed bottom-6 left-6 flex gap-4 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 text-[9px] font-bold tracking-widest uppercase z-[9999] shadow-2xl">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${peerId ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-yellow-500 animate-pulse"}`}></span>
          <span className="opacity-70">Voice (Peer)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500 animate-pulse"}`}></span>
          <span className="opacity-70">Signal (Socket)</span>
        </div>
        {role === 'user' && zone && (
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <span className={`w-1.5 h-1.5 rounded-full ${isInside ? "bg-indigo-500" : "bg-red-500"}`}></span>
            <span className="opacity-70">{isInside ? "Inside Zone" : "Outside Zone"}</span>
          </div>
        )}
      </div>

      {/* Overlay загрузки, если Peer еще не готов */}
      {(!peerId || !isConnected) && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[10000] flex items-center justify-center">
           <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px]">Establishing Secure Line...</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;