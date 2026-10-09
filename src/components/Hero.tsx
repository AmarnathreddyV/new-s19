import React from 'react';
import { ArrowUpRight, Sparkles, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { S19Pod3D } from './S19Pod3D';
import { useIxxVoiceConsultant } from '../utils/useIxxVoiceConsultant';
import { ProductRecommendationPopup } from './ProductRecommendationPopup';

interface HeroProps {
  onStart: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStart }) => {
  const {
    assistantState,
    isMicActive,
    isMuted,
    speechLevel,
    activeSubtitle,
    showSubtitle,
    recommendedProduct,
    setRecommendedProduct,
    toggleMic,
    toggleMute,
  } = useIxxVoiceConsultant(null);

  return (
    <div className="relative overflow-hidden">
      {/* Top Editorial Banner */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-12 sm:pt-16 lg:pt-20 pb-16 lg:pb-24 border-b border-[#C9C3B8]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Editorial Typography */}
          <div className="lg:col-span-6 xl:col-span-6 space-y-8">
            
            <div className="space-y-3">
              <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#6D6A63] font-medium block">
                THE STORY OF S19
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal tracking-[-0.035em] text-[#171715] leading-[1.08]">
                Skincare, with <br />
                <span>intention.</span>
              </h1>
            </div>

            {/* Sub-headline quote with moon phase motif inspired by reference */}
            <div className="flex items-start gap-4 pt-2">
              <div className="w-9 h-9 rounded-full bg-[#171715] flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#C9C3B8]/60 shadow-sm mt-0.5">
                {/* Crescent motif */}
                <div className="w-4 h-8 bg-[#F4F0E8] rounded-r-full -ml-4" />
              </div>
              <div className="space-y-1">
                <p className="text-base sm:text-lg font-normal tracking-[-0.02em] text-[#171715]">
                  Your skin is allowed to change.
                </p>
                <p className="text-sm sm:text-base text-[#6D6A63] leading-relaxed">
                  We believe your skincare should understand that.
                </p>
              </div>
            </div>

            <p className="text-base sm:text-lg text-[#171715]/80 max-w-xl font-normal leading-relaxed pt-2">
              Understand what your skin needs right now, then find the S.19 care designed around it.
            </p>

            {/* Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                id="hero-find-phase-btn"
                onClick={onStart}
                className="group inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#171715] text-[#F4F0E8] text-sm uppercase tracking-widest font-medium rounded-full hover:bg-[#2A2926] transition-all duration-200 shadow-sm cursor-pointer"
              >
                <span>Find my skin phase</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>


            </div>

            {/* Micro details */}
            <div className="pt-6 border-t border-[#C9C3B8]/60 flex flex-wrap items-center gap-6 text-xs text-[#6D6A63]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51]" />
                <span>4 Adaptive Skin Phases</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51]" />
                <span>Deterministic Scoring</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51]" />
                <span>Gemini-Powered Consultation</span>
              </div>
            </div>

          </div>

          {/* Right Column: Seamless Interactive 3D S.19 Pod & AI Consultant */}
          <div className="lg:col-span-6 xl:col-span-6 relative flex flex-col items-center justify-center min-h-[460px] sm:min-h-[520px] lg:min-h-[560px]">
            
            {/* Stable "IXX • CONSULTANT" Speech Bubble anchored cleanly above the 3D S.19 pod */}
            {showSubtitle && (
              <div className="w-full max-w-sm sm:max-w-md bg-[#171715]/95 backdrop-blur-md text-[#FAF8F4] px-4 sm:px-5 py-3 rounded-2xl shadow-xl border border-[#FAF8F4]/20 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 z-20 mb-1 relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        assistantState === 'IXX IS SPEAKING'
                          ? 'bg-[#E27D60] animate-ping'
                          : assistantState === 'IXX IS LISTENING'
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-amber-400'
                      }`}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C86D51]">
                      IXX • CONSULTANT
                    </span>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-[#A6A29A]">
                    {assistantState}
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] text-[#FAF8F4] leading-relaxed font-medium">
                  {activeSubtitle}
                </p>
                {/* Speech Bubble Pointer pointing downward towards the floating S.19 Pod */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#171715]/95 border-r border-b border-[#FAF8F4]/20 rotate-45" />
              </div>
            )}

            {/* The Real Interactive 3D S.19 Pod (Floating naturally with soft contact shadow, no box, no borders) */}
            <div className="relative w-full h-[360px] sm:h-[420px] lg:h-[460px] flex items-center justify-center">
              <S19Pod3D
                state={assistantState}
                speechLevel={speechLevel}
                interactive={true}
              />
            </div>

            {/* Discreet Floating Voice Consultant Controls attached cleanly below S.19 */}
            <div className="mt-1 flex items-center gap-2.5 bg-[#171715]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#FAF8F4]/15 shadow-md text-[#FAF8F4] z-20">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-1 rounded-full transition-colors ${
                  isMicActive ? 'text-emerald-400 bg-emerald-950/80' : 'text-[#A6A29A] hover:text-white'
                }`}
                title={isMicActive ? 'Mute Microphone' : 'Turn On Microphone'}
              >
                {isMicActive ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className={`p-1 rounded-full transition-colors ${
                  isMuted ? 'text-[#E27D60] bg-white/10' : 'text-[#A6A29A] hover:text-white'
                }`}
                title={isMuted ? 'Unmute Speaker' : 'Mute Speaker'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <div className="h-3 w-px bg-white/20 mx-0.5" />

              <button
                type="button"
                onClick={() => {
                  if (!isMicActive) toggleMic();
                }}
                className="text-[11px] tracking-wider text-[#DCD6CD] hover:text-white transition-colors cursor-pointer"
              >
                {isMicActive ? 'Live Voice Active · Speak freely' : 'Tap to enable live voice'}
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* Recommended Product Pop-up (when IXX recommends an S.19 capsule cream) */}
      {recommendedProduct && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[90vw] animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
          <ProductRecommendationPopup
            product={recommendedProduct}
            onClose={() => setRecommendedProduct(null)}
          />
        </div>
      )}


      {/* Secondary Story & Perspective Section (Inspired by reference screenshot) */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-16 items-start">
          <div className="md:col-span-5 space-y-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#6D6A63] font-medium block">
              THE PHILOSOPHY OF PHASES
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal text-[#171715] leading-snug tracking-[-0.03em]">
              Skin is not a static type. It is an evolving state.
            </h2>
          </div>

          <div className="md:col-span-7 space-y-6 text-[#6D6A63] text-sm sm:text-base leading-relaxed">
            <p>
              Traditional skincare categorizes you into permanent types—dry, oily, combination. Yet climate shifts, stress, hormones, and active routines continually reshape what your skin barrier requires.
            </p>
            <p>
              S.19 Skinlabs formulates around four precise phases: <strong className="text-[#171715]">Dehydration</strong>, <strong className="text-[#171715]">Oil Imbalance</strong>, <strong className="text-[#171715]">Uneven Tone</strong>, and <strong className="text-[#171715]">Recovery</strong>. By discerning your present phase, we eliminate guesswork and provide targeted active care or restorative rest.
            </p>

            <div className="pt-2">
              <button
                onClick={onStart}
                className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-[#171715] hover:text-[#C86D51] transition-colors group cursor-pointer"
              >
                <span>Begin your phase identification</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
