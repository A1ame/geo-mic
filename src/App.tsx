import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import * as turf from '@turf/turf';

// Импорт твоих новых компонентов
import AdminView from './components/AdminView';
import ParticipantView from './components/ParticipantView';
import RoleSelection from './components/RoleSelection';

// Подключение к серверу сигнализации (Socket.io)
// Если запускаешь сервер на том же компе, используй порт 3001
const socket: Socket = io('http://localhost:3001');

const App: React.FC = () => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [userName, setUserName] = useState('');
  const [peerId, setPeerId] = useState<string>('');
  const [zone, setZone] = useState<any>(null);
  const [myCoords, setMyCoords] = useState<[number, number] | null>(null);
  const [isInside, setIsInside] = useState(false);

  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    // 1. Инициализация PeerJS для передачи голоса
    const newPeer = new Peer();
    newPeer.on('open', (id) => {
      console.log('Мой Peer ID:', id);
      setPeerId(id);
    });
    peerRef.current = newPeer;

    // 2. Слежение за геопозицией в реальном времени
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyCoords([latitude, longitude]);
        // Отправляем свои координаты на сервер (для админа)
        socket.emit('update-coords', { lat: latitude, lng: longitude, name: userName });
      },
      (err) => console.error("Ошибка GPS:", err),
      { enableHighAccuracy: true }
    );

    // 3. Слушаем обновления зоны от админа
    socket.on('zone-updated', (newZone) => {
      setZone(newZone);
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.off('zone-updated');
      newPeer.destroy();
    };
  }, [userName]);

  // 4. Логика проверки: находится ли пользователь в круге (Turf.js)
  useEffect(() => {
    if (myCoords && zone && zone.center) {
      const userPoint = turf.point([myCoords[1], myCoords[0]]); // [lng, lat]
      const centerPoint = turf.point([zone.center.lng, zone.center.lat]);
      const distance = turf.distance(userPoint, centerPoint, { units: 'meters' });
      
      setIsInside(distance <= zone.radius);
    }
  }, [myCoords, zone]);

  // Если роль еще не выбрана — показываем экран выбора
  if (!role) {
    return (
      <RoleSelection 
        onSelect={(selectedRole, name) => {
          setRole(selectedRole);
          setUserName(name);
          // Сообщаем серверу, что зашел новый пользователь
          socket.emit('join', { name, role: selectedRole });
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {role === 'admin' ? (
        <AdminView 
          socket={socket} 
          peer={peerRef.current!} 
        />
      ) : (
        <ParticipantView 
          socket={socket} 
          peer={peerRef.current!} 
          isInside={isInside} 
          userName={userName}
        />
      )}
      
      {/* Индикатор отладки в углу (потом можно убрать) */}
      <div className="fixed bottom-2 right-2 text-[10px] text-slate-500 bg-black/20 p-1 rounded">
        GPS: {myCoords ? `${myCoords[0].toFixed(4)}, ${myCoords[1].toFixed(4)}` : 'Поиск...'} | 
        ID: {peerId.slice(0,5)}
      </div>
    </div>
  );
};

export default App;