import React from "react";
import {
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SignageCanvas } from "../shared/SignageCanvas.jsx";
function Video({ src, style, sceneStart, duration }) {
  return (
    <Sequence from={sceneStart} durationInFrames={duration} layout="none">
      <OffthreadVideo src={src} muted style={style} />
    </Sequence>
  );
}
export function RefugeShow({ show }) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  return (
    <>
      <style>{`@font-face{font-family:'Anipic Roboto';src:url('${staticFile("fonts/Roboto.ttf")}') format('truetype');font-weight:100 900;}`}</style>
      <SignageCanvas
        show={show}
        frame={frame}
        fps={fps}
        Video={Video}
        logoSrc={staticFile("spa-logo.png")}
      />
    </>
  );
}
