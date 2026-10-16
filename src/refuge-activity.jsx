import { useState } from "react";
import { Rss, History } from "lucide-react";
import { Feed } from "./shelter-feed.jsx";
import { AnimalHistory } from "./animal-history.jsx";
export function RefugeActivity({ initial = "feed", ...props }) {
  const [tab, setTab] = useState(initial);
  return (
    <div className="refuge-activity">
      <div
        className="activity-tabs"
        role="tablist"
        aria-label="Activité du refuge"
      >
        <button
          role="tab"
          aria-selected={tab === "feed"}
          onClick={() => setTab("feed")}
        >
          <Rss size={17} />
          Vie du refuge
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
        >
          <History size={17} />
          Changements des fiches SPA
        </button>
      </div>
      {tab === "feed" ? <Feed {...props} /> : <AnimalHistory {...props} />}
    </div>
  );
}
