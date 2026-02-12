import React, { useState } from 'react';

const RoleSelection: React.FC<{ onSelect: (r: 'admin' | 'user', n: string) => void }> = ({ onSelect }) => {
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black text-white mb-2 text-center">GEO-MIC</h1>
        <p className="text-slate-500 text-center mb-10 text-sm">Микрофон в твоем кармане</p>
        
        <input
          type="text"
          placeholder="Ваше имя..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-4 mb-6 bg-slate-900 border border-slate-800 rounded-2xl text-white focus:ring-2 ring-blue-500 outline-none"
        />
        
        <div className="space-y-3">
          <button
            onClick={() => name && onSelect('admin', name)}
            className="w-full py-4 bg-white text-black rounded-2xl font-bold hover:bg-slate-200 transition-all"
          >
            Создать событие (Админ)
          </button>
          <button
            onClick={() => name && onSelect('user', name)}
            className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
          >
            Присоединиться как гость
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;