import { createRoot } from "react-dom/client";
import App from "./App";
import { loadCharacterModel } from "./three/character";
import "./styles.css";

// 캐릭터 모델을 먼저 불러온 뒤 화면을 그린다(실패해도 기본 모양으로 진행)
void loadCharacterModel().finally(() => createRoot(document.getElementById("root")!).render(<App />));
