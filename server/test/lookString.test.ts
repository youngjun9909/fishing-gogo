import { describe, expect, it } from "vitest";
import { Decoder, Encoder, MapSchema, Schema, type } from "@colyseus/schema";
import { lookString } from "../src/FishingRoom";

class P extends Schema { @type("string") look = ""; }
class S extends Schema { @type({ map: P }) players = new MapSchema<P>(); }
const roundTrip = (look: string) => {
  const s = new S(); const p = new P(); p.look = look; s.players.set("x", p);
  const d = new S(); new Decoder(d).decode(new Encoder(s).encodeAll());
  return d.players.get("x")?.look;
};

describe("캐릭터 모습 문자열", () => {
  const appearance = { eyes: 0, nose: 0, mouth: 0, hair: 3, skinColor: 0, hairColor: 4, eyeColor: 5, body: 0, gender: 1 };
  const equipped = { rod: "5", top: "top-redzip", aura: "aura-lightning", pants: "pants-chainpants", shoes: "shoes-redsneaker", mount1: "cruise-09" };

  it("정확히 255바이트가 되는 경우에도 클라이언트에 그대로 전달된다", () => {
    expect(Buffer.byteLength(JSON.stringify({ appearance, equipped }))).toBe(255); // 실제 운영에서 문제가 된 계정의 값
    expect(roundTrip(JSON.stringify({ appearance, equipped }))).toBe(""); // 라이브러리 버그: 이대로 보내면 빈 문자열이 된다
    const look = lookString({ appearance, equipped });
    expect(roundTrip(look)).toBe(look);
    expect(JSON.parse(look).equipped.top).toBe("top-redzip");
  });

  it("다른 길이는 그대로 둔다", () => {
    const e = { ...equipped, mount1: undefined };
    expect(lookString({ appearance, equipped: e })).toBe(JSON.stringify({ appearance, equipped: e }));
  });
});
