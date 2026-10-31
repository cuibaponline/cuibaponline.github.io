/** Fish Book read-aloud, using the device's built-in voices. Works offline. */
export function speak(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.92;
  utterance.pitch = 1.1;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  window.speechSynthesis?.cancel();
}
