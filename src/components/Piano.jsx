import React, { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "./Piano.css";

const OCTAVES = [2, 3, 4, 5, 6];
const NOTES_IN_OCTAVE = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
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

  const playbackIndex = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [bpm, setBpm] = useState(100);

  const chordBuffer = useRef(new Set());
  const chordTimer = useRef(null);

  const bpmInputRef = useRef(null);
  const [bpmEditing, setBpmEditing] = useState(false);

  const textareaRef = useRef(null);

  // New state to track the current highlighted range (start,end)
  // This is the range in sheetText currently highlighted as "about to play"
  const [highlightRange, setHighlightRange] = useState(null);

  // Initialize sampler on mount
  useEffect(() => {
    sampler.current = new Tone.Sampler({
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      urls: samplerUrls,
      release: 1,
      onload: () => setLoaded(true),
    }).toDestination();
  }, []);

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

  const QWERTY_ORDER = "1234567890qwertyuiopasdfghjklzxcvbnm";

    chordTimer.current = setTimeout(() => {
  // Sort chord keys based on QWERTY_ORDER index
  const chordKeys = Array.from(chordBuffer.current);
  
  chordKeys.sort((a, b) => {
    return QWERTY_ORDER.indexOf(a) - QWERTY_ORDER.indexOf(b);
  });

  if (chordKeys.length === 1) {
    setSheetText((prev) => prev + chordKeys[0]);
  } else {
    setSheetText((prev) => prev + "[" + chordKeys.join("") + "]");
  }

  chordBuffer.current.clear();
  chordTimer.current = null;
}, 50);

  };

  const handleChordKeyRelease = (key) => {
    // no-op
  };

  const playKeyChar = async (char) => {
    const keyInfo = FULL_KEY_MAP.find((k) => k.label === char);
    if (keyInfo) {
      playNote(keyInfo.note);
      await new Promise((r) => setTimeout(r, calcDelay() / 2));
    }
  };

  const playChord = async (group) => {
    for (let char of group) {
      const keyInfo = FULL_KEY_MAP.find((k) => k.label === char);
      if (keyInfo) playNote(keyInfo.note);
    }
    await new Promise((r) => setTimeout(r, calcDelay()));
  };

  const calcDelay = () => 30000 / bpm;

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      while (
        isPlaying &&
        !cancelled &&
        playbackIndex.current < sheetText.length
      ) {
        if (isPaused) {
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }

        let char = sheetText[playbackIndex.current];

        // Highlight the current note(s) before playing
        if (char === "[") {
          const closeIndex = sheetText.indexOf("]", playbackIndex.current);
          if (closeIndex === -1) {
            // Malformed bracket
            setHighlightRange([playbackIndex.current, playbackIndex.current]);
            await playKeyChar(char);
            playbackIndex.current++;
            setHighlightRange(null);
            continue;
          }

          // Highlight entire bracket group (including brackets)
          setHighlightRange([playbackIndex.current, closeIndex]);

          // Play the chord (notes inside brackets only)
          const group = sheetText.slice(playbackIndex.current + 1, closeIndex);
          await playChord(group);

          // Mark these as played by advancing playback index and updating highlight
          playbackIndex.current = closeIndex + 1;
          setHighlightRange(null);
        } else {
          // Single char note
          setHighlightRange([playbackIndex.current, playbackIndex.current]);
          await playKeyChar(char);
          playbackIndex.current++;
          setHighlightRange(null);
        }
      }

      if (!cancelled) {
        setIsPlaying(false);
        setIsPaused(false);
        playbackIndex.current = 0;
        setHighlightRange(null);
      }
    };

    if (isPlaying) {
      loop();
    }

    return () => {
      cancelled = true;
      setHighlightRange(null);
    };
  }, [isPlaying, isPaused, sheetText, bpm]);

  const playSheet = () => {
    if (!sheetText) return;

    if (!isPlaying) {
      playbackIndex.current =
        playbackIndex.current >= sheetText.length ? 0 : playbackIndex.current;
      setIsPlaying(true);
      setIsPaused(false);
    } else if (isPaused) {
      setIsPaused(false);
    }
  };

  const togglePause = () => {
    if (!isPlaying) return;
    setIsPaused((prev) => !prev);
  };

  const restartPlayback = () => {
    setIsPlaying(false);
    setIsPaused(false);
    playbackIndex.current = 0;
    setHighlightRange(null);
  };

  const toggleEdit = () => {
    if (isEditing) {
      restartPlayback();
      setIsEditing(false);
    } else {
      restartPlayback();
      setIsEditing(true);
    }
  };

  const handleSheetChange = (e) => {
    if (isPlaying && !isPaused) setIsPaused(true);
    setSheetText(e.target.value);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    setSheetText(text);
    playbackIndex.current = 0;
    setHighlightRange(null);
  };

  const handleBpmChange = (e) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setBpm(val);
    }
  };

  const updateBpmAndContinue = () => {
    let num = Number(bpm);
    if (isNaN(num) || num < 100) num = 100;
    else if (num > 300) num = 300;

    setBpm(num);

    if (isPlaying) {
      setIsPaused(false);
    }
  };

  const onBpmFocus = () => {
    setBpmEditing(true);
    if (isPlaying) setIsPaused(true);
  };

  const onBpmBlur = () => {
    updateBpmAndContinue();
    setBpmEditing(false);
  };

  const onBpmKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      updateBpmAndContinue();
      bpmInputRef.current?.blur();
    }
  };



  const manualPlayNote = (note, label) => {
    if (isPlaying && !isPaused) {
      setIsPaused(true);
    }
    playNote(note);
    handleChordKeyPress(label);
  };

  useEffect(() => {
    if (!loaded) return;

    const handleKeyDown = (e) => {
      if (isEditing) return;
      if (bpmEditing) return;
      if (e.repeat) return;
      if (pressedKeys.current.has(e.code)) return;

      if (isPlaying && !isPaused) {
        setIsPaused(true);
      }

      const key = e.key;
      const keyInfo = FULL_KEY_MAP.find((k) => k.label === key);
      if (!keyInfo) return;

      playNote(keyInfo.note);
      pressedKeys.current.set(e.code, { key, note: keyInfo.note });
      setPressedKeysUI((prev) => new Set(prev).add(key));

      handleChordKeyPress(key);
    };

    const handleKeyUp = (e) => {
      if (!pressedKeys.current.has(e.code)) return;
      const { key } = pressedKeys.current.get(e.code);
      pressedKeys.current.delete(e.code);
      setPressedKeysUI((prev) => {
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
  }, [loaded, isEditing, isPlaying, isPaused, bpmEditing]);

  const isKeyPressed = (label) => pressedKeysUI.has(label);

  // Renders the sheet text with coloring/highlighting, only if not editing.
  // Rules:
  // - Characters with index < playbackIndex are green (played)
  // - Characters in highlightRange are highlighted (darker orange-yellow)
  // - Otherwise normal black text
  // - Bracket groups get colored/highlighted as a block
  const renderColoredSheet = () => {
    if (!sheetText) return null;

    let elements = [];
    const length = sheetText.length;
    let i = 0;

    while (i < length) {
      if (sheetText[i] === "[") {
        // Find closing bracket
        const closeIndex = sheetText.indexOf("]", i);
        if (closeIndex === -1) {
          // Malformed bracket, treat as normal char
          elements.push(renderChar(i, sheetText[i]));
          i++;
          continue;
        }
        // Group: from i to closeIndex (inclusive)
        const inPlayed = i < playbackIndex.current;
        const inHighlight =
          highlightRange &&
          i <= highlightRange[1] &&
          closeIndex >= highlightRange[0];

        const style = {
          cursor: "default",
          whiteSpace: "pre",
          userSelect: "none",
          color: inPlayed ? "#2faa53" : "black",
          backgroundColor: inHighlight ? "#F9D174" : "transparent", // darker orange-yellow highlight
          fontWeight: inHighlight ? "bold" : "normal",
          borderRadius: 3,
          paddingLeft: 1,
          paddingRight: 1,
        };

        elements.push(
          <span key={i} style={style}>
            {sheetText.slice(i, closeIndex + 1)}
          </span>
        );
        i = closeIndex + 1;
      } else {
        // Single char
        elements.push(renderChar(i, sheetText[i]));
        i++;
      }
    }
    return elements;
  };

  // Helper to render a single char with coloring/highlighting
  const renderChar = (index, char) => {
    const inPlayed = index < playbackIndex.current;
    const inHighlight =
      highlightRange &&
      index >= highlightRange[0] &&
      index <= highlightRange[1];

    const style = {
      cursor: "default",
      userSelect: "none",
      color: isEditing ? "black" : inPlayed ? "green" : "black",
      backgroundColor: isEditing
        ? "transparent"
        : inHighlight
        ? "#cc7a00"
        : "transparent",
      fontWeight: inHighlight ? "bold" : "normal",
      whiteSpace: "pre",
    };

    return (
      <span key={index} style={style}>
        {char}
      </span>
    );
  };

  return (
    <div className={`piano-container ${isEditing ? "editing" : ""}`}>
      <div
        className="sheet-player"
        style={{ position: "relative", width: 800, margin: "0 auto 1.5rem" }}
      >
        {/* Show normal textarea for editing */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={sheetText}
            onChange={handleSheetChange}
            onPaste={handlePaste}
            readOnly={!isEditing}
            className="sheet-textarea"
            aria-label="Sheet music editor"
            spellCheck={false}
            style={{
              fontSize: "24px",
              position: "relative",
              backgroundColor: "var(--textarea-bg)",
              borderColor: "var(--textarea-border)",
              color: "black",
              caretColor: "black",
              zIndex: 1,
              userSelect: "text",
              pointerEvents: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              width: "100%",
              height: 150,
            }}
          />
        ) : (
          // Otherwise render colored sheet text with highlights
          <pre
            aria-label="Sheet music playback display"
            className="sheet-text-display"
            style={{
              fontSize: "20px",
              position: "relative",
              backgroundColor: "var(--textarea-bg)",
              border: "1px solid var(--textarea-border)",
              color: "black",
              whiteSpace: "pre-wrap",
              padding: 6,
              borderRadius: 4,
              minHeight: 150,
              userSelect: "none",
              overflowWrap: "break-word",
              margin: 0,
              fontFamily:
                'ui-monospace, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
            }}
          >
            {renderColoredSheet()}
          </pre>
        )}

        <div className="sheet-controls">
          <div className="sheet-buttons-right" style={{ marginTop: 8 }}>
            {isPlaying && !isPaused ? (
              <button
                onClick={togglePause}
                className="sheet-button"
                aria-label="Pause sheet"
              >
                ❚❚ Pause
              </button>
            ) : (
              <button
                onClick={playSheet}
                className="sheet-button"
                aria-label="Play or Resume sheet"
              >
                ▶ {isPlaying ? "Resume" : "Play"}
              </button>
            )}

            <button
              onClick={restartPlayback}
              className="sheet-button"
              aria-label="Restart sheet"
            >
              ⟲ Restart
            </button>
            <button
              onClick={toggleEdit}
              className="sheet-button"
              aria-label={isEditing ? "Done editing" : "Edit sheet"}
            >
              {isEditing ? "Done" : "Edit"}
            </button>
            <label htmlFor="bpm-input" className="bpm-label" style={{ marginLeft: 8 }}>
              BPM:
            </label>
            <input
              id="bpm-input"
              ref={bpmInputRef}
              type="text"
              value={bpm}
              onChange={handleBpmChange}
              onFocus={onBpmFocus}
              onBlur={onBpmBlur}
              onKeyDown={onBpmKeyDown}
              className="bpm-input"
              aria-label="Beats per minute"
              inputMode="numeric"
              pattern="[0-9]*"
              style={{ width: 50, marginLeft: 4 }}
            />
          </div>
        </div>
      </div>

      <div
        className="piano-wrapper"
        aria-hidden={isEditing || bpmEditing}
        style={{ userSelect: isEditing || bpmEditing ? "none" : "auto" }}
      >
        <div
          className="piano"
          aria-label="Virtual piano keyboard"
          role="application"
          style={{ userSelect: "none" }}
        >
          {FULL_KEY_MAP.filter((k) => k.color === "white").map(({ note, label }) => {
            const isPressed = isKeyPressed(label);
            return (
              <div
                key={note}
                onMouseDown={() => {
                  if (isEditing || bpmEditing) return;
                  manualPlayNote(note, label);
                }}
                className={`white-key${isPressed ? " pressed" : ""}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isEditing || bpmEditing) return;
                    manualPlayNote(note, label);
                  }
                }}
              >
                <div className="label white-label">{label}</div>
              </div>
            );
          })}
          {FULL_KEY_MAP.filter((k) => k.color === "black").map(({ note, label }) => {
            const isPressed = isKeyPressed(label);
            const noteIndex = NOTES.indexOf(note);
            const whiteBefore = NOTES.slice(0, noteIndex).filter((n) => !n.includes("#")).length;
            const left = whiteBefore * 40 - 14;
            return (
              <div
                key={note}
                onMouseDown={() => {
                  if (isEditing || bpmEditing) return;
                  manualPlayNote(note, label);
                }}
                className={`black-key${isPressed ? " pressed" : ""}`}
                style={{ left }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isEditing || bpmEditing) return;
                    manualPlayNote(note, label);
                  }
                }}
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
