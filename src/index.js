import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import MainMenu from "./components/MainMenu";
import Piano from "./components/Piano"; // import your Piano component

const App = () => {
  const [showPiano, setShowPiano] = useState(false);

  return (
    <>
      {showPiano ? (
        <Piano />
      ) : (
        <MainMenu onStart={() => setShowPiano(true)} />
      )}
    </>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
