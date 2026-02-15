import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Users, Check, X, LogOut, Mic, Settings2 } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(() => Number(localStorage.getItem('adminRadius')) || 100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCoords(newCoords);
      if (isEventStarted) socket.emit('set-zone', { center: newCoords, radius });
    });

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));

    if (peer) {
      peer.on('call', (call: any) => {
        call.answer();
        call.on('stream', (stream: MediaStream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(console.error);
          }
        });
      });
    }

    return () => { socket.off('participants-list'); socket.off('new-request'); };
  }, [socket, peer]);

  // Следим за изменением радиуса
  useEffect(() => {
    if (isEventStarted && coords) {
      socket.emit('set-zone', { center: coords, radius });
      localStorage.setItem('adminRadius', radius.toString());
    }
  }, [radius, isEventStarted]);

  const toggleEvent = () => {
    if (isEventStarted) {
      socket.emit('stop-event');
      localStorage.removeItem('isStarted');
      setIsEventStarted(false);
    } else {
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });
      if (coords) socket.emit('set-zone', { center: coords, radius });
      localStorage.setItem('isStarted', 'true');
      setIsEventStarted(true);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden">
      <audio ref={audioRef} className="hidden" />
      <div className="w-96 bg-slate-900 border-r border-white/10 flex flex-col z-[1000]">
        <div className="p-8 border-b border-white/10">
          <h2 className="text-xl font-black uppercase italic tracking-tighter mb-6 flex items-center gap-2">
            <Radio className="text-indigo-500"/> Geo-Mic Admin
          </h2>
          <button onClick={toggleEvent} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${isEventStarted ? 'bg-red-600 shadow-lg shadow-red-500/20' : 'bg-indigo-600'}`}>
            {isEventStarted ? 'Остановить' : 'Запустить'}
          </button>
        </div>

        {/* НАСТРОЙКА РАДИУСА */}
        <div className="p-6 bg-white/5 border-b border-white/10">
            <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase text-slate-400">Радиус: {radius}м</span>
                <Settings2 size={14} className="text-indigo-400" />
            </div>
            <input 
                type="range" min="50" max="1000" step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {requests.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase text-indigo-400 mb-3">Запросы на вход</p>
              {requests.map(req => (
                <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 mb-2">
                  <span className="font-bold text-sm">{req.name}</span>
                  <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-lg"><Check size={14}/></button>
                </div>
              ))}
            </div>
          )}
          
          <div>
            <p className="text-[9px] font-black uppercase text-slate-500 mb-3">Участники ({participants.length})</p>
            {participants.map(p => (
              <div key={p.socketId} className={`p-4 rounded-2xl border mb-2 transition-all ${p.handRaised ? 'bg-indigo-500/10 border-indigo-500 animate-pulse' : 'bg-white/5 border-white/5'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold">{p.name} {p.isOnAir && '🎙️'}</span>
                  <button onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${p.isOnAir ? 'bg-red-500' : 'bg-indigo-600'}`}>
                    {p.isOnAir ? 'Mute' : 'Mic'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-white/5">
            <button onClick={onExit} className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2"><LogOut size={14}/> Выйти</button>
        </div>
      </div>

      <div className="flex-grow relative">
        {coords && (
          <MapContainer center={coords} zoom={15} className="h-full w-full grayscale-[0.3]">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }} />
            <Marker position={coords}><Tooltip permanent direction="top">Зона вещания</Tooltip></Marker>
            {participants.map(p => p.coords && (
                <Marker key={p.socketId} position={p.coords} icon={L.divIcon({className: 'bg-indigo-500 w-3 h-3 rounded-full border-2 border-white shadow-lg'})} />
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;