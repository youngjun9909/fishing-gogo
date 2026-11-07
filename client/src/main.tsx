import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadCharacterModel } from "./three/character";
import "./styles.css";

// 캐릭터 모델(머리카락·옷·몸)을 모두 받은 뒤에 화면을 그린다. 못 받으면 옛 모양으로 바꾸지 않고 다시 시도하게 한다
function Boot() {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let alive = true;
    setState("loading");
    loadCharacterModel().then(
      () => alive && setState("ready"),
      (e) => { console.warn("캐릭터 모델을 못 불러왔어요", e); if (alive) setState("failed"); },
    );
    return () => { alive = false; };
  }, [tries]);
  if (state === "ready") return <App />;
  return (
    <div className="login">
      <div className="card panel">
        <h1 className="logo">낚시 고고</h1>
        {state === "loading" ? (
          <p className="hint">캐릭터를 불러오는 중이에요...<br />처음 한 번은 조금 걸려요. 잠시만 기다려 주세요!</p>
        ) : (
          <>
            <p className="err">캐릭터 파일을 다 받지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
            <button className="btn mint" onClick={() => setTries((t) => t + 1)}>다시 시도</button>
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Boot />);
