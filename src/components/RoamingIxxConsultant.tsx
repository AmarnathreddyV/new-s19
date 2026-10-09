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
import {
  float32ToPCM16,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  pcm16ToAudioBuffer,
} from '../utils/audioStreamer';
import { SKIN_PHASES } from '../data/phases';
import { SkinPhaseId } from '../types';
import {
  S19ProductDetails,
  matchProductFromText,
} from '../data/productCatalog';
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

export const RoamingIxxConsultant: React.FC<
  RoamingIxxConsultantProps
> = ({ currentPhaseId, onNavigateToFinder }) => {
  const [position, setPosition] = useState(() => ({
    x: typeof window !== 'undefined'
      ? Math.max(30, window.innerWidth - 320)
      : 500,
    y: typeof window !== 'undefined'
      ? Math.max(30, window.innerHeight - 280)
      : 500,
  }));

  const [isDismissed, setIsDismissed] = useState(false);
  const [facingDirection, setFacingDirection] =
    useState<'left' | 'right'>('right');
  const [isRoamingEnabled, setIsRoamingEnabled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [assistantState, setAssistantState] =
    useState<AssistantState>('IXX IS READY');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speechLevel, setSpeechLevel] = useState(0);

  const [activeSpeechSubtitle, setActiveSpeechSubtitle] = useState(
    "Hi, I'm IXX, your S.19 skincare consultant! What's bothering you about your skin today?"
  );
  const [showSubtitle, setShowSubtitle] = useState(false);
  const subtitleDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [recommendedProduct, setRecommendedProduct] =
    useState<S19ProductDetails | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextScheduledTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const isMutedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isMicActiveRef = useRef(false);

  const silenceDetectionTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRecognizerRef = useRef<any>(null);
  const accumulatedSpeechRef = useRef('');

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  const setSpokenSubtitle = useCallback((text: string) => {
    setActiveSpeechSubtitle(text);
    setShowSubtitle(true);

    if (subtitleDismissTimerRef.current) {
      clearTimeout(subtitleDismissTimerRef.current);
    }

    subtitleDismissTimerRef.current = setTimeout(() => {
      if (!isSpeakingRef.current) {
        setShowSubtitle(false);
      }
    }, 7500);
  }, []);

  useEffect(() => {
    if (!isRoamingEnabled || isDragging || isHovered || isSpeakingRef.current) {
      return;
    }

    const interval = setInterval(() => {
      const minX = Math.max(60, window.innerWidth * 0.55);
      const maxX = Math.max(minX + 20, window.innerWidth - 320);
      const minY = Math.max(60, window.innerHeight * 0.5);
      const maxY = Math.max(minY + 20, window.innerHeight - 280);

      const nextX = minX + Math.random() * (maxX - minX);
      const nextY = minY + Math.random() * (maxY - minY);

      setPosition((previous) => {
        if (nextX < previous.x - 20) setFacingDirection('left');
        if (nextX > previous.x + 20) setFacingDirection('right');

        return { x: nextX, y: nextY };
      });
    }, 9000);

    return () => clearInterval(interval);
  }, [isRoamingEnabled, isDragging, isHovered]);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;

    setIsDragging(true);

    dragStartRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const dx = event.clientX - dragStartRef.current.mouseX;
      const dy = event.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(
        20,
        Math.min(
          window.innerWidth - 350,
          dragStartRef.current.startX + dx
        )
      );

      const newY = Math.max(
        20,
        Math.min(
          window.innerHeight - 290,
          dragStartRef.current.startY + dy
        )
      );

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

  const inspectRecommendationInText = useCallback(
    (text: string) => {
      const product = matchProductFromText(text, currentPhaseId);

      if (product) {
        setRecommendedProduct(product);
      }
    },
    [currentPhaseId]
  );

  useEffect(() => {
    let animationId: number;
    let time = 0;

    const updatePulse = () => {
      if (isSpeakingRef.current) {
        time += 0.22;

        const level =
          0.45 +
          Math.sin(time * 3.4) * 0.3 +
          Math.sin(time * 7.8) * 0.2;

        setSpeechLevel(Math.max(0.15, Math.min(1, level)));
      } else {
        setSpeechLevel(0);
      }

      animationId = requestAnimationFrame(updatePulse);
    };

    animationId = requestAnimationFrame(updatePulse);

    return () => cancelAnimationFrame(animationId);
  }, []);

  // Language-aware browser speech for the HTTP fallback.
  const speakWithBrowserTts = useCallback((text: string) => {
    if (
      isMutedRef.current ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      setAssistantState('IXX IS LISTENING');
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
      const hasHindi = /[\u0900-\u097F]/.test(text);

      const language = hasTelugu
        ? 'te-IN'
        : hasHindi
          ? 'hi-IN'
          : 'en-IN';

      utterance.lang = language;
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const speakWithAvailableVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const baseLanguage = language.split('-')[0].toLowerCase();

        const matchingVoices = voices.filter((voice) => {
          const voiceLanguage = voice.lang
            .toLowerCase()
            .replace('_', '-');

          return (
            voiceLanguage === baseLanguage ||
            voiceLanguage.startsWith(`${baseLanguage}-`)
          );
        });

        const exactVoice = matchingVoices.find(
          (voice) =>
            voice.lang.toLowerCase().replace('_', '-') ===
            language.toLowerCase()
        );

        const preferredVoice = matchingVoices.find((voice) =>
          /female|samantha|victoria|karen|zira|google/i.test(voice.name)
        );

        if (matchingVoices.length > 0) {
          utterance.voice =
            exactVoice || preferredVoice || matchingVoices[0];
        } else if (baseLanguage !== 'en') {
          console.warn(
            `No installed ${language} speech voice is available.`
          );
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
      };

      const voices = window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        speakWithAvailableVoice();
      } else {
        window.speechSynthesis.addEventListener(
          'voiceschanged',
          speakWithAvailableVoice,
          { once: true }
        );
      }
    } catch (error) {
      console.error('IXX speech error:', error);
      isSpeakingRef.current = false;
      setAssistantState('IXX IS LISTENING');
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may already have stopped.
      }
    });

    activeSourcesRef.current = [];
    isSpeakingRef.current = false;

    if (outputAudioCtxRef.current) {
      nextScheduledTimeRef.current =
        outputAudioCtxRef.current.currentTime;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const playPcmChunk = useCallback((base64Data: string) => {
    if (isMutedRef.current) return;

    try {
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )({ sampleRate: 24000 });
      }

      const context = outputAudioCtxRef.current;

      if (context.state === 'suspended') {
        void context.resume();
      }

      const pcmBuffer = base64ToArrayBuffer(base64Data);
      const audioBuffer = pcm16ToAudioBuffer(
        pcmBuffer,
        context,
        24000
      );

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      const startTime = Math.max(
        context.currentTime,
        nextScheduledTimeRef.current
      );

      source.start(startTime);

      nextScheduledTimeRef.current =
        startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);

      isSpeakingRef.current = true;
      setAssistantState('IXX IS SPEAKING');

      source.onended = () => {
        const index = activeSourcesRef.current.indexOf(source);

        if (index !== -1) {
          activeSourcesRef.current.splice(index, 1);
        }

        if (activeSourcesRef.current.length === 0) {
          isSpeakingRef.current = false;
          setAssistantState('IXX IS LISTENING');
        }
      };
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  }, []);

  const sendVoiceConsultationHttp = useCallback(
    async (spokenText: string) => {
      if (!spokenText.trim()) return;

      setAssistantState('IXX IS THINKING');
      setSpokenSubtitle(spokenText);

      try {
        const response = await fetch('/api/voice-consult', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcript: spokenText,
            phase: currentPhaseId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Voice consultation failed: ${response.status}`);
        }

        const data = await response.json();

        const reply =
          data.reply ||
          "I'm right here with you! What would you like to achieve with your skin?";

        setSpokenSubtitle(reply);
        inspectRecommendationInText(reply);
        speakWithBrowserTts(reply);
      } catch (error) {
        console.error('HTTP voice consultation error:', error);

        speakWithBrowserTts(
          "I'm right here with you! Tell me what's bothering your skin."
        );
      }
    },
    [
      currentPhaseId,
      inspectRecommendationInText,
      setSpokenSubtitle,
      speakWithBrowserTts,
    ]
  );

  const connectWebSocket = useCallback(
    (): Promise<WebSocket | null> =>
      new Promise((resolve) => {
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          resolve(wsRef.current);
          return;
        }

        const protocol =
          window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        const wsUrl =
          `${protocol}//${window.location.host}/api/live-ixx`;

        let resolved = false;

        const resolveOnce = (socket: WebSocket | null) => {
          if (resolved) return;
          resolved = true;
          resolve(socket);
        };

        try {
          const socket = new WebSocket(wsUrl);
          wsRef.current = socket;

          const timeout = window.setTimeout(() => {
            if (socket.readyState !== WebSocket.OPEN) {
              socket.close();
              resolveOnce(null);
            }
          }, 5000);

          socket.onopen = () => {
            clearTimeout(timeout);

            let phaseContext = '';

            if (
              currentPhaseId &&
              SKIN_PHASES[currentPhaseId]
            ) {
              const phase = SKIN_PHASES[currentPhaseId];

              phaseContext =
                `User is viewing phase: ${phase.title} ` +
                `(${phase.recommendedProduct}).`;
            }

            socket.send(
              JSON.stringify({
                type: 'init',
                phaseContext,
              })
            );

            resolveOnce(socket);
          };

          socket.onmessage = (event) => {
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
                if (data.state === 'thinking') {
                  setAssistantState('IXX IS THINKING');
                }

                if (data.state === 'listening') {
                  setAssistantState('IXX IS LISTENING');
                }
              }

              if (data.type === 'error') {
                console.error('IXX live voice error:', data.message);
              }
            } catch (error) {
              console.error('WebSocket message error:', error);
            }
          };

          socket.onerror = () => {
            clearTimeout(timeout);
            resolveOnce(null);
          };

          socket.onclose = () => {
            clearTimeout(timeout);
          };
        } catch (error) {
          console.error('WebSocket connection error:', error);
          resolveOnce(null);
        }
      }),
    [
      currentPhaseId,
      inspectRecommendationInText,
      playPcmChunk,
      setSpokenSubtitle,
      stopAudioPlayback,
    ]
  );

  const startMicrophone = useCallback(async () => {
    try {
      setAssistantState('IXX IS_CONNECTING');
      setIsMicActive(true);

      const liveSocket = await connectWebSocket();

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      // Gemini Live processes microphone audio directly.
      // Do not run a second recognizer alongside it.
      if (!liveSocket && SpeechRecognition) {
        try {
          if (speechRecognizerRef.current) {
            speechRecognizerRef.current.stop();
          }

          const recognizer = new SpeechRecognition();

          recognizer.continuous = true;
          recognizer.interimResults = true;

          // Browser recognition is only a fallback.
          // It is not a multilingual replacement for Gemini Live.
          recognizer.lang = 'en-IN';

          recognizer.onresult = (event: any) => {
            let interim = '';

            for (
              let index = event.resultIndex;
              index < event.results.length;
              index++
            ) {
              const transcript =
                event.results[index][0].transcript;

              if (event.results[index].isFinal) {
                accumulatedSpeechRef.current += ` ${transcript}`;
              } else {
                interim += transcript;
              }
            }

            if (silenceDetectionTimerRef.current) {
              clearTimeout(silenceDetectionTimerRef.current);
            }

            silenceDetectionTimerRef.current = setTimeout(() => {
              const finalSpeech = (
                accumulatedSpeechRef.current +
                ' ' +
                interim
              ).trim();

              accumulatedSpeechRef.current = '';

              if (finalSpeech) {
                void sendVoiceConsultationHttp(finalSpeech);
              }
            }, 1100);
          };

          recognizer.onerror = (event: any) => {
            console.warn('Browser speech recognition error:', event.error);
          };

          recognizer.onend = () => {
            if (isMicActiveRef.current) {
              try {
                recognizer.start();
              } catch {
                // Recognition may already be restarting.
              }
            }
          };

          recognizer.start();
          speechRecognizerRef.current = recognizer;
        } catch (error) {
          console.warn('Speech recognition unavailable:', error);
        }
      }

      if (
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      ) {
        try {
          if (!inputAudioCtxRef.current) {
            inputAudioCtxRef.current = new (
              window.AudioContext ||
              (window as any).webkitAudioContext
            )({ sampleRate: 16000 });
          }

          const audioContext = inputAudioCtxRef.current;

          if (audioContext.state === 'suspended') {
            await audioContext.resume();
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

          const source =
            audioContext.createMediaStreamSource(stream);

          const processor =
            audioContext.createScriptProcessor(4096, 1, 1);

          processorNodeRef.current = processor;

          processor.onaudioprocess = (event) => {
            const samples =
              event.inputBuffer.getChannelData(0);

            let sum = 0;

            for (let index = 0; index < samples.length; index++) {
              sum += samples[index] * samples[index];
            }

            const rms = Math.sqrt(sum / samples.length);

            setSpeechLevel(Math.min(1, rms * 14));

            if (rms > 0.035 && isSpeakingRef.current) {
              stopAudioPlayback();
              setAssistantState('IXX IS LISTENING');
            }

            const socket = wsRef.current;

            if (socket?.readyState === WebSocket.OPEN) {
              const pcm = float32ToPCM16(samples);

              socket.send(
                JSON.stringify({
                  type: 'audio',
                  audio: arrayBufferToBase64(pcm),
                })
              );
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
        } catch (error) {
          console.error('Microphone audio setup failed:', error);
        }
      }

      setAssistantState('IXX IS LISTENING');
    } catch (error) {
      console.error('Unable to start IXX microphone:', error);

      setIsMicActive(false);
      setAssistantState('IXX IS READY');
    }
  }, [
    connectWebSocket,
    sendVoiceConsultationHttp,
    stopAudioPlayback,
  ]);

  const stopMicrophone = useCallback(() => {
    isMicActiveRef.current = false;

    if (speechRecognizerRef.current) {
      try {
        speechRecognizerRef.current.stop();
      } catch {
        // Recognition may already be stopped.
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
        // Ignore disconnected nodes.
      }

      processorNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

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
      void startMicrophone();
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

      if (subtitleDismissTimerRef.current) {
        clearTimeout(subtitleDismissTimerRef.current);
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close();
      }

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close();
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
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute -top-3 -right-3 z-50 w-6 h-6 rounded-full bg-[#171715]/90 hover:bg-black text-[#FAF8F4] border border-[#D1D5DB] flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
          title="Dismiss IXX Consultant"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {showSubtitle && (
          <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-72 sm:w-80 bg-[#171715]/95 backdrop-blur-md text-[#FAF8F4] px-4 py-3 rounded-2xl shadow-2xl border border-[#D1D5DB] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 z-40">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />

              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#38BDF8]">
                IXX &bull; CONSULTANT
              </span>
            </div>

            <p className="text-xs text-[#FAF8F4] leading-relaxed font-medium">
              {activeSpeechSubtitle}
            </p>

            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#171715]/95 border-r border-b border-[#D1D5DB] rotate-45" />
          </div>
        )}

        <div className="relative">
          <IxxPodCharacter
            state={assistantState}
            speechLevel={speechLevel}
            isHovered={isHovered}
            facingDirection={facingDirection}
            onClick={() => {
              if (!isMicActive) {
                void startMicrophone();
              }
            }}
          />

          <div
            className="absolute -bottom-11 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#171715]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#D1D5DB] shadow-xl text-[#FAF8F4]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isMicActive
                  ? 'text-emerald-400 bg-emerald-950/80'
                  : 'text-[#A6A29A] hover:text-white'
              }`}
              title={isMicActive ? 'Turn Off Mic' : 'Turn On Mic'}
            >
              {isMicActive ? (
                <Mic className="w-3.5 h-3.5 animate-pulse" />
              ) : (
                <MicOff className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isMuted
                  ? 'text-[#E27D60] bg-white/10'
                  : 'text-[#A6A29A] hover:text-white'
              }`}
              title={isMuted ? 'Unmute Speaker' : 'Mute Speaker'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsRoamingEnabled((previous) => !previous)}
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                isRoamingEnabled
                  ? 'text-amber-300'
                  : 'text-[#A6A29A] hover:text-white'
              }`}
              title={
                isRoamingEnabled
                  ? 'Anchor in corner'
                  : 'Enable roaming across corner'
              }
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {recommendedProduct && (
        <div className="fixed bottom-6 right-4 sm:right-[310px] md:right-[340px] z-[70] w-[420px] max-w-[92vw] animate-in fade-in slide-in-from-right-6 duration-500 shadow-2xl">
          <ProductRecommendationPopup
            product={recommendedProduct}
            onClose={() => setRecommendedProduct(null)}
            onSelectPhase={() => {
              onNavigateToFinder?.();
            }}
          />
        </div>
      )}
    </>
  );
};
