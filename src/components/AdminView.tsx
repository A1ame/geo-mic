import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { Radio, Check, LogOut } from 'lucide-react';

const AdminView = ({ socket, peer, adminName, onExit }: any) => {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => setCoords([pos.coords.latitude, pos.coords.longitude]));

    if (peer) {
      socket.emit('join', { role: 'admin', name: adminName, peerId: peer.id });

      peer.on('call', (call: any) => {
        call.answer();
        call.on('stream', (stream: MediaStream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(() => console.log("Нужно взаимодействие для звука"));
          }
        });
      });
    }

    socket.on('participants-list', (list: any[]) => {
      setParticipants(list.filter(p => p.role === 'user'));
    });
    
    socket.on('new-request', (reqList: any[]) => setRequests(reqList));

    return () => { 
      socket.off('participants-list'); 
      socket.off('new-request'); 
    };
  }, [peer]);

  const handleAdminExit = () => {
    socket.emit('admin-exit');
    onExit();
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <audio ref={audioRef} autoPlay playsInline hidden />
      <div className="w-80 bg-slate-900 border-r border-white/10 flex flex-col z-[1000]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="font-black italic flex items-center gap-2 text-indigo-500 uppercase text-sm">
            <Radio size={20}/> Geo-Mic Admin
          </h2>
          <button onClick={handleAdminExit} className="p-2 text-slate-500 hover:text-red-500 transition-colors">
            <LogOut size={20}/>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-6">
          {requests.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Заявки ({requests.length})</p>
              {requests.map(req => (
                <div key={req.socketId} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                  <span className="text-sm font-bold truncate max-w-[120px]">{req.name}</span>
                  <button onClick={() => socket.emit('approve-user', req.socketId)} className="p-2 bg-green-500 rounded-lg hover:bg-green-600 transition-colors">
                    <Check size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Участники</p>
            {participants.map(p => (
              <div key={p.socketId} className={`p-4 rounded-2xl border transition-all ${p.handRaised ? 'bg-indigo-600/20 border-indigo-500 animate-pulse' : 'bg-white/5 border-white/5'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm truncate max-w-[110px]">{p.name}</span>
                    {p.handRaised && <span className="text-[9px] text-indigo-400 font-black">✋ ПРОСИТ МИК</span>}
                  </div>
                  <button 
                    onClick={() => socket.emit(p.isOnAir ? 'revoke-mic' : 'give-mic', { socketId: p.socketId, adminPeerId: peer.id, targetPeerId: p.peerId })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${p.isOnAir ? 'bg-red-500 shadow-lg shadow-red-500/20' : 'bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}
                  >
                    {p.isOnAir ? 'В ЭФИРЕ' : (p.handRaised ? 'ПРИНЯТЬ' : 'ВКЛ МИК')}
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
            <Circle center={coords} radius={100} pathOptions={{ color: '#6366f1', fillOpacity: 0.1 }} />
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminView;