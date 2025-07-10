import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import Piano from './components/Piano';

function App() {
  const [started, setStarted] = useState(false);

  return (
    <div>
      {!started ? (
        <MainMenu onStart={() => setStarted(true)} />
      ) : (
        <Piano />
      )}
    </div>
  );
}

export default App;
