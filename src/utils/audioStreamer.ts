/**
 * Audio recording and playback utilities for Gemini Live API
 * Input: 16kHz 16-bit Mono PCM Little-Endian
 * Output: 24kHz 16-bit Mono PCM Little-Endian
 */

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Converts Float32Array from Web Audio API ([-1.0, 1.0]) into 16-bit PCM ArrayBuffer
 */
export function float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    // 16-bit signed PCM little-endian
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Converts 16-bit PCM ArrayBuffer (at 24kHz) to AudioBuffer for playback
 */
export function pcm16ToAudioBuffer(
  pcmBuffer: ArrayBuffer,
  audioCtx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer {
  const int16Array = new Int16Array(pcmBuffer);
  const audioBuffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16Array.length; i++) {
    channelData[i] = int16Array[i] / 32768.0;
  }
  return audioBuffer;
}
