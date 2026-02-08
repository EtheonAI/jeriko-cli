/**
 * @repo/ai - Advanced Voice Input Hook
 *
 * High-performance voice input with real-time transcription,
 * noise reduction, and multi-language support.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type VoiceInputState =
  | 'idle'           // Not recording
  | 'requesting'     // Requesting microphone permission
  | 'listening'      // Actively recording
  | 'processing'     // Processing final transcript
  | 'error';         // Error state

export interface VoiceInputOptions {
  // Recognition settings
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;

  // Audio settings
  sampleRate?: number;
  channelCount?: number;

  // Behavior
  autoStop?: boolean;           // Auto-stop after silence
  silenceTimeout?: number;      // ms before auto-stop
  maxDuration?: number;         // Maximum recording duration

  // Callbacks
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onEnd?: (finalTranscript: string) => void;
  onError?: (error: Error) => void;
  onVolumeChange?: (volume: number) => void;
}

export interface UseVoiceInputReturn {
  // State
  state: VoiceInputState;
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  volume: number;
  error: Error | null;

  // Actions
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// Web Speech API Types
// ============================================================================

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onnomatch: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVoiceInput(options: VoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    autoStop = true,
    silenceTimeout = 2000,
    maxDuration = 60000,
    onStart,
    onResult,
    onEnd,
    onError,
    onVolumeChange,
  } = options;

  // State
  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // Refs
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const volumeAnimationRef = useRef<number | null>(null);
  const transcriptRef = useRef('');

  // Callback refs — prevent stale closures in recognition event handlers
  const onStartRef = useRef(onStart);
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const onVolumeChangeRef = useRef(onVolumeChange);

  // Keep callback refs up to date on every render
  onStartRef.current = onStart;
  onResultRef.current = onResult;
  onEndRef.current = onEnd;
  onErrorRef.current = onError;
  onVolumeChangeRef.current = onVolumeChange;

  // Check support on mount
  useEffect(() => {
    const SpeechRecognitionAPI = (
      window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).SpeechRecognition ?? (
      window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).webkitSpeechRecognition;

    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore errors during cleanup
      }
      recognitionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }

    // Cancel volume animation
    if (volumeAnimationRef.current) {
      cancelAnimationFrame(volumeAnimationRef.current);
      volumeAnimationRef.current = null;
    }

    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  // Volume monitoring
  const startVolumeMonitoring = useCallback(async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedVolume = Math.min(rms / 128, 1);

        setVolume(normalizedVolume);
        onVolumeChangeRef.current?.(normalizedVolume);

        // Reset silence timer if there's sound
        if (autoStop && normalizedVolume > 0.01) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            stop();
          }, silenceTimeout);
        }

        volumeAnimationRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Volume monitoring not available:', err);
    }
  }, [autoStop, silenceTimeout]);

  // Start recording
  const start = useCallback(async () => {
    if (state === 'listening') return;

    const SpeechRecognitionAPI = (
      window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).SpeechRecognition ?? (
      window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }
    ).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      const err = new Error('Speech recognition not supported');
      setError(err);
      setState('error');
      onErrorRef.current?.(err);
      return;
    }

    try {
      setState('requesting');
      setError(null);

      // Reset transcript for new session
      transcriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Start volume monitoring
      await startVolumeMonitoring(stream);

      // Create recognition instance
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;
      recognition.maxAlternatives = maxAlternatives;

      recognition.onstart = () => {
        setState('listening');
        onStartRef.current?.();

        // Set max duration timer
        if (maxDuration > 0) {
          maxDurationTimerRef.current = setTimeout(() => {
            stop();
          }, maxDuration);
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (final) {
          // Add space between accumulated final results
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current} ${final}`
            : final;
          setTranscript(transcriptRef.current);
          onResultRef.current?.(final, true);
        }

        setInterimTranscript(interim);
        if (interim) {
          onResultRef.current?.(interim, false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Ignore 'no-speech' and 'aborted' errors
        if (event.error === 'no-speech' || event.error === 'aborted') {
          return;
        }

        const err = new Error(`Speech recognition error: ${event.error}`);
        setError(err);
        setState('error');
        onErrorRef.current?.(err);
        cleanup();
      };

      recognition.onend = () => {
        // Check current state via updater to avoid stale closure
        setState((currentState) => {
          if (currentState === 'listening') {
            setTimeout(() => {
              const finalTranscript = transcriptRef.current;
              onEndRef.current?.(finalTranscript);
              setState('idle');
            }, 100);
            return 'processing';
          }
          return currentState;
        });
        cleanup();
      };

      recognition.onspeechend = () => {
        // Speech ended, but recognition might still process
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start voice input');
      setError(error);
      setState('error');
      onErrorRef.current?.(error);
      cleanup();
    }
  }, [
    state,
    language,
    continuous,
    interimResults,
    maxAlternatives,
    maxDuration,
    startVolumeMonitoring,
    cleanup,
  ]);

  // Stop recording
  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Toggle recording
  const toggle = useCallback(async () => {
    if (state === 'listening') {
      stop();
    } else if (state === 'idle' || state === 'error') {
      await start();
    }
  }, [state, start, stop]);

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setTranscript('');
    setInterimTranscript('');
    setVolume(0);
    setError(null);
    setState('idle');
    transcriptRef.current = '';
  }, [cleanup]);

  return {
    // State
    state,
    isListening: state === 'listening',
    isSupported,
    transcript,
    interimTranscript,
    volume,
    error,

    // Actions
    start,
    stop,
    toggle,
    reset,
  };
}
