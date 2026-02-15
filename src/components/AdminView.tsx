import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { Radio, Check, LogOut, Settings2 } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(() => Number(localStorage.getItem('adminRadius')) || 100);
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));

    if (peer) {
      // Регистрируемся на сервере заново при перезагрузке
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });

      // Настройка приема звука
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

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));

    return () => { socket.off('participants-list'); socket.off('new-request'); };
  }, [peer]);

  useEffect(() => {
    if (coords) socket.emit('set-zone', { center: coords, radius });
    localStorage.setItem('adminRadius', radius.toString());
  }, [radius, coords]);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} hidden />
      <div className="w-80 bg-slate-900 border-r border-white/10 flex flex-col z-[1000]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-black italic flex items-center gap-2 text-indigo-500 uppercase tracking-tighter">
            <Radio size={20}/> Geo-Mic Admin
          </h2>
          <button onClick={onExit} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
            <LogOut size={20}/>
          </button>
        </div>

        <div className="p-4 border-b border-white/5 bg-white/5">
          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
            <span>Радиус: {radius}м</span>
            <Settings2 size={12}/>
          </div>
          <input type="range" min="50" max="1000" step="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-indigo-500"/>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {requests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase text-indigo-400">Запросы ({requests.length})</p>
              {requests.map(req => (
                <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-sm font-bold truncate">{req.name}</span>
                  <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-lg"><Check size={14}/></button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Участники</p>
            {participants.map(p => (
              <div key={p.socketId} className={`p-4 rounded-2xl border transition-all ${p.handRaised ? 'bg-indigo-600/20 border-indigo-500 animate-pulse' : 'bg-white/5 border-white/5'}`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm truncate">{p.name} {p.handRaised && '✋'}</span>
                  <button 
                    onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { socketId: p.socketId, adminPeerId: peer.id, targetPeerId: p.peerId })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${p.isOnAir ? 'bg-red-500 shadow-lg shadow-red-500/20' : 'bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}
                  >
                    {p.isOnAir ? 'Mute' : (p.handRaised ? 'Принять' : 'Mic')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow relative">
        {coords && (
          <MapContainer center={coords} zoom={15} className="h-full w-full grayscale-[0.3]">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.1 }} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;