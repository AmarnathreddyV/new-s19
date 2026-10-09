import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Compass,
  X,
  Sparkles,
} from 'lucide-react';
import { float32ToPCM16, arrayBufferToBase64, base64ToArrayBuffer, pcm16ToAudioBuffer } from '../utils/audioStreamer';
import { SKIN_PHASES } from '../data/phases';
import { SkinPhaseId } from '../types';
import { S19ProductDetails, matchProductFromText } from '../data/productCatalog';
import { ProductRecommendationPopup } from './ProductRecommendationPopup';
import { IxxPodCharacter } from './IxxPodCharacter';

interface RoamingIxxConsultantProps {
  currentPhaseId?: SkinPhaseId | null;
  onNavigateToFinder?: () => void;
}

type AssistantState =
  | 'IXX IS CONNECTING'
  | 'IXX IS LISTENING'
  | 'IXX IS THINKING'
  | 'IXX IS SPEAKING'
  | 'IXX IS READY'
  | 'OFFLINE';

export const RoamingIxxConsultant: React.FC<RoamingIxxConsultantProps> = ({
  currentPhaseId,
  onNavigateToFinder,
}) => {
  // Screen position: stays docked gracefully in bottom-right corner by default
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(30, window.innerWidth - 320),
        y: Math.max(30, window.innerHeight - 280),
      };
    }
    return { x: 500, y: 500 };
  });

  const [isDismissed, setIsDismissed] = useState(false);
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('right');
  const [isRoamingEnabled, setIsRoamingEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  // Live Speech & Voice states (off by default so it never auto-triggers permissions or sound)
  const [assistantState, setAssistantState] = useState<AssistantState>('IXX IS READY');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechLevel, setSpeechLevel] = useState<number>(0);

  // Spoken subtitle cloud right above the character pod
  const [activeSpeechSubtitle, setActiveSpeechSubtitle] = useState<string>(
    "Hi, I'm IXX, your S.19 skincare consultant! What's bothering you about your skin today?"
  );
  const [showSubtitle, setShowSubtitle] = useState<boolean>(false);
  const subtitleDismissTimerRef = useRef<any>(null);

  // Pop-up product recommendation when IXX recommends a cream
  const [recommendedProduct, setRecommendedProduct] = useState<S19ProductDetails | null>(null);

  // Audio references
  const wsRef = useRef<WebSocket | null>(null);
  const isWsConnectedRef = useRef<boolean>(false);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextScheduledTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isMicActiveRef = useRef<boolean>(false);

  // Speech Recognition & Turn-taking
  const userHasSpokenRef = useRef<boolean>(false);
  const silenceDetectionTimerRef = useRef<any>(null);
  const isUserSpeakingRef = useRef<boolean>(false);
  const speechRecognizerRef = useRef<any>(null);
  const accumulatedSpeechRef = useRef<string>('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  // Display subtitle with auto-dismiss after speaking finishes
  const setSpokenSubtitle = useCallback((text: string) => {
    setActiveSpeechSubtitle(text);
    setShowSubtitle(true);
    if (subtitleDismissTimerRef.current) {
      clearTimeout(subtitleDismissTimerRef.current);
    }
    // Keep visible while talking, and for 7s afterwards
    subtitleDismissTimerRef.current = setTimeout(() => {
      if (!isSpeakingRef.current) {
        setShowSubtitle(false);
      }
    }, 7500);
  }, []);

  // Screen Roaming Animation Loop (confined to safe bottom-right quadrant to never cover content)
  useEffect(() => {
    if (!isRoamingEnabled || isDragging || isHovered || isSpeakingRef.current) return;

    const roamingInterval = setInterval(() => {
      // Confine strictly to right 40% and bottom 45% of viewport
      const minX = Math.max(60, window.innerWidth * 0.55);
      const maxX = Math.max(minX + 20, window.innerWidth - 320);
      const minY = Math.max(60, window.innerHeight * 0.5);
      const maxY = Math.max(minY + 20, window.innerHeight - 280);

      const nextX = minX + Math.random() * (maxX - minX);
      const nextY = minY + Math.random() * (maxY - minY);

      setPosition((prev) => {
        if (nextX < prev.x - 20) {
          setFacingDirection('left');
        } else if (nextX > prev.x + 20) {
          setFacingDirection('right');
        }
        return { x: nextX, y: nextY };
      });
    }, 9000);

    return () => clearInterval(roamingInterval);
  }, [isRoamingEnabled, isDragging, isHovered]);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(20, Math.min(window.innerWidth - 350, dragStartRef.current.startX + dx));
      const newY = Math.max(20, Math.min(window.innerHeight - 290, dragStartRef.current.startY + dy));

      if (dx < -10) setFacingDirection('left');
      if (dx > 10) setFacingDirection('right');

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const inspectRecommendationInText = useCallback((text: string) => {
    const matched = matchProductFromText(text, currentPhaseId);
    if (matched) {
      setRecommendedProduct(matched);
    }
  }, [currentPhaseId]);

  // Dynamic oscillation of speechLevel during speech so glowing blue stripe pulses in real time
  useEffect(() => {
    let animId: number;
    let t = 0;
    const updatePulse = () => {
      if (isSpeakingRef.current) {
        t += 0.22;
        const level = 0.45 + Math.sin(t * 3.4) * 0.3 + Math.sin(t * 7.8) * 0.2;
        setSpeechLevel(Math.max(0.15, Math.min(1, level)));
      } else if (!isUserSpeakingRef.current) {
        setSpeechLevel(0);
      }
      animId = requestAnimationFrame(updatePulse);
    };
    animId = requestAnimationFrame(updatePulse);
    return () => cancelAnimationFrame(animId);
  }, []);

  const speakWithBrowserTts = useCallback((text: string) => {
    if (isMutedRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAssistantState('IXX IS LISTENING');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          (v.name.includes('Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Victoria') ||
            v.name.includes('Karen') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Zira') ||
            v.name.includes('en-IN')) &&
          v.lang.startsWith('en')
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setAssistantState('IXX IS SPEAKING');
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setAssistantState('IXX IS LISTENING');
        setSpeechLevel(0);
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setAssistantState('IXX IS LISTENING');
        setSpeechLevel(0);
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      isSpeakingRef.current = false;
      setAssistantState('IXX IS LISTENING');
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    isSpeakingRef.current = false;
    if (outputAudioCtxRef.current) {
      nextScheduledTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  const playPcmChunk = useCallback((base64Data: string) => {
    if (isMutedRef.current) return;
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const pcmBuffer = base64ToArrayBuffer(base64Data);
      const audioBuffer = pcm16ToAudioBuffer(pcmBuffer, ctx, 24000);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextScheduledTimeRef.current);
      source.start(startTime);
      nextScheduledTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      isSpeakingRef.current = true;
      setAssistantState('IXX IS SPEAKING');

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
        if (activeSourcesRef.current.length === 0) {
          isSpeakingRef.current = false;
          setAssistantState('IXX IS LISTENING');
        }
      };
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, []);

  const playWavBase64 = useCallback(async (base64Wav: string) => {
    if (isMutedRef.current || !base64Wav) return;
    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const arrayBuf = base64ToArrayBuffer(base64Wav);
      const audioBuffer = await ctx.decodeAudioData(arrayBuf);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      activeSourcesRef.current.push(source);
      isSpeakingRef.current = true;
      setAssistantState('IXX IS SPEAKING');

      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
        if (activeSourcesRef.current.length === 0) {
          isSpeakingRef.current = false;
          setAssistantState('IXX IS LISTENING');
        }
      };
    } catch (e) {
      console.warn('WAV decoding playback error:', e);
      setAssistantState('IXX IS LISTENING');
    }
  }, []);

  const sendVoiceConsultationHttp = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) return;
    setAssistantState('IXX IS THINKING');
    setSpokenSubtitle(`"${spokenText}"`);

    try {
      const response = await fetch('/api/voice-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: spokenText,
          phase: currentPhaseId,
        }),
      });

      const data = await response.json();
      const reply = data.reply || "I'm right here with you! What would you like to achieve with your skin?";

      setSpokenSubtitle(reply);
      inspectRecommendationInText(reply);

      if (data.audio) {
        playWavBase64(data.audio);
      } else {
        speakWithBrowserTts(reply);
      }
    } catch (err) {
      console.error('HTTP voice consult error:', err);
      speakWithBrowserTts("I'm right here with you! Tell me what's bothering your skin.");
    }
  }, [currentPhaseId, inspectRecommendationInText, playWavBase64, setSpokenSubtitle, speakWithBrowserTts]);

  const connectWebSocket = useCallback((): Promise<WebSocket | null> => {
    return new Promise((resolve) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        isWsConnectedRef.current = true;
        resolve(wsRef.current);
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ixx`;
      
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          isWsConnectedRef.current = true;
          let phaseContext = '';
          if (currentPhaseId && SKIN_PHASES[currentPhaseId]) {
            const p = SKIN_PHASES[currentPhaseId];
            phaseContext = `User is viewing phase: ${p.title} (${p.recommendedProduct}).`;
          }

          ws.send(JSON.stringify({ type: 'init', phaseContext }));
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ready') {
              setAssistantState('IXX IS LISTENING');
            }
            if (data.type === 'audio' && data.audio) {
              playPcmChunk(data.audio);
            }
            if (data.type === 'interrupted') {
              stopAudioPlayback();
              setAssistantState('IXX IS LISTENING');
            }
            if (data.type === 'transcript' && data.text) {
              setSpokenSubtitle(data.text);
              inspectRecommendationInText(data.text);
            }
            if (data.type === 'state') {
              if (data.state === 'thinking') setAssistantState('IXX IS THINKING');
              if (data.state === 'listening') setAssistantState('IXX IS LISTENING');
            }
          } catch (e) {
            console.error('Error handling WS message:', e);
          }
        };

        ws.onerror = (e) => {
          if (e && typeof (e as any).preventDefault === 'function') {
            (e as any).preventDefault();
          }
          isWsConnectedRef.current = false;
          resolve(null);
        };

        ws.onclose = () => {
          isWsConnectedRef.current = false;
        };

        wsRef.current = ws;
      } catch {
        isWsConnectedRef.current = false;
        resolve(null);
      }
    });
  }, [currentPhaseId, inspectRecommendationInText, playPcmChunk, setSpokenSubtitle, stopAudioPlayback]);

  // Start microphone
  const startMicrophone = useCallback(async () => {
    try {
      setAssistantState('IXX IS LISTENING');
      setIsMicActive(true);

      connectWebSocket();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          if (speechRecognizerRef.current) {
            try {
              speechRecognizerRef.current.stop();
            } catch {
              // ignore
            }
          }

          const recognizer = new SpeechRecognition();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.lang = 'en-IN';

          recognizer.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                accumulatedSpeechRef.current += ' ' + transcript;
              } else {
                interim += transcript;
              }
            }

            const currentSpoken = (accumulatedSpeechRef.current + ' ' + interim).trim();

            if (currentSpoken) {
              isUserSpeakingRef.current = true;
              userHasSpokenRef.current = true;

              if (isSpeakingRef.current) {
                stopAudioPlayback();
              }

              setAssistantState('IXX IS LISTENING');

              if (silenceDetectionTimerRef.current) {
                clearTimeout(silenceDetectionTimerRef.current);
              }

              silenceDetectionTimerRef.current = setTimeout(() => {
                const finalSpeech = (accumulatedSpeechRef.current + ' ' + interim).trim();
                accumulatedSpeechRef.current = '';
                isUserSpeakingRef.current = false;
                userHasSpokenRef.current = false;

                if (finalSpeech) {
                  setAssistantState('IXX IS THINKING');
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: 'text',
                        text: finalSpeech,
                      })
                    );
                  } else {
                    sendVoiceConsultationHttp(finalSpeech);
                  }
                }
              }, 1100);
            }
          };

          recognizer.onerror = () => {
            // silent
          };

          recognizer.onend = () => {
            if (isMicActiveRef.current) {
              try {
                recognizer.start();
              } catch {
                // ignore
              }
            }
          };

          recognizer.start();
          speechRecognizerRef.current = recognizer;
        } catch (e) {
          console.warn('Speech recognition notice:', e);
        }
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          if (!inputAudioCtxRef.current) {
            inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
              sampleRate: 16000,
            });
          }
          const audioCtx = inputAudioCtxRef.current;
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;

          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorNodeRef.current = processor;

          processor.onaudioprocess = (e) => {
            const float32Samples = e.inputBuffer.getChannelData(0);

            let sum = 0;
            for (let i = 0; i < float32Samples.length; i++) {
              sum += float32Samples[i] * float32Samples[i];
            }
            const rms = Math.sqrt(sum / float32Samples.length);
            setSpeechLevel(Math.min(1, rms * 14));

            if (rms > 0.035 && isSpeakingRef.current) {
              stopAudioPlayback();
              setAssistantState('IXX IS LISTENING');
            }

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const pcm16Buffer = float32ToPCM16(float32Samples);
              const base64Audio = arrayBufferToBase64(pcm16Buffer);
              wsRef.current.send(
                JSON.stringify({
                  type: 'audio',
                  audio: base64Audio,
                })
              );
            }
          };

          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch {
          // fallback
        }
      }

      setIsMicActive(true);
      setAssistantState('IXX IS LISTENING');
    } catch {
      setIsMicActive(false);
      setAssistantState('IXX IS READY');
    }
  }, [connectWebSocket, sendVoiceConsultationHttp, stopAudioPlayback]);

  const stopMicrophone = useCallback(() => {
    isMicActiveRef.current = false;
    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognizerRef.current = null;
    }
    if (silenceDetectionTimerRef.current) {
      clearTimeout(silenceDetectionTimerRef.current);
      silenceDetectionTimerRef.current = null;
    }
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      processorNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsMicActive(false);
    setAssistantState('IXX IS READY');
    setSpeechLevel(0);
  }, []);

  const toggleMic = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  const toggleMute = () => {
    if (!isMuted) {
      stopAudioPlayback();
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  useEffect(() => {
    return () => {
      stopMicrophone();
      stopAudioPlayback();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [stopMicrophone, stopAudioPlayback]);

  const handleDismiss = () => {
    stopMicrophone();
    stopAudioPlayback();
    setIsDismissed(true);
  };

  const handleReopen = () => {
    setIsDismissed(false);
  };

  if (isDismissed) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-2">
        <button
          type="button"
          onClick={handleReopen}
          className="group flex items-center gap-3 bg-[#171715] hover:bg-black text-[#FAF8F4] pl-4 pr-5 py-3 rounded-full shadow-2xl border border-[#3E3C37] transition-all duration-300 hover:scale-[1.02] cursor-pointer"
        >
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-[#FAF8F4] text-[#171715] flex items-center justify-center font-bold text-[10px] tracking-wider">
              IXX
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E27D60]" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold tracking-[0.12em] text-[#FAF8F4] leading-tight flex items-center gap-1.5">
              <span>TALK TO IXX</span>
              <Sparkles className="w-3 h-3 text-[#E27D60]" />
            </div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[#A6A29A] font-medium leading-tight">
              S.19 SKIN CONSULTANT
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 3D Character Pod Roaming Layer — Pure transparent entity roaming freely */}
      <div
        className="fixed z-50 pointer-events-auto transition-[left,top] duration-1000 ease-out"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top Dismiss Button for Pod */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute -top-3 -right-3 z-50 w-6 h-6 rounded-full bg-[#171715]/90 hover:bg-black text-[#FAF8F4] border border-[#D1D5DB] flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
          title="Dismiss IXX Consultant"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Floating Speech Cloud directly anchored to the Character Pod */}
        {showSubtitle && (
          <div
            className="absolute -top-28 left-1/2 -translate-x-1/2 w-72 sm:w-80 bg-[#171715]/95 backdrop-blur-md text-[#FAF8F4] px-4 py-3 rounded-2xl shadow-2xl border border-[#D1D5DB] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 z-40"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">
                IXX &bull; CONSULTANT
              </span>
            </div>
            <p className="text-xs text-[#FAF8F4] leading-relaxed font-medium">
              {activeSpeechSubtitle}
            </p>
            {/* Speech bubble tail pointer pointing to IXX pod */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#171715]/95 border-r border-b border-[#D1D5DB] rotate-45" />
          </div>
        )}

        {/* Floating 3D Character Pod with animated cockpit audio frequency bar */}
        <div className="relative">
          <IxxPodCharacter
            state={assistantState}
            speechLevel={speechLevel}
            isHovered={isHovered}
            facingDirection={facingDirection}
            onClick={() => {
              if (!isMicActive) startMicrophone();
            }}
          />

          {/* Minimal Floating Action Capsule attached below pod with silver border */}
          <div
            className="absolute -bottom-11 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#171715]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#D1D5DB] shadow-xl text-[#FAF8F4]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isMicActive ? 'text-emerald-400 bg-emerald-950/80' : 'text-[#A6A29A] hover:text-white'
              }`}
              title={isMicActive ? 'Mute Mic' : 'Turn On Mic'}
            >
              {isMicActive ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isMuted ? 'text-[#E27D60] bg-white/10' : 'text-[#A6A29A] hover:text-white'
              }`}
              title={isMuted ? 'Unmute Speaker' : 'Mute Speaker'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsRoamingEnabled((prev) => !prev)}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isRoamingEnabled ? 'text-amber-300' : 'text-[#A6A29A] hover:text-white'
              }`}
              title={isRoamingEnabled ? 'Anchor in corner' : 'Enable roaming across corner'}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recommended Cream Pop-up (when IXX recommends a product, pops out smoothly beside IXX) */}
      {recommendedProduct && (
        <div className="fixed bottom-6 right-4 sm:right-[310px] md:right-[340px] z-[70] w-[420px] max-w-[92vw] animate-in fade-in slide-in-from-right-6 duration-500 shadow-2xl">
          <ProductRecommendationPopup
            product={recommendedProduct}
            onClose={() => setRecommendedProduct(null)}
            onSelectPhase={() => {
              if (onNavigateToFinder) onNavigateToFinder();
            }}
          />
        </div>
      )}
    </>
  );
};
