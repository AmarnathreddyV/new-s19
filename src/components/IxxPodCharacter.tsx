import React, { useState, useEffect } from 'react';
import ixxProfilePng from '../assets/images/ixx_target_profile.png';

interface IxxPodCharacterProps {
  state: 'IXX IS LISTENING' | 'IXX IS SPEAKING' | 'IXX IS THINKING' | 'IXX IS READY' | 'IXX IS CONNECTING' | 'OFFLINE';
  speechLevel: number;
  isHovered: boolean;
  facingDirection?: 'left' | 'right';
  onClick: () => void;
}

/**
 * IXX 3D Robotic Consultant Pod
 * Exact reproduction of Image 2 target design:
 * - Horizontally elongated organic teardrop body
 * - Narrow, pointed front beak facing LEFT
 * - Smooth gently sloping upper surface
 * - Deep, rounded bulbous lower belly
 * - Distinctive hollow curved loop-like tail arching upward on the RIGHT and sweeping downward
 * - Pure satin matte-white ceramic material with neutral studio lighting (no pink/magenta tint)
 * - Razor-thin horizontal black recessed slit across the front portion
 * - Bright glowing electric-cyan LED light running inside the slit with emissive bloom
 */
export const IxxPodCharacter: React.FC<IxxPodCharacterProps> = ({
  state,
  speechLevel,
  isHovered,
  onClick,
}) => {
  const isSpeaking = state === 'IXX IS SPEAKING';
  const isListening = state === 'IXX IS LISTENING';
  const isThinking = state === 'IXX IS THINKING';

  // Subtle floating hover physics (strictly horizontal, gentle vertical bobbing without tilt)
  const [floatOffset, setFloatOffset] = useState(0);

  useEffect(() => {
    let frameId: number;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      // Gentle floating hover wave (max ±4.5px, slow and calming)
      const floatY = Math.sin(elapsed * 1.8) * 4.5;
      setFloatOffset(floatY);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="IXX - S.19 AI Skincare Consultant (Tap to talk)"
      className="relative cursor-pointer select-none group focus:outline-none flex flex-col items-center"
      style={{
        transform: `translateY(${floatOffset}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    >
      {/* Soft Cyan Energy Aura behind the character */}
      <div
        className={`absolute inset-x-4 inset-y-2 rounded-full blur-2xl transition-all duration-500 pointer-events-none ${
          isSpeaking
            ? 'bg-[#00E5FF]/20 scale-105 animate-pulse'
            : isListening
            ? 'bg-[#38BDF8]/16 scale-100'
            : isThinking
            ? 'bg-[#60A5FA]/14 scale-95'
            : isHovered
            ? 'bg-[#00E5FF]/10 scale-100'
            : 'bg-transparent opacity-0'
        }`}
      />

      {/* Realistic Horizontal Floating Ground Contact Shadow under the elongated belly */}
      <div
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-3.5 rounded-full blur-sm transition-all duration-300 pointer-events-none"
        style={{
          width: '72%',
          background: 'rgba(23, 23, 21, 0.14)',
          transform: `translateX(-50%) scale(${1 - Math.abs(floatOffset) / 45})`,
          opacity: 0.28 - floatOffset * 0.01,
        }}
      />

      {/* Floating Status & Name Pill Badge */}
      <div className="mb-1 pointer-events-none z-30">
        <div
          className={`px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 shadow-lg border transition-all duration-300 ${
            isSpeaking
              ? 'bg-[#171715] text-[#38BDF8] border-[#00E5FF]'
              : isListening
              ? 'bg-[#171715] text-[#38BDF8] border-[#38BDF8]'
              : isThinking
              ? 'bg-[#171715] text-amber-300 border-amber-400'
              : 'bg-[#171715]/90 text-[#FAF8F4] border-[#D1D5DB] shadow-md'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSpeaking
                ? 'bg-[#00E5FF] animate-ping'
                : isListening
                ? 'bg-[#38BDF8] animate-pulse'
                : isThinking
                ? 'bg-amber-400'
                : 'bg-[#00E5FF]'
            }`}
          />
          <span>IXX</span>
        </div>
      </div>

      {/* 
        Main Horizontally Elongated Character Body
        Aspect ratio matches the exact 940x400 silhouette (2.35:1)
        Strictly horizontal orientation with pointed front on LEFT and hook tail on RIGHT
      */}
      <div className="relative w-72 sm:w-80 md:w-92 aspect-[940/400] flex items-center justify-center">
        <img
          src={ixxProfilePng}
          alt="IXX Futuristic Organic Robotic Pod"
          className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_12px_24px_rgba(23,23,21,0.16)]"
          draggable={false}
        />

        {/* 
          Interactive Electric-Cyan LED Light Overlay
          Positioned with millimeter precision over the horizontal black slit:
          left: 4.57%, top: 46.25%, width: 45.43%, height: 4.50%
        */}
        <div
          className="absolute pointer-events-none overflow-hidden rounded-full z-20 flex items-center"
          style={{
            left: '4.57%',
            top: '46.25%',
            width: '45.43%',
            height: '4.50%',
          }}
        >
          {/* Emissive Cyan Core Strip */}
          <div
            className={`w-full h-[55%] my-auto rounded-full transition-all duration-150 ${
              isSpeaking
                ? 'bg-[#00F0FF] shadow-[0_0_8px_#00F0FF,0_0_16px_#00F0FF,0_0_24px_#00E5FF]'
                : isListening
                ? 'bg-[#38BDF8] shadow-[0_0_6px_#38BDF8,0_0_12px_#0EA5E9]'
                : isThinking
                ? 'bg-[#60A5FA] shadow-[0_0_6px_#60A5FA]'
                : 'bg-[#00E5FF]/70 shadow-[0_0_5px_#00E5FF]'
            }`}
            style={{
              opacity: isSpeaking
                ? Math.min(1, 0.75 + speechLevel * 0.8)
                : isListening
                ? 0.95
                : 0.75,
            }}
          />

          {/* Dynamic Traveling Beam Shimmer while Thinking */}
          {isThinking && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
          )}

          {/* Electric Voice Pulse along the slit while Speaking */}
          {isSpeaking && (
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent"
              style={{
                animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                opacity: 0.6 + speechLevel * 0.4,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
