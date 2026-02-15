import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Radio, Mic, Users, Settings2, LogOut } from 'lucide-react';

const DefaultIcon = L.Icon.Default;
DefaultIcon.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const AdminView = ({ socket, peer, adminName }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(100);
  const [isEventStarted, setIsEventStarted] = useState(() => localStorage.getItem('eventStarted') === 'true');
  const [participants, setParticipants] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!socket || !peer) return;

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role !== 'admin'));
    });

    socket.on('new-hand-raised', (data: any) => {
      setParticipants(prev => prev.map(p => p.peerId === data.peerId ? { ...p, handRaised: true } : p));
    });

    socket.on('mic-granted', (data: any) => {
      setParticipants(prev => prev.map(p => p.peerId === data.targetPeerId ? { ...p, isOnAir: true, handRaised: false } : p));
    });

    socket.on('mic-revoked', (data: any) => {
      setParticipants(prev => prev.map(p => p.peerId === data.targetPeerId ? { ...p, isOnAir: false } : p));
    });

    peer.on('call', (call: any) => {
      call.answer();
      call.on('stream', (stream: MediaStream) => {
        if (audioRef.current) { audioRef.current.srcObject = stream; audioRef.current.play(); }
      });
    });

    return () => { socket.off('participants-list'); socket.off('new-hand-raised'); };
  }, [socket, peer]);

  const handleStart = () => {
    socket.emit('set-zone', { center: coords, radius });
    setIsEventStarted(true);
    localStorage.setItem('eventStarted', 'true');
  };

  const handleStop = () => {
    socket.emit('stop-event');
    setIsEventStarted(false);
    localStorage.removeItem('eventStarted');
  };

  const sortedList = [...participants].sort((a, b) => (a.handRaised ? -1 : 1));

  if (!coords) return <div className="h-screen bg-slate-950 flex items-center justify-center text-indigo-400 uppercase font-black tracking-widest text-xs animate-pulse">Определение гео...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} autoPlay className="hidden" />
      <header className="px-8 py-6 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex justify-between items-center z-[1001]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><Mic size={20} /></div>
          <div><h2 className="text-lg font-black uppercase tracking-tighter leading-none mb-1">Admin Panel</h2><p className="text-slate-500 text-[10px] font-bold uppercase">{adminName}</p></div>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"><LogOut size={20} /></button>
      </header>

      <div className="relative flex-grow h-1/2 border-b border-white/5">
        <MapContainer center={coords} zoom={17} className="h-full w-full grayscale-[0.6]">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={coords}><Tooltip permanent direction="top" className="bg-indigo-600 border-none text-white font-black uppercase text-[8px]">Вы (Админ)</Tooltip></Marker>
          {participants.map(p => p.coords && (
            <Marker key={p.id} position={p.coords}>
              <Tooltip permanent direction="bottom" className="bg-slate-900 border-none text-white font-bold text-[8px] uppercase">{p.name}</Tooltip>
            </Marker>
          ))}
          <Circle center={coords} radius={radius} pathOptions={{ color: isEventStarted ? '#6366f1' : '#475569', fillOpacity: 0.1 }} />
        </MapContainer>

        <div className="absolute inset-x-0 bottom-8 flex justify-center z-[1000] px-6">
          <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
            {!isEventStarted ? (
              <>
                <div className="flex justify-between items-center mb-6 px-2"><span className="text-slate-500 font-black uppercase text-[10px] flex items-center gap-2"><Settings2 size={14}/> Радиус</span><span className="text-indigo-400 font-black">{radius}м</span></div>
                <input type="range" min="10" max="500" step="10" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-indigo-500 mb-8" />
                <button onClick={handleStart} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest">Начать событие</button>
              </>
            ) : (
              <button onClick={handleStop} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20">Завершить событие</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow p-8 overflow-y-auto bg-slate-950">
        <div className="flex items-center justify-between mb-8"><h3 className="text-xs font-black uppercase text-slate-500">Участники</h3><div className="flex gap-4 text-xs font-bold text-slate-400"><Users size={14}/> {participants.length}</div></div>
        <div className="grid gap-3">
          {sortedList.map(p => (
            <div key={p.peerId} className={`flex items-center justify-between p-5 rounded-3xl border transition-all ${p.handRaised ? 'bg-indigo-500/10 border-indigo-500/50 animate-pulse' : 'bg-white/5 border-white/5'}`}>
              <div><span className="text-lg font-bold text-slate-200 block">{p.name}</span>{p.isOnAir && <span className="text-[10px] text-red-500 font-black uppercase">В эфире</span>}</div>
              <button onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { targetPeerId: p.peerId, adminPeerId: peer.id })} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${p.isOnAir ? 'bg-red-600' : 'bg-indigo-600'}`}>{p.isOnAir ? 'Mute' : 'Mic'}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminView;