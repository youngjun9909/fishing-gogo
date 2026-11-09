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

// 방 제목·닉네임에서 막는 말. 글자 사이에 기호·공백·숫자를 끼워 넣어도(시@@발, 시...발) 걸리도록 그것들을 지우고 비교한다
// shortcut: 모든 변형을 잡지는 못한다(예: 자음만 섞기, 비슷한 모양 글자). 새로 보이는 말은 이 목록에 더한다.
const BAD_WORDS = [
  "씨발", "시발", "씨팔", "시팔", "씹", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "개새끼", "개세끼", "개쉐", "지랄", "ㅈㄹ", "좆", "조까", "존나", "ㅈㄴ",
  "꺼져", "닥쳐", "썅", "쌍년", "쌍놈", "느금", "니미", "엿먹", "미친놈", "미친년", "걸레", "애미", "에미", "ㅁㅊ", "ㅅㅂㄹㅁ",
  "섹스", "섹시", "야동", "야한", "야설", "포르노", "자위", "딸딸이", "발정", "변태", "강간", "창녀", "몸캠", "성인용품", "성관계", "빨아", "유두", "젖꼭지",
  "fuck", "shit", "bitch", "sex", "porn", "dick", "pussy", "cock", "nigg", "sibal", "ssibal", "jiral",
];

const ALONE_ONLY = ["보지", "자지"];

export function hasBadWord(text: string): boolean {
  // NFKC는 전각 영문(ｆｕｃｋ)을 풀어 주지만 ㅅㅂ 같은 자음을 다른 코드로 바꿔 버리므로 자음·모음 글자는 그대로 둔다
  const flat = [...text].map((c) => (/[ㄱ-ㆎ]/.test(c) ? c : c.normalize("NFKC"))).join("").toLowerCase().replace(/[^가-힣ㄱ-ㅎa-z]/g, "");
  const squeezed = flat.replace(/(.)\1+/g, "$1"); // 시이이발 같은 늘이기도 한 번 더 본다
  if (BAD_WORDS.some((w) => flat.includes(w) || squeezed.includes(w))) return true;
  // '보지'·'자지'는 "해보지"처럼 평범한 말에도 들어가므로, 띄어쓰기로 나뉜 한 덩어리가 이 말뿐일 때만 막는다(보@지 처럼 기호를 끼운 것도 포함)
  return text.split(/\s+/).some((t) => ALONE_ONLY.includes(t.replace(/[^가-힣]/g, "")));
}

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
