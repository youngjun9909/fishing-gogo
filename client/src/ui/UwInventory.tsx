import { useCallback, useEffect, useState } from "react";
import { crowdPriceMul, harpoonLevelOf, rodLevelOf } from "@fishing/shared";
import type { PlayerProfile } from "@fishing/shared";
import type { Room } from "colyseus.js";
import { api } from "../net";
import { Forge } from "./Forge";
import { Inventory } from "./Lobby";

/**
 * 수중 탐험의 인벤토리(I 키)와 작살총 강화. 낚시 방과 같은 화면(Inventory·Forge)을 쓰고,
 * 수중에서 잡은 것만 이 방에서 팔 수 있다(같은 채널 인원이 많을수록 값이 조금 높다).
 */
export function UwInventory({ room, divers, onHarpoon, onClose }: { room: Room<any> | null; divers: () => number; onHarpoon: (level: number) => void; onClose: () => void }) {
  const [me, setMe] = useState<PlayerProfile | null>(null);
  const [forge, setForge] = useState(false);
  const load = useCallback(async () => {
    const p = await api<PlayerProfile>("/api/me").catch(() => null);
    if (p) { setMe(p); onHarpoon(harpoonLevelOf(p.equipped)); }
  }, [onHarpoon]);
  useEffect(() => { void load(); }, [load]);

  const sell = (ids: string[]) => new Promise<{ sold: number; earned: number; stones: number; mul: number }>((resolve, reject) => {
    if (!room) return reject(new Error("채널에 들어가 있지 않아요"));
    const off = room.onMessage("sold", (r: { sold: number; earned: number; stones: number; mul: number }) => { off(); resolve(r); });
    room.send("sell", { ids });
  });

  if (forge && me) {
    return <Forge kind="harpoon" profile={me} reload={load} onClose={() => setForge(false)} onUpgraded={() => room?.send("refresh")} />;
  }
  return (
    <Inventory
      onClose={onClose}
      reload={load}
      rod={rodLevelOf(me?.equipped)}
      uw={{ mul: crowdPriceMul(divers()), sell }}
      extra={<button className="btn small" onClick={() => setForge(true)}>🔱 작살총 강화</button>}
    />
  );
}
