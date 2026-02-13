import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import * as turf from '@turf/turf';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

const SERVER_URL = 'https://geo-mic-production-2da6.up.railway.app';

const socket: Socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true
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
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('zone-updated', (newZone) => setZone(newZone));

    // Генерируем случайный ID, чтобы избежать конфликтов с текстом ответа сервера
    const randomId = 'user-' + Math.random().toString(36).substr(2, 9);

    const newPeer = new Peer(randomId, {
      host: 'geo-mic-production-2da6.up.railway.app',
      port: 443,
      path: '/peerjs',
      secure: true,
      debug: 3,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      }
    });

    newPeer.on('open', (id) => {
      console.log('✅ Peer подключен успешно. ID:', id);
      setPeerId(id);
    });

    newPeer.on('error', (err) => {
      console.error('❌ PeerJS Error:', err.type, err);
    });

    peerRef.current = newPeer;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('zone-updated');
      newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (myCoords && zone && zone.center) {
      const userPoint = turf.point([myCoords[1], myCoords[0]]); 
      const centerPoint = turf.point([zone.center.lng, zone.center.lat]);
      const distance = turf.distance(userPoint, centerPoint, { units: 'meters' });
      setIsInside(distance <= zone.radius);
    }
  }, [myCoords, zone]);

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
    <div className="min-h-screen bg-slate-900 text-white font-sans">
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
      
      {/* Статус-панель */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2">
        <div className="px-3 py-2 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-[10px] shadow-2xl flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className={myCoords ? "text-green-500" : "text-yellow-500"}>●</span> GPS
          </div>
          <div className="flex items-center gap-1">
            <span className={peerId ? "text-green-500" : "text-red-500"}>●</span> PEER
          </div>
          <div className="flex items-center gap-1">
            <span className={isConnected ? "text-green-500" : "text-red-500"}>●</span> SERVER
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;