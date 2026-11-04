import { defineConfig } from "vitest/config";

export default defineConfig({
  // Colyseus가 process.send를 부르는데 자식 프로세스 풀에서는 충돌해서 스레드 풀을 쓴다
  test: { pool: "threads", fileParallelism: false, testTimeout: 10000, hookTimeout: 15000 },
});
