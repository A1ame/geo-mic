import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Users, LogOut, Check, X, UserPlus } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));
    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));
    return () => { socket.off('participants-list'); socket.off('new-request'); };
  }, [socket]);

  const startEvent = () => {
    if (!coords) return;
    const zone = { center: coords, radius };
    socket.emit('set-zone', zone);
    setIsEventStarted(true);
    localStorage.setItem('isStarted', 'true');
  };

  return (
    <div className="flex h-screen bg-slate-950 relative">
      {/* ЛОББИ ЗАЯВОК (Слева сверху) */}
      <div className="absolute top-6 left-6 z-[1001] w-72 space-y-3">
        {requests.length > 0 && (
            <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-3xl p-4 shadow-2xl animate-in slide-in-from-left-4">
                <div className="flex items-center gap-2 mb-4 text-indigo-400 font-black uppercase text-[10px] tracking-widest">
                    <UserPlus size={14}/> Запросы на вход
                </div>
                <div className="space-y-2">
                    {requests.map(req => (
                        <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                            <span className="font-bold text-xs text-white">{req.name}</span>
                            <div className="flex gap-1">
                                <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-xl hover:scale-105 transition-all"><Check size={14} color="white"/></button>
                                <button className="p-2 bg-white/5 rounded-xl hover:bg-red-500 transition-all"><X size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="w-1/3 border-r border-white/5 flex flex-col">
        <div className="p-8 bg-slate-900/50">
          <h2 className="text-4xl font-black italic uppercase text-white mb-2">Админ</h2>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8">{adminName}</p>
          <div className="space-y-6">
            {!isEventStarted ? (
              <button onClick={startEvent} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase rounded-2xl shadow-xl transition-all">Начать событие</button>
            ) : (
              <button onClick={() => { socket.emit('stop-event'); setIsEventStarted(false); localStorage.removeItem('isStarted'); }} className="w-full py-5 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl">Завершить</button>
            )}
            <button onClick={onExit} className="w-full py-3 text-slate-500 font-black uppercase text-[10px] flex items-center justify-center gap-2"><LogOut size={14}/> Выйти</button>
          </div>
        </div>

        <div className="flex-grow p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">В зоне ({participants.length})</h3>
          </div>
          <div className="grid gap-3">
            {participants.sort((a,b) => (a.handRaised ? -1 : 1)).map(p => (
              <div key={p.socketId} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${p.handRaised ? 'bg-indigo-500/10 border-indigo-500/50 animate-pulse' : 'bg-white/5 border-white/5'}`}>
                <span className="font-bold text-slate-200">{p.name}</span>
                <button 
                  onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${p.isOnAir ? 'bg-red-600 shadow-lg shadow-red-900/20' : 'bg-indigo-600 shadow-lg shadow-indigo-900/20'}`}
                >
                  {p.isOnAir ? 'Mute' : 'Mic'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow relative bg-slate-900">
        {coords && (
          <MapContainer center={coords} zoom={16} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }} />
            <Marker position={coords}><Tooltip permanent direction="top">Вы здесь</Tooltip></Marker>
            {participants.map(p => p.coords && <Marker key={p.socketId} position={p.coords} icon={L.divIcon({ className: 'custom-div-icon', html: `<div style="background-color: ${p.isOnAir ? '#ef4444' : '#6366f1'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>` })} />)}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;