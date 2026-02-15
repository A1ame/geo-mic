import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { Radio, Check, LogOut, Settings2, Mic } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState(() => Number(localStorage.getItem('adminRadius')) || 100);
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));

    if (peer) {
      // Сообщаем серверу, что админ онлайн (важно при перезагрузке)
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });

      // Настройка приема аудиозвонков
      peer.on('call', (call: any) => {
        call.answer();
        call.on('stream', (stream: MediaStream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(e => console.error("Audio play error:", e));
          }
        });
      });
    }

    socket.on('participants-list', (list: any[]) => setParticipants(list.filter(p => p.role === 'user')));
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));

    return () => { 
        socket.off('participants-list'); 
        socket.off('new-request'); 
    };
  }, [peer]);

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} hidden />
      
      {/* Сайдбар управления */}
      <div className="w-80 bg-slate-900 border-r border-white/10 flex flex-col z-[1000]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-black italic flex items-center gap-2 text-indigo-500 uppercase">
            <Radio size={20}/> Admin Panel
          </h2>
          <button onClick={onExit} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
            <LogOut size={20}/>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Участники ({participants.length})</p>
          
          {participants.map(p => (
            <div key={p.socketId} className={`p-4 rounded-2xl border transition-all ${p.handRaised ? 'bg-indigo-600/20 border-indigo-500 animate-pulse' : 'bg-white/5 border-white/5'}`}>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="font-bold text-sm truncate max-w-[120px]">{p.name}</span>
                    {p.handRaised && <span className="text-[9px] text-indigo-400 font-black uppercase mt-1">Поднял руку ✋</span>}
                </div>
                <button 
                  onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { socketId: p.socketId, adminPeerId: peer.id, targetPeerId: p.peerId })}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${p.isOnAir ? 'bg-red-500' : 'bg-indigo-600'}`}
                >
                  {p.isOnAir ? 'Mute' : 'Mic'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Карта */}
      <div className="flex-grow relative">
        {coords && (
          <MapContainer center={coords} zoom={15} className="h-full w-full grayscale-[0.4]">
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <Circle center={coords} radius={radius} pathOptions={{ color: '#6366f1', fillOpacity: 0.1 }} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;