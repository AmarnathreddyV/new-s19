session = await ai.live.connect({
  model: 'gemini-3.8-live',
  config: {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Aoede',
        },
      },
    },
    systemInstruction: IXX_VOICE_SYSTEM_INSTRUCTION,
  },
  callbacks: {
    // Keep your existing callbacks unchanged.
  },
});
