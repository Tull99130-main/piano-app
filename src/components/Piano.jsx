import React, { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "./Piano.css";

const OCTAVES = [2, 3, 4, 5, 6];
const NOTES_IN_OCTAVE = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

const buildNotes = () => {
  let notes = [];
  for (let octave of OCTAVES) {
    for (let note of NOTES_IN_OCTAVE) {
      notes.push(note + octave);
    }
  }
  notes.push("C7");
  return notes;
};

const NOTES = buildNotes();

const WHITE_LABELS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
  "a", "s", "d", "f", "g", "h", "j", "k", "l", "z",
  "x", "c", "v", "b", "n", "m",
];

const BLACK_LABELS = [
  "!", "@", "$", "%", "^", "*", "(", "Q", "W", "E",
  "T", "Y", "I", "O", "P", "S", "D", "G", "H", "J",
  "L", "Z", "C", "V", "B",
];

const samplerUrls = {
  C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
  C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
  C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
  C6: "C6.mp3",
};

let whiteIndex = 0;
let blackIndex = 0;

const FULL_KEY_MAP = NOTES.map((note) => {
  if (note.includes("#")) {
    const label = BLACK_LABELS[blackIndex];
    blackIndex++;
    return {
      note,
      label,
      color: "black",
    };
  } else {
    const label = WHITE_LABELS[whiteIndex];
    whiteIndex++;
    return {
      note,
      label,
      color: "white",
    };
  }
});

export default function Piano() {
  const sampler = useRef(null);
  const [loaded, setLoaded] = useState(false);

  const pressedKeys = useRef(new Map());
  const [pressedKeysUI, setPressedKeysUI] = useState(new Set());

  const [sheetText, setSheetText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const chordBuffer = useRef(new Set());
  const chordTimer = useRef(null);

  const playbackCancelFlag = useRef(false);
  const playbackIndex = useRef(0);

  // BPM state and enforcement min 100
  const [bpm, setBpm] = useState(100);

  useEffect(() => {
    sampler.current = new Tone.Sampler({
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      urls: samplerUrls,
      release: 1,
      onload: () => setLoaded(true),
    }).toDestination();

    const handleKeyDown = (e) => {
      if (isEditing) return; // no piano play if editing sheet
      if (e.repeat) return;
      if (pressedKeys.current.has(e.code)) return;

      // Manual key press cancels auto playback
      if (playbackCancelFlag.current === false) {
        playbackCancelFlag.current = true;
      }

      const key = e.key;
      const keyInfo = FULL_KEY_MAP.find(k => k.label === key);
      if (!keyInfo) return;

      playNote(keyInfo.note);
      pressedKeys.current.set(e.code, { key, note: keyInfo.note });
      setPressedKeysUI(prev => new Set(prev).add(key));

      handleChordKeyPress(key);
    };

    const handleKeyUp = (e) => {
      if (!pressedKeys.current.has(e.code)) return;
      const { key } = pressedKeys.current.get(e.code);
      pressedKeys.current.delete(e.code);
      setPressedKeysUI(prev => {
        const copy = new Set(prev);
        copy.delete(key);
        return copy;
      });

      handleChordKeyRelease(key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearTimeout(chordTimer.current);
    };
  }, [loaded, isEditing]);

  const playNote = (note) => {
    if (!loaded || !sampler.current) return;
    try {
      Tone.start();
      sampler.current.triggerAttack(note);
    } catch {}
  };

  const handleChordKeyPress = (key) => {
    chordBuffer.current.add(key);
    if (chordTimer.current) clearTimeout(chordTimer.current);

    chordTimer.current = setTimeout(() => {
      const chordKeys = Array.from(chordBuffer.current).sort();

      if (chordKeys.length === 1) {
        setSheetText(prev => prev + chordKeys[0]);
      } else {
        setSheetText(prev => prev + "[" + chordKeys.join("") + "]");
      }

      chordBuffer.current.clear();
      chordTimer.current = null;
    }, 50);
  };

  const handleChordKeyRelease = (key) => {};

  const playKeyChar = (char) => {
    const keyInfo = FULL_KEY_MAP.find(k => k.label === char);
    if (keyInfo) playNote(keyInfo.note);
  };

  const playChord = (group) => {
    for (let char of group) {
      playKeyChar(char);
    }
  };

  // Playback logic using async recursive function to read live BPM and cancel flag
  const playSheet = async () => {
    if (!sheetText) return;
    playbackCancelFlag.current = false;
    playbackIndex.current = 0;

    const delay = ms => new Promise(res => setTimeout(res, ms));

    while (playbackIndex.current < sheetText.length && !playbackCancelFlag.current) {
      let char = sheetText[playbackIndex.current];

      if (char === "[") {
        let closeIndex = sheetText.indexOf("]", playbackIndex.current);
        if (closeIndex === -1) {
          playKeyChar(char);
          playbackIndex.current++;
          await delay(calcDelay());
          continue;
        }
        const group = sheetText.slice(playbackIndex.current + 1, closeIndex);
        playChord(group);
        playbackIndex.current = closeIndex + 1;
        await delay(calcDelay());
      } else {
        playKeyChar(char);
        playbackIndex.current++;
        await delay(calcDelay());
      }
    }
  };

  // Calculate delay from current BPM: quarter note duration in ms = 60000 / bpm
  // We'll do eighth notes = half that duration
  const calcDelay = () => 30000 / bpm;

  const toggleEdit = () => {
    setIsEditing(prev => !prev);
    // Cancel auto play if editing toggled on
    if (!isEditing) playbackCancelFlag.current = true;
  };

  // BPM increase and decrease handlers
  const increaseBpm = () => {
    setBpm(prev => Math.max(100, prev + 25));
  };

  const decreaseBpm = () => {
    setBpm(prev => Math.max(100, prev - 25));
  };

  const handleSheetChange = (e) => {
    setSheetText(e.target.value);
  };

  return (
    <div className="piano-container">
      {/* Sheet player/editor */}
      <div className="sheet-player">
        <textarea
          value={sheetText}
          onChange={handleSheetChange}
          readOnly={!isEditing}
          className="sheet-textarea"
          aria-label="Sheet music editor"
          spellCheck={false}
        />
        <div className="sheet-controls">
          <button onClick={playSheet} className="sheet-button" aria-label="Play sheet">
            ▶ Play
          </button>
          <button onClick={toggleEdit} className="sheet-button" aria-label="Toggle edit sheet">
            {isEditing ? "Done" : "Edit"}
          </button>
          <button onClick={decreaseBpm} className="sheet-button" aria-label="Decrease BPM">
            &lt;
          </button>
          <div className="bpm-display" aria-label="Current BPM">
            BPM: {bpm}
          </div>
          <button onClick={increaseBpm} className="sheet-button" aria-label="Increase BPM">
            &gt;
          </button>
        </div>
      </div>

      {/* Piano keyboard below */}
      <div className="piano-wrapper">
        <div className="piano" aria-label="Virtual piano keyboard" role="application">
          {FULL_KEY_MAP.filter(k => k.color === "white").map(({ note, label }) => {
            const isPressed = pressedKeysUI.has(label);
            return (
              <div
                key={note}
                onMouseDown={() => {
                  if (isEditing) return;
                  playNote(note);
                  handleChordKeyPress(label);
                }}
                className={`white-key${isPressed ? " pressed" : ""}`}
                role="button"
                tabIndex={0}
              >
                <div className="label white-label">{label}</div>
              </div>
            );
          })}
          {FULL_KEY_MAP.filter(k => k.color === "black").map(({ note, label }) => {
            const isPressed = pressedKeysUI.has(label);
            const noteIndex = NOTES.indexOf(note);
            const whiteBefore = NOTES.slice(0, noteIndex).filter(n => !n.includes("#")).length;
            const left = whiteBefore * 40 - 14;
            return (
              <div
                key={note}
                onMouseDown={() => {
                  if (isEditing) return;
                  playNote(note);
                  handleChordKeyPress(label);
                }}
                className={`black-key${isPressed ? " pressed" : ""}`}
                style={{ left }}
                role="button"
                tabIndex={0}
              >
                <div className="label black-label">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
