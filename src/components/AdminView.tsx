import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Users, Check, X, UserPlus, Settings2, LogOut, Mic } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));
    
    // Обработка входящего звука от участника
    if (peer) {
      peer.on('call', (call: any) => {
        call.answer(); // Админ просто слушает
        call.on('stream', (remoteStream: MediaStream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.play();
          }
        });
      });
    }

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));
    
    return () => { socket.off('participants-list'); socket.off('new-request'); };
  }, [socket, peer]);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Скрытый элемент для звука */}
      <audio ref={audioRef} autoPlay />

      {/* 1. ЛЕВАЯ ПАНЕЛЬ (450px - Увеличенная) */}
      <div className="w-[450px] border-r border-white/5 flex flex-col bg-slate-900/50 backdrop-blur-xl z-20">
        <div className="p-8 border-b border-white/5">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Geo-Mic <span className="text-indigo-500">Pro</span></h2>
            <button onClick={onExit} className="p-2 text-slate-500 hover:text-white transition-colors"><LogOut size={20}/></button>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2"><Settings2 size={14}/> Зона покрытия</span>
                <span className="text-indigo-400 font-bold">{radius} метров</span>
              </div>
              <input type="range" min="50" max="1500" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>

            <button onClick={() => { setIsEventStarted(!isEventStarted); socket.emit(isEventStarted ? 'stop-event' : 'set-zone', { center: coords, radius }); }} 
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-2xl ${isEventStarted ? 'bg-red-600 shadow-red-900/20' : 'bg-indigo-600 shadow-indigo-900/20 hover:scale-[1.02]'}`}>
              {isEventStarted ? 'Остановить трансляцию' : 'Запустить эфир'}
            </button>
          </div>
        </div>

        {/* Список участников */}
        <div className="flex-grow p-8 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Участники в зоне ({participants.length})</h3>
            {isEventStarted && <div className="flex items-center gap-2 text-red-500 text-[10px] font-black animate-pulse"><Radio size={12}/> LIVE</div>}
          </div>
          
          <div className="space-y-3">
            {participants.map(p => (
              <div key={p.socketId} className={`p-5 rounded-3xl border transition-all flex items-center justify-between ${p.handRaised ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-white/5 border-white/5'}`}>
                <div className="flex flex-col">
                  <span className="font-bold text-white leading-none mb-1">{p.name}</span>
                  {p.isOnAir && <span className="text-[9px] font-black uppercase text-red-500">Говорит...</span>}
                </div>
                <button onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase ${p.isOnAir ? 'bg-red-500 shadow-lg shadow-red-900/40' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                  {p.isOnAir ? 'Mute' : (p.handRaised ? 'Дать слово' : 'Микрофон')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. ПАНЕЛЬ ЗАЯВОК (Плавающая справа) */}
      {requests.length > 0 && (
        <div className="fixed top-8 right-8 w-80 z-[1000] animate-in slide-in-from-right-8 duration-500">
          <div className="bg-slate-900/90 backdrop-blur-2xl border-2 border-indigo-500/30 rounded-[2.5rem] p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/40"><UserPlus size={20} className="text-white"/></div>
              <div>
                <h4 className="text-white font-black uppercase text-xs tracking-tighter">Новые заявки</h4>
                <p className="text-indigo-400 text-[10px] font-bold uppercase">{requests.length} в очереди</p>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {requests.map(req => (
                <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 group">
                  <span className="font-bold text-sm text-white truncate max-w-[120px]">{req.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2.5 bg-green-500 rounded-xl hover:scale-110 transition-all"><Check size={16} color="white"/></button>
                    <button className="p-2.5 bg-white/10 rounded-xl hover:bg-red-500 transition-all"><X size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. КАРТА (Оставшееся место) */}
      <div className="flex-grow relative">
        {coords && (
          <MapContainer center={coords} zoom={15} className="h-full w-full grayscale-[0.3] brightness-[0.7]">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', weight: 2, fillOpacity: 0.1 }} />
            <Marker position={coords} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;