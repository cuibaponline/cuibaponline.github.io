import { Injectable, signal } from '@angular/core';
import { Animal } from '../models/animal.model';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  // Signal-based state for audio playback status
  isPlaying = signal<boolean>(false);

  // Audio context for playing sound files
  private audioContext: AudioContext | null = null;
  private audioBufferCache = new Map<string, AudioBuffer>();

  // iOS audio unlock flag
  private audioUnlocked = false;

  constructor() {
    // Initialize Audio Context (for iOS compatibility, we'll do this on first user interaction)
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext();
    }
  }

  // Unlock audio on iOS (required for first interaction)
  async unlockAudio(): Promise<void> {
    if (this.audioUnlocked || !this.audioContext) {
      return;
    }

    try {
      // Resume audio context (required on iOS)
      await this.audioContext.resume();

      // Play silent buffer to unlock audio
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      this.audioUnlocked = true;
    } catch (error) {
      console.error('Failed to unlock audio:', error);
    }
  }

  // Play animal sound followed by name pronunciation
  async playSequence(animal: Animal): Promise<void> {
    if (this.isPlaying()) {
      return; // Already playing
    }

    this.isPlaying.set(true);

    try {
      // Unlock audio on first interaction (iOS requirement)
      await this.unlockAudio();

      // Play animal sound first
      await this.playAnimalSound(animal.soundPath);

      // Wait a bit before name
      await this.delay(300);

      // Then speak the name
      await this.speakName(animal.name);
    } catch (error) {
      console.error('Error playing audio sequence:', error);
    } finally {
      this.isPlaying.set(false);
    }
  }

  // Play animal sound using Web Audio API
  private async playAnimalSound(soundPath: string): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    try {
      // Check cache first
      let buffer = this.audioBufferCache.get(soundPath);

      if (!buffer) {
        // Fetch and decode audio file
        const response = await fetch(soundPath);

        // Check if fetch was successful
        if (!response.ok) {
          console.warn(`Could not fetch sound: ${soundPath}`);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();

        // Skip if file is too small (likely placeholder)
        if (arrayBuffer.byteLength < 1000) {
          console.log('Skipping placeholder sound file');
          return;
        }

        try {
          buffer = await this.audioContext.decodeAudioData(arrayBuffer);
          // Cache the buffer
          this.audioBufferCache.set(soundPath, buffer);
        } catch (decodeError) {
          console.log('Could not decode audio file (placeholder or invalid format) - skipping to name pronunciation');
          return;
        }
      }

      // Play the buffer
      return new Promise<void>((resolve) => {
        const source = this.audioContext!.createBufferSource();
        source.buffer = buffer!;
        source.connect(this.audioContext!.destination);

        source.onended = () => resolve();

        source.start(0);
      });
    } catch (error) {
      console.log('Skipping animal sound, will speak name only');
      // Continue even if sound fails - we'll still speak the name
    }
  }

  // Speak animal name using Web Speech API
  private speakName(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(name);

      // Configure speech settings
      utterance.lang = 'en-US';
      utterance.rate = 0.85; // Slightly slower for clarity for toddlers
      utterance.pitch = 1.1; // Slightly higher pitch - more engaging for kids
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        resolve(); // Resolve anyway to not block the flow
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Preload animal sound
  async preloadSound(soundPath: string): Promise<void> {
    if (!this.audioContext || this.audioBufferCache.has(soundPath)) {
      return;
    }

    try {
      const response = await fetch(soundPath);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.audioBufferCache.set(soundPath, buffer);
    } catch (error) {
      console.error('Error preloading sound:', error);
    }
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Stop any currently playing audio
  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying.set(false);
  }
}
