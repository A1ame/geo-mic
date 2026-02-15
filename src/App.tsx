import L from 'leaflet';
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import 'leaflet/dist/leaflet.css';

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
  const [role, setRole] = useState<'admin' | 'user' | null>(() => (localStorage.getItem('userRole') as any) || null);
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
  const [adminData, setAdminData] = useState({ name: '', peerId: '' });
  
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [zone, setZone] = useState<{center: [number, number], radius: number} | null>(null);
  const [isInside, setIsInside] = useState(true);

  const peerRef = useRef<any>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `.leaflet-container { height: 100% !important; width: 100% !important; background: #020617 !important; }`;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!role || !userName || peerRef.current) return;

    const initPeer = () => {
      const p = new Peer(undefined, {
        host: 'geo-mic-production-2da6.up.railway.app',
        port: 443,
        path: '/peerjs',
        secure: true
      });

      p.on('open', (id: string) => {
        setPeerId(id);
        navigator.geolocation.getCurrentPosition((pos) => {
          socket.emit('join', { role, name: userName, peerId: id, coords: [pos.coords.latitude, pos.coords.longitude] });
        }, () => {
          socket.emit('join', { role, name: userName, peerId: id });
        });
      });

      p.on('error', () => setTimeout(initPeer, 5000));
      peerRef.current = p;
    };

    initPeer();
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [role, userName]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('zone-updated', (newZone) => {
      setZone(newZone);
      if (newZone) checkPosition(newZone);
    });
    // Получаем инфо об админе
    socket.on('admin-updated', (data) => setAdminData(data));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('zone-updated');
      socket.off('admin-updated');
    };
  }, []);

  const checkPosition = (targetZone: any) => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const dist = Math.sqrt(
        Math.pow(pos.coords.latitude - targetZone.center[0], 2) + 
        Math.pow(pos.coords.longitude - targetZone.center[1], 2)
      ) * 111320;
      setIsInside(dist <= targetZone.radius);
      socket.emit('update-coords', { coords: [pos.coords.latitude, pos.coords.longitude] });
    }, null, { enableHighAccuracy: true });
  };

  useEffect(() => {
    if (!zone) return;
    const interval = setInterval(() => checkPosition(zone), 5000);
    return () => clearInterval(interval);
  }, [zone]);

  const handleRoleSelect = (selectedRole: 'admin' | 'user', name: string) => {
    localStorage.setItem('userRole', selectedRole);
    localStorage.setItem('userName', name);
    setRole(selectedRole);
    setUserName(name);
  };

  const handleExit = () => {
    localStorage.clear();
    socket.emit('leave');
    window.location.reload();
  };

  if (!role) return <RoleSelection onSelect={handleRoleSelect} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {role === 'admin' ? (
        <AdminView socket={socket} peer={peerRef.current} adminName={userName} onExit={handleExit} />
      ) : (
        <ParticipantView 
          socket={socket} 
          peer={peerRef.current} 
          isInside={isInside} 
          userName={userName} 
          adminData={adminData} // Передаем инфо об админе
          onExit={handleExit} 
        />
      )}
      <div className="fixed bottom-6 left-6 flex gap-4 px-4 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 text-[9px] font-black uppercase z-[9999]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${peerId ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}></span>
          <span>Voice</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></span>
          <span>Signal</span>
        </div>
      </div>
    </div>
  );
};

export default App;