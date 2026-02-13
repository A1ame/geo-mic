import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import * as turf from '@turf/turf';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

// Константы подключения
const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

// Инициализация сокета с поддержкой credentials
const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true,
  reconnectionAttempts: 10
});

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [zone, setZone] = useState<any>(null);
  const [myCoords, setMyCoords] = useState<[number, number] | null>(null);
  const [isInside, setIsInside] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    // Слушатели статуса сокета
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('zone-updated', (newZone) => setZone(newZone));

    /**
     * Инициализация PeerJS.
     * Передаем пустую строку вместо undefined, чтобы избежать TypeError.
     * Настройки хоста соответствуют твоему Railway.
     */
    const newPeer = new Peer('', {
      host: 'geo-mic-production-2da6.up.railway.app',
      port: 443,
      path: '/peerjs',
      secure: true,
      debug: 3, // Включаем подробные логи в консоли для отладки
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    newPeer.on('open', (id) => {
      console.log('✅ Peer ID успешно получен:', id);
      setPeerId(id);
    });

    newPeer.on('error', (err) => {
      console.error('❌ PeerJS Error:', err.type, err);
    });

    peerRef.current = newPeer;

    // Отслеживание геолокации
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMyCoords([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Очистка при размонтировании
    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off('zone-updated');
      socket.off('connect');
      socket.off('disconnect');
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // Расчет вхождения в гео-зону
  useEffect(() => {
    if (myCoords && zone && zone.center) {
      const userPoint = turf.point([myCoords[1], myCoords[0]]); 
      const centerPoint = turf.point([zone.center.lng, zone.center.lat]);
      const distance = turf.distance(userPoint, centerPoint, { units: 'meters' });
      setIsInside(distance <= zone.radius);
    }
  }, [myCoords, zone]);

  // Экран выбора роли
  if (!role) {
    return (
      <RoleSelection 
        onSelect={(selectedRole, name) => {
          setRole(selectedRole);
          setUserName(name);
          socket.emit('join', { name, role: selectedRole });
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-indigo-500/30">
      {role === 'admin' ? (
        <AdminView socket={socket} peer={peerRef.current!} />
      ) : (
        <ParticipantView 
          socket={socket} 
          peer={peerRef.current!} 
          isInside={isInside} 
          userName={userName}
        />
      )}
      
      {/* Панель индикаторов состояния */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[11px] shadow-2xl">
          <div className="flex items-center gap-1.5">
            <span className={myCoords ? "text-green-400" : "text-yellow-400"}>
              {myCoords ? '●' : '○'}
            </span>
            <span>GPS</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className={peerId ? "text-green-400" : "text-red-400"}>
              {peerId ? '●' : '●'}
            </span>
            <span>PEER</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className={isConnected ? "text-green-400" : "text-red-400"}>
              {isConnected ? '🌐 ONLINE' : '❌ OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;