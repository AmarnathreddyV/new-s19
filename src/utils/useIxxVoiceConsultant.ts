import { useState, useEffect, useRef, useCallback } from 'react';
import {
  float32ToPCM16,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  pcm16ToAudioBuffer,
} from './audioStreamer';
import { matchProductFromText, S19ProductDetails } from '../data/productCatalog';
import { SkinPhaseId } from '../types';
import { SKIN_PHASES } from '../data/phases';

export type AssistantState =
  | 'IXX IS CONNECTING'
  | 'IXX IS LISTENING'
  | 'IXX IS THINKING'
  | 'IXX IS SPEAKING'
  | 'IXX IS READY'
  | 'OFFLINE';

export function useIxxVoiceConsultant(currentPhaseId?: SkinPhaseId | null) {
  const [assistantState, setAssistantState] = useState<AssistantState>('IXX IS LISTENING');
  const [isMicActive, setIsMicActive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [speechLevel, setSpeechLevel] = useState<number>(0);

  const [activeSubtitle, setActiveSubtitle] = useState<string>(
    "Hi, I'm IXX, your S.19 skincare consultant! What's bothering you about your skin today?"
  );
  const [showSubtitle, setShowSubtitle] = useState<boolean>(true);
  const subtitleDismissTimerRef = useRef<any>(null);

  const [recommendedProduct, setRecommendedProduct] = useState<S19ProductDetails | null>(null);

  // Audio refs
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
  const isMicActiveRef = useRef<boolean>(true);

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

  const setSpokenSubtitle = useCallback((text: string) => {
    setActiveSubtitle(text);
    setShowSubtitle(true);
    if (subtitleDismissTimerRef.current) {
      clearTimeout(subtitleDismissTimerRef.current);
    }
    subtitleDismissTimerRef.current = setTimeout(() => {
      if (!isSpeakingRef.current) {
        setShowSubtitle(false);
      }
    }, 8500);
  }, []);

  const inspectRecommendation = useCallback((text: string) => {
    const matched = matchProductFromText(text);
    if (matched) {
      setRecommendedProduct(matched);
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
      console.warn('WAV playback error:', e);
      setAssistantState('IXX IS LISTENING');
    }
  }, []);

  const sendVoiceConsultationHttp = useCallback(
    async (spokenText: string) => {
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
        inspectRecommendation(reply);

        if (data.audio) {
          playWavBase64(data.audio);
        } else {
          setAssistantState('IXX IS LISTENING');
        }
      } catch (err) {
        console.error('HTTP voice consult error:', err);
        setAssistantState('IXX IS LISTENING');
      }
    },
    [currentPhaseId, inspectRecommendation, playWavBase64, setSpokenSubtitle]
  );

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
              inspectRecommendation(data.text);
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
  }, [currentPhaseId, inspectRecommendation, playPcmChunk, setSpokenSubtitle, stopAudioPlayback]);

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
    const timer = setTimeout(() => {
      startMicrophone();
    }, 600);

    return () => {
      clearTimeout(timer);
      stopMicrophone();
      stopAudioPlayback();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [startMicrophone, stopMicrophone, stopAudioPlayback]);

  return {
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
    startMicrophone,
    stopMicrophone,
    setSpokenSubtitle,
  };
}
