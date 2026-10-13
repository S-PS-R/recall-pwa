import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';

// Use local voices only: imported card text must not go to a speech service.
export function EnglishSpeech({ text, busy }: { text: string; busy: boolean }) {
  const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<SpeechSynthesisUtterance | null>(null);

  function cancel() {
    active.current = null;
    if (supported) window.speechSynthesis.cancel();
  }
  function stop() { cancel(); setSpeaking(false); }

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices().filter(voice => voice.localService && /^en(?:[-_]|$)/i.test(voice.lang)));
    const hide = () => { if (document.hidden) stop(); };
    load();
    synth.addEventListener('voiceschanged', load);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', stop);
    return () => {
      cancel();
      synth.removeEventListener('voiceschanged', load);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', stop);
    };
  }, [supported]);

  function speak(rate: number) {
    if (!supported || busy) return;
    stop(); setError('');
    // Some browsers populate voices only after the first user interaction.
    const available = window.speechSynthesis.getVoices().filter(voice => voice.localService && /^en(?:[-_]|$)/i.test(voice.lang));
    setVoices(available);
    const voice = available.find(item => item.default) ?? available[0];
    if (!voice) { setError('No local English voice is available yet. Check your device’s speech voices, then try again. You can still reveal and rate the card.'); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onend = () => { if (active.current === utterance) { active.current = null; setSpeaking(false); } };
    utterance.onerror = () => {
      if (active.current !== utterance) return;
      active.current = null; setSpeaking(false);
      setError('Could not play the voice. Try again, or reveal and rate the card.');
    };
    active.current = utterance;
    setSpeaking(true);
    try { window.speechSynthesis.speak(utterance); }
    catch { cancel(); setSpeaking(false); setError('Could not play the voice. Try again, or reveal and rate the card.'); }
  }

  return <section className="speech-panel" aria-label="Speaking practice">
    <p>Listen in English, say it in Hindi, then reveal the answer and rate your recall.</p>
    {supported ? <>
      <div className="speech-controls">
        <button className="button secondary" disabled={busy} onClick={() => speak(1)}><Volume2 size={18} aria-hidden="true" />Read English</button>
        <button className="button secondary" disabled={busy} onClick={() => speak(0.75)}>Read slowly</button>
        {speaking && <button className="button secondary" onClick={stop}><Square size={16} aria-hidden="true" />Stop reading</button>}
      </div>
      <p className="muted text-xs" role="status">{speaking ? 'Reading English…' : voices.length ? 'Free device voice. Tap to listen or replay.' : 'Waiting for a local English voice. Tap Read English to try.'}</p>
    </> : <p className="muted text-sm">This browser does not support reading aloud. You can still say the answer, reveal it and rate yourself.</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </section>;
}
