import React, { useState } from 'react'; [cite: 92]

interface RoleSelectionProps {
  onSelect: (role: 'admin' | 'user', name: string) => void; [cite: 92]
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const [name, setName] = useState(''); [cite: 93]
  const isInvalid = name.trim().length < 2; [cite: 94]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 selection:bg-indigo-500/30"> [cite: 94]
      <div className="w-full max-w-sm space-y-12"> [cite: 94]
        
        {/* Logo Section */}
        <div className="text-center space-y-6"> [cite: 94]
          <div className="inline-flex w-20 h-20 bg-gradient-to-tr from-indigo-600 to-blue-400 rounded-[2rem] items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3 mb-2"> [cite: 94]
            <span className="text-white text-4xl font-black">G</span> [cite: 94]
          </div>
          <div>
            <h1 className="text-6xl font-black text-white tracking-tighter mb-2">GEO-MIC</h1> [cite: 95]
            <p className="text-slate-500 text-xs font-bold tracking-[0.4em] uppercase opacity-60">Smart Audio Zones</p> [cite: 95]
          </div>
        </div>
        
        {/* Input */}
        <div className="relative group"> [cite: 95, 96]
          <input
            type="text"
            placeholder="Введите ваше имя..." [cite: 96]
            value={name} [cite: 96]
            onChange={(e) => setName(e.target.value)} [cite: 96]
            className="w-full p-6 bg-slate-900/50 border border-white/5 rounded-[2rem] text-white text-center text-lg placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 outline-none transition-all duration-300 backdrop-blur-sm" [cite: 96]
          />
          {name.length >= 2 && ( [cite: 96, 97]
            <div className="absolute right-6 top-6 text-indigo-500 animate-in zoom-in"> [cite: 97]
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"> [cite: 97]
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /> [cite: 97]
              </svg>
            </div>
          )}
        </div>
        
        {/* Buttons */}
        <div className="grid gap-4"> [cite: 98]
          <button
            onClick={() => !isInvalid && onSelect('admin', name.trim())} [cite: 98]
            disabled={isInvalid} [cite: 98]
            className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all duration-300 ${ [cite: 98, 99]
              isInvalid 
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' [cite: 99, 100]
                : 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5' [cite: 100]
            }`}
          >
            Создать событие [cite: 100]
          </button>
          
          <button
            onClick={() => !isInvalid && onSelect('user', name.trim())} [cite: 101]
            disabled={isInvalid} [cite: 101]
            className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all duration-300 border ${ [cite: 101]
              isInvalid 
                ? 'bg-transparent border-slate-800 text-slate-700 cursor-not-allowed' [cite: 102]
                : 'bg-slate-900 text-white border-white/10 hover:bg-slate-800 hover:scale-[1.02] active:scale-95' [cite: 102]
            }`}
          >
            Войти как гость [cite: 102]
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold opacity-40"> [cite: 102]
          v2.0 Beta • Geolocation Audio [cite: 103]
        </p>
      </div>
    </div>
  );
};

export default RoleSelection;