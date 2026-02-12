import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import * as turf from '@turf/turf';

import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

// ВАЖНО: Вставь сюда ссылку, которую выдаст Railway после нажатия "Сгенерировать домен"
const SERVER_URL = 'https://твоя-ссылка-из-railway.up.railway.app';
const socket: Socket = io(SERVER_URL);

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [zone, setZone] = useState<any>(null);
  const [myCoords, setMyCoords] = useState<[number, number] | null>(null);
  const [isInside, setIsInside] = useState(false);

  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    // Настройка PeerJS для работы в облаке (HTTPS)
    const newPeer = new Peer({
      host: '/',
      secure: true,
      port: 443
    });

    newPeer.on('open', (id) => {
      console.log('Мой Peer ID:', id);
      setPeerId(id);
    });

    peerRef.current = newPeer;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyCoords([latitude, longitude]);
        if (userName) {
          socket.emit('update-coords', { lat: latitude, lng: longitude, name: userName });
        }
      },
      (err) => console.error("Ошибка GPS:", err),
      { enableHighAccuracy: true }
    );

    socket.on('zone-updated', (newZone) => {
      setZone(newZone);
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off('zone-updated');
      newPeer.destroy();
    };
  }, [userName]);

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
      
      <div className="fixed bottom-2 right-2 text-[10px] text-slate-500 bg-black/20 p-1 rounded">
        GPS: {myCoords ? `${myCoords[0].toFixed(4)}, ${myCoords[1].toFixed(4)}` : 'Поиск...'} | 
        ID: {peerId.slice(0,5)} | Статус: {socket.connected ? '🌐' : '❌'}
      </div>
    </div>
  );
};

export default App;