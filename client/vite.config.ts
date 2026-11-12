import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 화면이 둘이다: 본 게임(index.html)과 수중 탐험(underwater.html). 둘 다 빌드에 넣는다
export default defineConfig({ plugins: [react()], server: { port: 5173 }, build: { rollupOptions: { input: { main: "index.html", underwater: "underwater.html" } } } });
