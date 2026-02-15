import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// СТРОГО В ТАКОМ ПОРЯДКЕ: сначала JS, потом CSS
import 'leaflet/dist/leaflet.css';

// Импорт иконок напрямую для Vite/Webpack
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
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));
    
    if (!socket || !peer) return;

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role !== 'admin'));
    });

    peer.on('call', (call: any) => {
      call.answer();
      call.on('stream', (stream: MediaStream) => {
        if (audioRef.current) { audioRef.current.srcObject = stream; audioRef.current.play(); }
      });
    });

    return () => { socket.off('participants-list'); peer.off('call'); };
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
      <header className="px-8 py-6 bg-slate-900/50 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center"><Mic size={20} /></div>
          <div><h2 className="text-lg font-black uppercase tracking-tighter">Admin Panel</h2><p className="text-[10px] text-slate-500 uppercase">{adminName}</p></div>
        </div>
        <button onClick={onExit} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"><LogOut size={20} /></button>
      </header>

      <div className="relative h-1/2 border-b border-white/5">
        <MapContainer center={coords || [0,0]} zoom={17} className="h-full w-full grayscale">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {coords && (
            <>
              <Marker position={coords}><Tooltip permanent direction="top">Вы (Админ)</Tooltip></Marker>
              <Circle center={coords} radius={radius} pathOptions={{ color: isEventStarted ? '#6366f1' : '#475569' }} />
            </>
          )}
          {participants.map(p => p.coords && (
            <Marker key={p.socketId} position={p.coords}>
              <Tooltip permanent direction="bottom">
                <span className="font-bold">{p.name}</span> {p.handRaised ? '✋' : ''}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute inset-x-0 bottom-6 flex justify-center z-[1000] px-6">
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/10 w-full max-w-md">
            {!isEventStarted ? (
              <>
                <div className="flex justify-between mb-4"><span className="text-[10px] uppercase font-black text-slate-500">Радиус</span><span className="text-indigo-400 font-bold">{radius}м</span></div>
                <input type="range" min="10" max="500" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full mb-6 accent-indigo-500" />
                <button onClick={handleStart} className="w-full py-4 bg-white text-black font-black uppercase rounded-2xl shadow-xl">Начать событие</button>
              </>
            ) : (
              <button onClick={handleStop} className="w-full py-4 bg-red-600 text-white font-black uppercase rounded-2xl shadow-xl">Завершить событие</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-black uppercase text-slate-500">Участники</h3><div className="flex gap-2 text-xs font-bold text-slate-400"><Users size={14}/> {participants.length}</div></div>
        <div className="grid gap-3">
          {participants.sort((a,b) => (a.handRaised ? -1 : 1)).map(p => (
            <div key={p.socketId} className={`flex items-center justify-between p-5 rounded-3xl border ${p.handRaised ? 'bg-indigo-500/10 border-indigo-500' : 'bg-white/5 border-white/5'}`}>
              <div><span className="font-bold text-slate-200">{p.name}</span>{p.isOnAir && <span className="ml-3 text-[10px] text-red-500 font-black uppercase animate-pulse">On Air</span>}</div>
              <button 
                onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id, socketId: p.socketId })}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${p.isOnAir ? 'bg-red-600' : 'bg-indigo-600'}`}
              >
                {p.isOnAir ? 'Mute' : 'Mic'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminView;