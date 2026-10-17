import React from "react";
import { Composition, registerRoot } from "remotion";
import { ToolShowcase } from "./ToolShowcase.jsx";
import { AnimalFilm } from "./AnimalFilm.jsx";
import { dimensions, filmDuration, FPS } from "./timing.mjs";
import { RefugeShow } from "./RefugeShow.jsx";
import { showSize, showTimeline, showDefaults } from "../shared/signage.mjs";
function Root() {
  return (
    <>
      <Composition
        id="ToolShowcase"
        component={ToolShowcase}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={586}
        defaultProps={{ period: 0.61, portrait: true }}
        calculateMetadata={({ props }) => ({
          width: props.portrait ? 1080 : 1920,
          height: props.portrait ? 1920 : 1080,
          durationInFrames: Math.round(40 * props.period * 30),
        })}
      />
      <Composition
        id="RefugeShow"
        component={RefugeShow}
        width={1920}
        height={1080}
        fps={24}
        durationInFrames={120}
        defaultProps={{ show: { program: showDefaults, items: [] } }}
        calculateMetadata={({ props }) => ({
          ...showSize(props.show.program.orientation),
          durationInFrames: showTimeline(props.show).frames,
        })}
      />
      <Composition
        id="AnimalFilm"
        component={AnimalFilm}
        width={1280}
        height={720}
        fps={FPS}
        durationInFrames={120}
        defaultProps={{
          film: {
            title: "Une nouvelle histoire",
            aspect: "landscape",
            resolution: "720",
            clips: [],
          },
        }}
        calculateMetadata={({ props }) => ({
          ...dimensions(props.film.aspect, props.film.resolution),
          durationInFrames: filmDuration(props.film),
        })}
      />
    </>
  );
}
registerRoot(Root);
