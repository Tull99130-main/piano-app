import React from 'react';
import './MainMenu.css';

const MainMenu = ({ onStart }) => (
  <div className="main-menu">
    <h1 className="title">🎹 KeyTrack 🎹</h1>
    <p className="subtitle">Compose, Play, and Export with Ease</p>
    <button className="start-btn" onClick={onStart}>Start Playing</button>
  </div>
);

export default MainMenu;
