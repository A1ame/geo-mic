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
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Настройка PeerJS с использованием STUN-серверов Google
    const newPeer = new Peer(undefined as any, {
      host: 'geo-mic-production-2da6.up.railway.app',
      port: 443,
      path: '/peerjs',
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    newPeer.on('open', (id) => {
      console.log('Peer подключен успешно. ID:', id);
      setPeerId(id);
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS Error:', err.type, err);
    });

    peerRef.current = newPeer;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error("GPS Error:", err),
      { enableHighAccuracy: true }
    );

    socket.on('zone-updated', (newZone) => setZone(newZone));

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off('zone-updated');
      socket.off('connect');
      socket.off('disconnect');
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
      
      <div className="fixed bottom-2 right-2 flex gap-2 text-[10px] text-slate-500 bg-black/60 p-2 rounded backdrop-blur-sm border border-white/10">
        <div>GPS: {myCoords ? '🟢' : '🔍'}</div>
        <div>Peer: {peerId ? '🟢' : '🔴'}</div>
        <div>Srv: {isConnected ? '🌐 Online' : '❌ Offline'}</div>
      </div>
    </div>
  );
};

export default App;