import React, { useMemo } from 'react';

interface AudioFrequencyBarProps {
  state: 'IXX IS LISTENING' | 'IXX IS SPEAKING' | 'IXX IS THINKING' | 'IXX IS READY' | 'IXX IS CONNECTING' | 'OFFLINE';
  speechLevel: number; // 0.0 to 1.0
  barCount?: number;
}

export const AudioFrequencyBar: React.FC<AudioFrequencyBarProps> = ({
  state,
  speechLevel,
  barCount = 11,
}) => {
  // Waveform bars with symmetrical cosine envelope
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const mid = (barCount - 1) / 2;
      const distFromCenter = Math.abs(i - mid) / mid; // 0 in center, 1 at ends
      const envelope = Math.max(0.3, Math.cos((distFromCenter * Math.PI) / 2));
      return { id: i, envelope };
    });
  }, [barCount]);

  const isSpeaking = state === 'IXX IS SPEAKING';
  const isListening = state === 'IXX IS LISTENING';
  const isThinking = state === 'IXX IS THINKING';

  return (
    <div className="relative w-full h-full flex items-center justify-center gap-[1.5px] px-1 select-none pointer-events-none">
      {/* Subtle visor aperture backlight glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#E27D60]/25 to-transparent transition-opacity duration-300 ${
          isSpeaking || isListening ? 'opacity-100' : 'opacity-30'
        }`}
      />

      {bars.map((bar) => {
        let heightFactor = 0.25;

        if (isSpeaking) {
          // Dynamic pulsing wave when IXX speaks
          heightFactor = 0.35 + 0.65 * bar.envelope * (0.6 + 0.4 * Math.sin(Date.now() / 130 + bar.id * 0.55));
        } else if (isListening) {
          // Responsive to user microphone audio volume
          const liveScale = Math.max(0.2, speechLevel * 1.8);
          heightFactor = 0.2 + liveScale * bar.envelope;
        } else if (isThinking) {
          // Rippling thought pulse
          heightFactor = 0.25 + 0.5 * Math.abs(Math.sin(bar.id * 0.4 + Date.now() / 160));
        }

        // Very small: clamped between 2px and 8px to fit directly on the vehicle
        const heightPx = Math.max(2, Math.min(8, Math.round(heightFactor * 8)));

        return (
          <span
            key={bar.id}
            className={`w-[1.5px] rounded-full transition-all duration-75 ${
              isSpeaking
                ? 'bg-gradient-to-t from-[#C86D51] via-[#F4A261] to-white shadow-[0_0_3px_#E27D60]'
                : isListening
                ? 'bg-gradient-to-t from-emerald-600 via-emerald-400 to-white shadow-[0_0_3px_#10B981]'
                : isThinking
                ? 'bg-gradient-to-t from-amber-600 via-amber-300 to-white shadow-[0_0_3px_#F59E0B]'
                : 'bg-white/60'
            }`}
            style={{
              height: `${heightPx}px`,
              opacity: Math.max(0.4, bar.envelope),
            }}
          />
        );
      })}
    </div>
  );
};
