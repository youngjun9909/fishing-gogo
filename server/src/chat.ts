import { CHAT_MAX_LENGTH } from "@fishing/shared";

// 욕설은 막지 않고 좋은 말로 바꿔 보여 준다
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/씨\s*발|시\s*발|ㅅㅂ/g, "사랑해"],
  [/병\s*신|ㅂㅅ/g, "멋쟁이"],
  [/개\s*새\s*끼/g, "귀염둥이"],
  [/지\s*랄/g, "반가워"],
  [/좆|존나/g, "엄청"],
  [/꺼\s*져/g, "함께해"],
];

export function cleanChat(text: string): string | null {
  const replaced = REPLACEMENTS.reduce((acc, [re, to]) => acc.replace(re, to), text.trim());
  const out = replaced.slice(0, CHAT_MAX_LENGTH);
  return out || null;
}

/** 도배 방지: 5초 안에 5번까지만 */
export class ChatLimiter {
  private times: number[] = [];
  constructor(private max = 5, private windowMs = 5000) {}
  allow(now: number): boolean {
    this.times = this.times.filter((t) => now - t < this.windowMs);
    if (this.times.length >= this.max) return false;
    this.times.push(now);
    return true;
  }
}
