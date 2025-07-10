import React, { useState } from 'react';
import './MainMenu.css';

const MainMenu = ({ onStart }) => {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <div className="main-menu">
      <div className="menu-content">
        <h1 className="title">🎹 KeyTrack 🎹</h1>
        <p className="subtitle">Compose, Play, and Export with Ease</p>
        <button className="start-btn" onClick={onStart}>Start Playing</button>
        <button className="changelog-btn" onClick={() => setShowChangelog(true)}>📜 View Changelog</button>
      </div>

      {showChangelog && (
        <div className="changelog-overlay">
          <div className="changelog-modal">
            <h2>Changelog</h2>
            <ul>
              <li><strong>Beta 1.0.0</strong> – Initial launch with piano playback, keyboard support, and an auto player.</li>
              <li><strong>Beta 1.0.1</strong> – Changed the base theme to a peach color, updated the auto player, added a cap on the BPM, lots of bug fixes.</li>
            </ul>
            <button className="close-btn" onClick={() => setShowChangelog(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Version label fixed in bottom right */}
      <div className="app-version">Beta 1.0.1</div>
    </div>
  );
};

export default MainMenu;
