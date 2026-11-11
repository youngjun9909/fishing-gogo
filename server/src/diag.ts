/** 접속이 끊긴 이유를 모으는 기록(최근 300개만 메모리에 두고, Render 로그에도 "[diag]"로 남는다) */
const buf: Array<Record<string, unknown>> = [];

export function recordDiag(e: Record<string, unknown>) {
  const row = { at: new Date().toISOString(), ...e };
  buf.push(row);
  if (buf.length > 300) buf.shift();
  console.log("[diag]", JSON.stringify(row));
}

export const recentDiag = () => [...buf].reverse();

/** 브라우저가 보낸 끊김 정보에서 알려진 칸만, 크기를 제한해서 받는다(아무 값이나 로그에 쌓이지 않게) */
export function cleanClientDiag(b: any) {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  return {
    side: "client",
    code: num(b?.code), // 1006=연결이 갑자기 끊김, 4002=다른 곳에서 접속, 1001=페이지 이동/닫힘
    hidden: bool(b?.hidden), // 끊긴 순간 탭이 가려져 있었나
    sinceVisChangeSec: num(b?.sinceVisChangeSec), // 마지막으로 탭이 보이거나 가려진 지 몇 초
    online: bool(b?.online),
    net: str(b?.net, 12), // 4g, 3g 등
    rttMs: num(b?.rttMs),
    inRoomSec: num(b?.inRoomSec),
    reconnected: bool(b?.reconnected),
    afterSec: num(b?.afterSec), // 다시 붙기까지 걸린 시간
    mobile: bool(b?.mobile),
    map: str(b?.map, 20),
  };
}
