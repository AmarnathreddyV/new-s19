import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Send,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { float32ToPCM16, arrayBufferToBase64, base64ToArrayBuffer, pcm16ToAudioBuffer } from '../utils/audioStreamer';
import { SKIN_PHASES } from '../data/phases';
import { SkinPhaseId } from '../types';
import { S19ProductDetails, matchProductFromText } from '../data/productCatalog';
import { ProductRecommendationPopup } from './ProductRecommendationPopup';

interface FloatingVoiceAssistantProps {
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

interface MessageItem {
  id: string;
  sender: 'user' | 'ixx';
  text: string;
  timestamp: number;
}

export const FloatingVoiceAssistant: React.FC<FloatingVoiceAssistantProps> = ({
  currentPhaseId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState>('IXX IS LISTENING');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speechLevel, setSpeechLevel] = useState<number>(0);

  // Active smooth product recommendation pop-up
  const [recommendedProduct, setRecommendedProduct] = useState<S19ProductDetails | null>(null);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'ixx-intro-1',
      sender: 'ixx',
      text: "Hi, I'm IXX, your S.19 skin consultant! What's bothering you about your skin today?",
      timestamp: Date.now(),
    },
  ]);

  // Audio & speech state references
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // VAD & Speech Recognition references
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistantState, recommendedProduct]);

  // Check and trigger smooth product pop-up whenever IXX speaks/recommends
  const inspectRecommendationInText = useCallback((text: string) => {
    const matched = matchProductFromText(text, currentPhaseId);
    if (matched) {
      setRecommendedProduct(matched);
    }
  }, [currentPhaseId]);

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

    setMessages((prev) => [
      ...prev,
      {
        id: 'msg-' + Date.now(),
        sender: 'user',
        text: spokenText,
        timestamp: Date.now(),
      },
    ]);

    try {
      const response = await fetch('/api/voice-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: spokenText,
          phase: currentPhaseId,
          history: messages.slice(-4),
        }),
      });

      const data = await response.json();
      const reply = data.reply || "I'm right here with you. What would you like to achieve with your skin?";

      inspectRecommendationInText(reply);

      setMessages((prev) => [
        ...prev,
        {
          id: 'ixx-' + Date.now(),
          sender: 'ixx',
          text: reply,
          timestamp: Date.now(),
        },
      ]);

      if (data.audio) {
        playWavBase64(data.audio);
      } else {
        setAssistantState('IXX IS LISTENING');
      }
    } catch (err) {
      console.error('HTTP voice consult error:', err);
      setAssistantState('IXX IS LISTENING');
    }
  }, [currentPhaseId, inspectRecommendationInText, messages, playWavBase64]);

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
              inspectRecommendationInText(data.text);
              setMessages((prev) => {
                const sender = data.sender === 'user' ? 'user' : 'ixx';
                const last = prev[prev.length - 1];
                if (last && last.sender === sender && Date.now() - last.timestamp < 3500) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + data.text }];
                }
                return [
                  ...prev,
                  {
                    id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                    sender,
                    text: data.text,
                    timestamp: Date.now(),
                  },
                ];
              });
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
  }, [currentPhaseId, inspectRecommendationInText, playPcmChunk, stopAudioPlayback]);

  // Start microphone capture and speech recognition
  const startMicrophone = useCallback(async () => {
    try {
      setErrorMessage(null);
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

          recognizer.onerror = (e: any) => {
            console.warn('SpeechRecognition event:', e?.error);
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
          console.warn('SpeechRecognition initialization note:', e);
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
            setSpeechLevel(Math.min(1, rms * 12));

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
        } catch (mediaErr: any) {
          console.warn('getUserMedia audio capture note:', mediaErr);
        }
      }

      setIsMicActive(true);
      setAssistantState('IXX IS LISTENING');
    } catch (err: any) {
      console.warn('Microphone error:', err?.name, err?.message);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('denied'));

      if (isPermissionDenied) {
        setErrorMessage(
          'Microphone access was denied. Please allow microphone in your browser to speak, or type below anytime.'
        );
      }
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

  const handleSendTextMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    setInputText('');
    setErrorMessage(null);

    const newMsg: MessageItem = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMsg]);

    setAssistantState('IXX IS THINKING');

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'text',
            text: query,
          })
        );
      } else {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            phase: currentPhaseId,
            history: messages.map((m) => ({
              sender: m.sender === 'user' ? 'user' : 'assistant',
              text: m.text,
            })),
          }),
        });
        const data = await response.json();
        const reply = data.reply || "I'm here to guide your skin phase.";

        inspectRecommendationInText(reply);

        setMessages((prev) => [
          ...prev,
          {
            id: 'ixx-' + Date.now(),
            sender: 'ixx',
            text: reply,
            timestamp: Date.now(),
          },
        ]);
        setAssistantState('IXX IS LISTENING');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setAssistantState('IXX IS LISTENING');
    }
  };

  useEffect(() => {
    let micStartTimeout: any = null;
    const timer = setTimeout(() => {
      setIsOpen(true);
      micStartTimeout = setTimeout(() => {
        startMicrophone();
      }, 500);
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (micStartTimeout) clearTimeout(micStartTimeout);
      stopMicrophone();
      stopAudioPlayback();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [startMicrophone, stopMicrophone, stopAudioPlayback]);

  const handleOpenWidget = () => {
    setIsOpen(true);
    setTimeout(() => {
      startMicrophone();
    }, 200);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isOpen && (
          <div className="w-[360px] sm:w-[410px] max-h-[88vh] h-[580px] bg-[#FAF8F4] border border-[#C9C3B8] shadow-2xl flex flex-col mb-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-[#171715] text-[#FAF8F4] px-4 py-3.5 flex items-center justify-between border-b border-[#2C2B28]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-[#FAF8F4] text-[#171715] flex items-center justify-center font-bold text-xs tracking-wider">
                    IXX
                  </div>
                  {isMicActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#E27D60] animate-ping" />
                  )}
                  {isMicActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#E27D60]" />
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-bold tracking-[0.1em] text-[#FAF8F4] leading-tight">
                    IXX
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#A6A29A] font-medium leading-tight">
                    S.19 SKIN CONSULTANT
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-1.5 transition-colors ${
                    isMuted ? 'text-[#E27D60] bg-white/10' : 'text-[#A6A29A] hover:text-[#FAF8F4]'
                  }`}
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopMicrophone();
                    stopAudioPlayback();
                    setIsOpen(false);
                  }}
                  className="p-1.5 text-[#A6A29A] hover:text-[#FAF8F4] transition-colors"
                  title="Close Consultant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status State Banner */}
            <div className="px-4 py-2 border-b border-[#C9C3B8] bg-[#F4F0E8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    assistantState === 'IXX IS SPEAKING'
                      ? 'bg-[#E27D60] animate-pulse'
                      : assistantState === 'IXX IS LISTENING'
                      ? 'bg-emerald-600 animate-pulse'
                      : assistantState === 'IXX IS THINKING'
                      ? 'bg-amber-600 animate-pulse'
                      : assistantState === 'IXX IS CONNECTING'
                      ? 'bg-blue-600 animate-pulse'
                      : 'bg-[#6D6A63]'
                  }`}
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#171715]">
                  {assistantState}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isMicActive && assistantState === 'IXX IS LISTENING' && (
                  <div className="flex items-center gap-0.5 mr-1">
                    <span
                      className="w-1 bg-emerald-600 transition-all duration-75"
                      style={{ height: `${Math.max(4, speechLevel * 14)}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-600 transition-all duration-75"
                      style={{ height: `${Math.max(4, speechLevel * 18)}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-600 transition-all duration-75"
                      style={{ height: `${Math.max(4, speechLevel * 12)}px` }}
                    />
                  </div>
                )}
                <span className="text-[10px] uppercase tracking-[0.15em] text-[#6D6A63] font-medium">
                  REALTIME VOICE
                </span>
              </div>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="mx-4 mt-3 p-3 bg-[#FDF4F0] border border-[#E27D60]/40 text-[#171715] text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[#3E3C37]">{errorMessage}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#E27D60]/20">
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-[#6D6A63] hover:text-[#171715] transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={startMicrophone}
                    className="px-3 py-1 bg-[#171715] hover:bg-black text-[#FAF8F4] text-[10px] uppercase font-bold tracking-wider transition-colors"
                  >
                    Turn On Voice
                  </button>
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs leading-relaxed">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 ${
                      m.sender === 'user'
                        ? 'bg-[#171715] text-[#FAF8F4]'
                        : 'bg-white border border-[#C9C3B8] text-[#171715] shadow-xs'
                    }`}
                  >
                    {m.sender === 'ixx' && (
                      <div className="text-[9px] uppercase tracking-[0.2em] text-[#C86D51] font-bold mb-1">
                        IXX &bull; CONSULTANT
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}

              {assistantState === 'IXX IS THINKING' && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white border border-[#C9C3B8] text-[#6D6A63] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E27D60] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E27D60] animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E27D60] animate-bounce delay-200" />
                    <span className="text-[11px] font-medium tracking-wide ml-1">Formulating recommendation...</span>
                  </div>
                </div>
              )}

              {/* Smooth Pop-up of Recommended Cream Photo & Price */}
              {recommendedProduct && (
                <ProductRecommendationPopup
                  product={recommendedProduct}
                  onClose={() => setRecommendedProduct(null)}
                />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Voice Talk Bar */}
            <div className="px-4 py-3 bg-[#F4F0E8] border-t border-[#C9C3B8]">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-200 ${
                    isMicActive
                      ? 'bg-[#E27D60] text-white hover:bg-[#d06d50] shadow-md'
                      : 'bg-[#171715] text-[#FAF8F4] hover:bg-black'
                  }`}
                >
                  {isMicActive ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Stop Voice Mode</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Turn On Voice</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2 text-center text-[10px] text-[#6D6A63]">
                {isMicActive ? (
                  <span className="text-emerald-700 font-medium">
                    Continuous voice active &bull; Speak anytime, stops listening and answers automatically
                  </span>
                ) : (
                  <span>Voice paused &bull; Tap Turn On Voice or type below</span>
                )}
              </div>
            </div>

            {/* Text Input Fallback */}
            <div className="p-3 bg-white border-t border-[#C9C3B8]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendTextMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Or type your question here..."
                  className="flex-1 bg-[#FAF8F4] border border-[#C9C3B8] px-3 py-2 text-xs text-[#171715] placeholder-[#9E9B93] focus:outline-none focus:border-[#171715]"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 bg-[#171715] text-[#FAF8F4] hover:bg-black disabled:opacity-40 transition-opacity"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {!isOpen && (
          <button
            type="button"
            onClick={handleOpenWidget}
            className="group flex items-center gap-3 bg-[#171715] hover:bg-black text-[#FAF8F4] pl-4 pr-5 py-3 shadow-2xl border border-[#3E3C37] transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-[#FAF8F4] text-[#171715] flex items-center justify-center font-bold text-xs tracking-wider">
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
        )}
      </div>
    </>
  );
};
