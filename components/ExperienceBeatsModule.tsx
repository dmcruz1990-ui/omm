
import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  Zap, 
  Play, 
  Pause, 
  RotateCcw, 
  Music, 
  Info,
  Maximize2
} from 'lucide-react';
import GameScene from './GameScene.tsx';
import WebcamPreview from './WebcamPreview.tsx';
import { GameStatus, NoteData } from '../types.ts';
import { DEMO_CHART, SONG_URL } from '../constants.ts';

interface ExperienceBeatsProps {
  isCameraReady: boolean;
  handPositionsRef: React.MutableRefObject<any>;
  resultsRef: React.MutableRefObject<any>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const ExperienceBeatsModule: React.FC<ExperienceBeatsProps> = ({ 
  isCameraReady, 
  handPositionsRef, 
  resultsRef, 
  videoRef 
}) => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [totalNotes, setTotalNotes] = useState(0);
  const [hitNotes, setHitNotes] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const startGame = () => {
    setGameStatus(GameStatus.PLAYING);
    setScore(0);
    setCombo(0);
    setHitNotes(0);
    setTotalNotes(0);
    setAccuracy(100);
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
    }
  };

  const pauseGame = () => {
    setGameStatus(GameStatus.PAUSED);
    if (audioRef.current) audioRef.current.pause();
  };

  const resetGame = () => {
    setGameStatus(GameStatus.IDLE);
    setScore(0);
    setCombo(0);
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  };

  const handleNoteHit = (note: NoteData, goodCut: boolean) => {
    const points = goodCut ? 115 : 50;
    setScore(prev => prev + points * (1 + Math.floor(combo / 10)));
    setCombo(prev => {
        const next = prev + 1;
        if (next > maxCombo) setMaxCombo(next);
        return next;
    });
    setHitNotes(prev => prev + 1);
    setTotalNotes(prev => prev + 1);
    updateAccuracy(hitNotes + 1, totalNotes + 1);
  };

  const handleNoteMiss = (note: NoteData) => {
    setCombo(0);
    setTotalNotes(prev => prev + 1);
    updateAccuracy(hitNotes, totalNotes + 1);
  };

  const updateAccuracy = (hits: number, total: number) => {
    if (total === 0) return;
    setAccuracy(Math.round((hits / total) * 100));
  };

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-700">
      
      {/* HUD Superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-[#111114] border border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Puntaje Ritual</span>
            <span className="text-3xl font-black italic text-blue-500 tracking-tighter">{score.toLocaleString()}</span>
         </div>
         <div className="bg-[#111114] border border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Combo Máximo</span>
            <span className="text-3xl font-black italic text-white tracking-tighter">x{combo}</span>
         </div>
         <div className="bg-[#111114] border border-white/5 rounded-[2rem] p-6 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Precisión Zen</span>
            <span className="text-3xl font-black italic text-green-500 tracking-tighter">{accuracy}%</span>
         </div>
         <div className="bg-[#111114] border border-white/5 rounded-[2rem] p-6 flex items-center justify-center gap-4">
            {gameStatus !== GameStatus.PLAYING ? (
                <button 
                    onClick={startGame}
                    className="bg-blue-600 hover:bg-blue-500 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/30 transition-all active:scale-90"
                >
                    <Play fill="currentColor" size={20} />
                </button>
            ) : (
                <button 
                    onClick={pauseGame}
                    className="bg-white/10 hover:bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all"
                >
                    <Pause fill="currentColor" size={20} />
                </button>
            )}
            <button 
                onClick={resetGame}
                className="bg-white/5 hover:bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center text-gray-500 transition-all"
            >
                <RotateCcw size={20} />
            </button>
         </div>
      </div>

      {/* Área de Juego Principal (Canvas) */}
      <div className="flex-1 bg-black rounded-[3.5rem] border-4 border-white/5 overflow-hidden relative shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        
        {/* Guía Visual IA */}
        <div className="absolute top-10 left-10 z-20 flex flex-col gap-4">
           <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4">
              <div className={`w-2.5 h-2.5 rounded-full ${isCameraReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {isCameraReady ? 'VISIÓN IA ACTIVA: 120 FPS' : 'ESPERANDO CÁMARA...'}
              </span>
           </div>
           
           {gameStatus === GameStatus.IDLE && (
              <div className="bg-blue-600/90 text-white px-6 py-4 rounded-2xl border border-blue-400/30 max-w-xs animate-in slide-in-from-left">
                 <div className="flex items-center gap-2 mb-2">
                    <Info size={14} />
                    <span className="text-[9px] font-black uppercase tracking-widest">¿Cómo Jugar?</span>
                 </div>
                 <p className="text-[10px] font-medium italic leading-relaxed">
                   Usa tus manos frente a la cámara. Los sables seguirán tus movimientos. Corta los núcleos de energía al ritmo de la música para activar el Ritual OMM.
                 </p>
              </div>
           )}
        </div>

        {/* El Canvas de Three.js */}
        <Canvas shadows gl={{ antialias: true }}>
          <GameScene 
            gameStatus={gameStatus}
            audioRef={audioRef}
            handPositionsRef={handPositionsRef}
            chart={DEMO_CHART}
            onNoteHit={handleNoteHit}
            onNoteMiss={handleNoteMiss}
            onSongEnd={resetGame}
          />
        </Canvas>

        {/* Mensaje de Pantalla de Inicio */}
        {gameStatus === GameStatus.IDLE && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-30">
               <div className="bg-[#2563eb] p-6 rounded-full shadow-[0_0_80px_rgba(37,99,235,0.5)] mb-10 animate-pulse">
                  <Music className="text-white" size={48} />
               </div>
               <h2 className="text-7xl font-black italic tracking-tighter uppercase mb-2">OMM BEATS</h2>
               <p className="text-blue-400 font-black uppercase tracking-[0.5em] text-xs mb-12">Ritual de Frecuencia Zen</p>
               <button 
                onClick={startGame}
                className="bg-white text-black px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform"
               >
                 INICIAR EXPERIENCIA
               </button>
            </div>
        )}

        <audio ref={audioRef} src={SONG_URL} crossOrigin="anonymous" />
        
        {/* Mini Preview de Cámara */}
        <WebcamPreview videoRef={videoRef} resultsRef={resultsRef} isCameraReady={isCameraReady} />
      </div>

      <div className="flex items-center justify-between px-6">
         <div className="flex items-center gap-2 text-gray-600">
            <Zap size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sincronizado con Audio Engine V2</span>
         </div>
         <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Latencia: 14ms</span>
            <Maximize2 size={16} className="text-gray-700 cursor-pointer hover:text-white transition-colors" />
         </div>
      </div>

    </div>
  );
};

export default ExperienceBeatsModule;
