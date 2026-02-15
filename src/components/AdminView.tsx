import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// СТРОГО В ТАКОМ ПОРЯДКЕ
import 'leaflet/dist/leaflet.css';

// Импорт иконок напрямую для Vite (исправляет проблему пустых маркеров)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { Radio, Mic, Users, Settings2, LogOut } from 'lucide-react';

// Фикс проблемы с иконками Leaflet
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('isStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error("Ошибка геопозиции:", err),
      { enableHighAccuracy: true }
    );
    
    if (!socket || !peer) return;

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role !== 'admin'));
    });

    peer.on('call', (call: any) => {
      call.answer();
      call.on('stream', (stream: MediaStream) => {
        if (audioRef.current) { 
          audioRef.current.srcObject = stream; 
          audioRef.current.play(); 
        }
      });
    });

    return () => { 
      socket.off('participants-list'); 
      peer.off('call'); 
    };
  }, [socket, peer]);

  const handleStart = () => {
    socket.emit('set-zone', { center: coords, radius });
    setIsEventStarted(true);
    localStorage.setItem('isStarted', 'true');
  };

  const handleStop = () => {
    socket.emit('stop-event');
    setIsEventStarted(false);
    localStorage.removeItem('isStarted');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} autoPlay className="hidden" />
      
      <header className="px-8 py-6 bg-slate-900/50 flex justify-between items-center border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center"><Mic size={20} /></div>
          <div><h2 className="text-lg font-black uppercase tracking-tighter leading-none mb-1">Admin Panel</h2><p className="text-[10px] text-slate-500 uppercase font-bold">{adminName}</p></div>
        </div>
        <button onClick={onExit} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"><LogOut size={20} /></button>
      </header>

      {/* Контейнер карты с явной высотой */}
      <div className="relative flex-grow min-h-[40vh] border-b border-white/5 z-10">
        {coords ? (
          <MapContainer 
            center={coords} 
            zoom={17} 
            style={{ height: '100%', width: '100%' }} // Важно: высота 100%
            className="grayscale-[0.5]"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={coords}>
              <Tooltip permanent direction="top">Вы (Админ)</Tooltip>
            </Marker>
            <Circle center={coords} radius={radius} pathOptions={{ color: isEventStarted ? '#6366f1' : '#475569', fillOpacity: 0.1 }} />
            
            {participants.map(p => p.coords && (
              <Marker key={p.socketId} position={p.coords}>
                <Tooltip permanent direction="bottom">
                  <span className="font-bold">{p.name}</span> {p.handRaised ? '✋' : ''}
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-slate-900 animate-pulse text-[10px] font-black uppercase tracking-widest text-indigo-400">
            Загрузка карты...
          </div>
        )}

        <div className="absolute inset-x-0 bottom-6 flex justify-center z-[1000] px-6">
          <div className="bg-slate-900/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 w-full max-w-md shadow-2xl">
            {!isEventStarted ? (
              <>
                <div className="flex justify-between mb-4"><span className="text-[10px] uppercase font-black text-slate-500 flex items-center gap-2"><Settings2 size={12}/> Радиус зоны</span><span className="text-indigo-400 font-bold">{radius}м</span></div>
                <input type="range" min="10" max="500" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full mb-6 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none" />
                <button onClick={handleStart} className="w-full py-4 bg-white text-black font-black uppercase rounded-2xl shadow-xl hover:scale-[1.02] transition-transform">Начать событие</button>
              </>
            ) : (
              <button onClick={handleStop} className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl shadow-red-900/20 hover:bg-red-500 transition-colors">Завершить событие</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-8 overflow-y-auto bg-slate-950">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Участники в сети</h3>
          <div className="flex gap-2 text-xs font-bold text-slate-400 items-center"><Users size={14}/> {participants.length}</div>
        </div>
        <div className="grid gap-3">
          {participants.sort((a,b) => (a.handRaised ? -1 : 1)).map(p => (
            <div key={p.socketId} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${p.handRaised ? 'bg-indigo-500/10 border-indigo-500/50 animate-pulse' : 'bg-white/5 border-white/5'}`}>
              <div><span className="font-bold text-slate-200 text-lg">{p.name}</span>{p.isOnAir && <span className="ml-3 text-[10px] text-red-500 font-black uppercase border border-red-500/30 px-2 py-0.5 rounded-full">Эфир</span>}</div>
              <button 
                onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${p.isOnAir ? 'bg-red-600 shadow-lg shadow-red-900/20' : 'bg-indigo-600 shadow-lg shadow-indigo-900/20'}`}
              >
                {p.isOnAir ? 'Mute' : (p.handRaised ? 'Дать слово' : 'Mic')}
              </button>
            </div>
          ))}
          {participants.length === 0 && (
            <div className="text-center py-10 text-slate-600 uppercase font-black text-[10px] tracking-widest border-2 border-dashed border-white/5 rounded-3xl">Ожидание подключений...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminView;