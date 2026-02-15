import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Users, LogOut, Check, X, UserPlus, Settings2 } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const newCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCoords(newCoords);
      if (isEventStarted) {
        socket.emit('set-zone', { center: newCoords, radius });
      }
    });

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));
    
    return () => { socket.off('participants-list'); socket.off('new-request'); };
  }, [socket, isEventStarted, radius]);

  const toggleEvent = () => {
    if (!isEventStarted) {
      socket.emit('set-zone', { center: coords, radius });
      setIsEventStarted(true);
      localStorage.setItem('isStarted', 'true');
    } else {
      socket.emit('stop-event');
      setIsEventStarted(false);
      localStorage.removeItem('isStarted');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 relative overflow-hidden">
      {/* ОКНО ПРИНЯТИЯ (СВЕРХУ СЛЕВА) */}
      <div className="absolute top-6 left-6 z-[9999] w-72 pointer-events-none">
        {requests.length > 0 && (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 rounded-3xl p-4 shadow-2xl pointer-events-auto animate-in slide-in-from-left-4">
            <div className="flex items-center gap-2 mb-3 text-indigo-400 font-black uppercase text-[10px] tracking-widest">
              <UserPlus size={14}/> Запросы ({requests.length})
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {requests.map(req => (
                <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5">
                  <span className="font-bold text-xs text-white truncate max-w-[120px]">{req.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-lg hover:scale-105 transition-all"><Check size={12} color="white"/></button>
                    <button className="p-2 bg-white/5 rounded-lg hover:bg-red-500 transition-all"><X size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* БОКОВАЯ ПАНЕЛЬ */}
      <div className="w-80 border-r border-white/5 flex flex-col z-[1000] bg-slate-950/80 backdrop-blur-md">
        <div className="p-6">
          <h2 className="text-2xl font-black italic uppercase text-white mb-6">Панель</h2>
          
          <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-3">
               <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2"><Settings2 size={12}/> Радиус</span>
               <span className="text-indigo-400 font-bold text-xs">{radius}м</span>
            </div>
            <input 
              type="range" min="50" max="1000" step="50" 
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <button 
            onClick={toggleEvent} 
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs transition-all ${isEventStarted ? 'bg-red-600' : 'bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}
          >
            {isEventStarted ? 'Завершить' : 'Начать событие'}
          </button>
          
          <button onClick={onExit} className="w-full mt-4 text-slate-600 font-bold text-[10px] uppercase tracking-widest">Выйти</button>
        </div>

        <div className="flex-grow p-6 overflow-y-auto border-t border-white/5">
          <h3 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">В зоне ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.socketId} className={`p-3 rounded-2xl border flex items-center justify-between ${p.handRaised ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5'}`}>
                <span className="text-xs font-bold text-white">{p.name}</span>
                <button 
                  onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${p.isOnAir ? 'bg-red-500' : 'bg-indigo-600'}`}
                >
                  {p.isOnAir ? 'Mute' : 'Mic'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow">
        {coords && (
          <MapContainer center={coords} zoom={16} className="h-full w-full">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1' }} />
            <Marker position={coords}><Tooltip permanent direction="top">Админ</Tooltip></Marker>
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;