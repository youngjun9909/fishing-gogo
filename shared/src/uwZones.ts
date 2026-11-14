import { registerUwSpecies } from "./harpoon";
import type { UwSpecies } from "./harpoon";
import type { Rarity } from "./types";

// 수중 탐험 구역별 고유 물고기: 구역마다 일반 30 · 희귀 10 · 매우 희귀 6 · 전설 3 · 신화 1 = 50종.
// 한 줄 형식: "이름|체형|등 색|포인트 색|무늬|특색 부품(띄어쓰기로 여럿, 부품:색)". 부품 모양은 client/src/three/uwParts.ts 에 있다.
export const UW_ZONE_NAMES = ["산호 숲", "아틀란티스 유적", "난파선", "보물 동굴", "심해 협곡", "거북이 만"];
type Tier = "c" | "r" | "v" | "l" | "m";
const RARITY: Record<Tier, Rarity> = { c: "common", r: "rare", v: "veryRare", l: "legendary", m: "mythic" };

const ZONES: Array<Record<Tier, string>> = [
  { // 0 산호 숲: 알록달록, 꽃과 산호
    c: `산호잎돔|round|#ff8fb0|#ffd84a|patches
줄무늬꽃고기|round|#ff8a2a|#ffffff|bands
분홍말미잘고기|round|#ff9ec4|#ffffff|bands
하늘빛탱|round|#3a8aff|#ffe04a|plain
레몬나비고기|round|#ffe04a|#2a2230|stripes
청줄놀래기|slim|#3ac8d8|#2a2a60|sidestripe
산호쥐치|round|#e89a7a|#a84a5a|mottled
꽃무늬볼락|round|#f06a8a|#ffd0e0|spots
민트앵무고기|bass|#5ad8b0|#ff7aa8|freckles|beak
귤빛복어|puffer|#ffa040|#ffffff|spots
보라돔|carp|#a070e8|#ffd0f8|plain
산호망둑|round|#ffb890|#e86a6a|freckles
노랑꼬리돔|bass|#6ab8f0|#ffd84a|sidestripe
딸기고기|round|#f0506a|#fff0a0|freckles
물방울복|puffer|#4ac0c8|#ffffff|spots
무지개피라미|slim|#7ae0d0|#ff8ac0|sidestripe
산호가자미|flat|#f0a0a0|#c05a70|mottled
연두놀래기|slim|#9ae060|#2a8a5a|stripes
주홍쥐돔|round|#ff6a3a|#3a4ae0|plain
얼룩나비돔|round|#ffffff|#2a2230|patches
분홍전갱이|slim|#ffb0c8|#ffe04a|sidestripe
산호오징어|squid|#ffb8c8|#e86a9a|freckles
꼬마가오리|ray|#7ab8e8|#ffffff|spots
청록쥐치|round|#2ab8a8|#ffe04a|bands
복숭아돔|carp|#ffc0a0|#ff7a8a|plain
별사탕고기|round|#fff0a0|#ff7ab0|spots
파랑줄돔|bass|#4a7af0|#bfe3ff|stripes
산호장어|ribbon|#ff9a8a|#ffe0d0|bands
자주복|puffer|#b060d0|#ffe04a|spots
은빛산호멸치|slim|#cfe4f0|#8ab0d0|plain`,
    r: `말미잘갈기고기|round|#c8a0f0|#ff8ac0|plain|mane
산호가지해마|seahorse|#ff9ab8|#ffd84a|plain|coral
꽃잎쏠배감펭|bass|#e8504a|#ffffff|bands|petals
사탕줄새우고기|slim|#ff4a5a|#ffffff|bands|whisk
부채산호가오리|ray|#ff8a9a|#b03a6a|mottled|coral
레몬뿔복|puffer|#ffe84a|#3a3a3a|spots|antler:#ffc020
물방울놀래기|slim|#2ac8b0|#ffffff|spots
나팔꽃고기|slim|#9a6ae8|#ffd0f8|plain|trumpet
산호등볼락|round|#e8785a|#ffd0c0|mottled|coral
무지개앵무고기|bass|#3ac8a8|#ff6a9a|rainbow|beak`,
    v: `무지개산호해마|seahorse|#ff9ab8|#ffe04a|rainbow|coral glow
꽃다발곰치|ribbon|#f070a0|#fff0a0|spots|petalcrest
왕나비가오리|ray|#ff9a2a|#2a2230|patches|dots:#ffffff
산호뿔유니콘피쉬|bass|#4ab0e8|#ff5a6a|sidestripe|unicorn:#ff5a6a
진주빛대왕조개고기|round|#f0e8ff|#c8a0f0|plain|shell gems:#ffffff glow
불꽃산호상어|shark|#ff7a2a|#ff3a2a|patches|sail:#ff3a2a`,
    l: `산호왕관만타|ray|#e85a8a|#ffd84a|spots|crown coral
칠색비단고기|round|#ff6a8a|#6ae0ff|rainbow
꽃밭고래상어|whale|#5a8ac8|#ff9ac8|spots|garden`,
    m: `산호의 어머니|whale|#ff8fb0|#ffe07a|patches|coral garden school glow`,
  },
  { // 1 아틀란티스 유적: 금, 대리석, 고대 문양
    c: `기둥줄돔|carp|#f0ece0|#b8b0a0|stripes
동전비늘고기|round|#ffd060|#c89020|freckles
대리석볼락|round|#e8e4dc|#9a94a0|mottled
청동쥐치|round|#5aa898|#2a6a60|mottled
신전놀래기|slim|#f4e8c0|#d8a030|sidestripe
올리브돔|bass|#9aa860|#5a6830|plain
석회가자미|flat|#e0d8c8|#a89880|mottled
금테전갱이|slim|#a8c0d0|#ffd060|sidestripe
백자복어|puffer|#f4f0e8|#6a98c8|spots
토기고기|round|#c8845a|#7a4a30|bands
푸른문양돔|carp|#3a78b8|#ffd060|stripes
유적망둑|round|#b8b0a0|#6a6460|freckles
금줄고등어|slim|#3a7a8a|#ffd060|mackerel
대리석장어|ribbon|#ece8e0|#a8a0a8|mottled
청록오징어|squid|#6ac8b8|#e8fff8|freckles
월계수잎고기|slim|#7ab060|#d8e8a0|plain
상아볼락|round|#f8f0d8|#d8b880|plain
조각돌메기|catfish|#a8a4a0|#6a6668|mottled
분수가오리|ray|#8ab8d8|#ffffff|spots
은전멸치|slim|#d8dce4|#9aa0b0|plain
옥빛돔|bass|#6ad0a8|#e8fff0|plain
테라코타복|puffer|#d8704a|#fff0d8|bands
석주농어|bass|#d0c8b8|#8a8478|stripes
아치돔|carp|#e8d8b0|#b08a50|bands
청금석고기|round|#2a4ab8|#ffd060|freckles
호박빛고기|round|#f0a030|#fff0c0|plain
회랑쥐돔|round|#8a98a8|#ffd060|sidestripe
제단문어|octopus|#e8dcc8|#b8a080|freckles
이끼기둥고기|slim|#8aa870|#e8e0c8|bands
금장어|ribbon|#e8c040|#fff0b0|plain`,
    r: `석상복어|puffer|#a8a8b0|#4ac8ff|mottled|dots:#4ac8ff
황금투구고기|bass|#4a78b8|#ffd060|plain|helmet
기둥장어|ribbon|#f4f0e8|#b8b0a8|bands|bands:#d8d0c0
모자이크가자미|flat|#3a9ac8|#ffb040|patches
월계관돔|carp|#e8e0c8|#ffd060|plain|wreath
항아리복|puffer|#c8703a|#2a2a30|bands|handles
청동방패가오리|ray|#4aa890|#c8a040|mottled|gems:#c8a040
룬문자고기|slim|#1a2a58|#5ae8ff|plain|runes
하프지느러미고기|bass|#f0e0b0|#ffd060|sidestripe|harp
금화떼돔|round|#ffd040|#ffffff|freckles|coins`,
    v: `삼지창황새치|slim|#3a68c8|#5ae8ff|plain|trident
수정눈문어|octopus|#8a70c8|#5ae8ff|freckles|bigeye bands:#ffd060
석상수호어|catfish|#b0aca8|#ffd060|mottled|mane:#d8d0c0 fangs
신전등불아귀|round|#8a7a68|#ffd060|mottled|lantern:#ffb040 fangs
황금갑옷철갑상어|shark|#6a7a8a|#ffd060|plain|plates:#ffd060
날개달린해마|seahorse|#f8f4ec|#ffd060|plain|wings`,
    l: `포세이돈의 창꼬치|slim|#c8d8e8|#4ab8ff|mackerel|spear runes
대리석고래|whale|#f0ece4|#ffd060|mottled|bands:#ffd060 runes
고대왕의 앵무조개|puffer|#ffd060|#fff6e0|bands`,
    m: `아틀라스 수호룡|ribbon|#2a8a9a|#ffd060|patches|dragon antler:#ffd060 plates:#ffd060 runes glow`,
  },
  { // 2 난파선: 녹슨 쇠, 낡은 나무, 해적
    c: `녹슨못고기|slim|#a8502a|#5a2a18|mottled
돛천가자미|flat|#d8c8a0|#8a7a5a|patches
갑판볼락|round|#8a6a4a|#4a3020|stripes
밧줄장어|ribbon|#c8a870|#8a6a3a|bands
쇠못전갱이|slim|#7a8a98|#c86a3a|sidestripe
선창쥐치|round|#6a7a70|#3a4a40|mottled
타르고등어|slim|#2a3a48|#8a98a8|mackerel
녹청돔|carp|#4a9a88|#2a5a50|mottled
나무결농어|bass|#a87a4a|#6a4a28|stripes
기름얼룩복|puffer|#4a4a58|#c8a040|spots
럼주통고기|round|#9a5a2a|#3a2a20|bands
해적깃발돔|round|#2a2a30|#f0f0f0|patches
조개붙이볼락|round|#7a6a5a|#d8d0c0|freckles
쇠고리망둑|round|#8a8a90|#4a4a50|bands
닻줄문어|octopus|#8a4a3a|#e8c0a0|freckles
선실오징어|squid|#b8a898|#6a5a50|freckles
침몰선메기|catfish|#5a5048|#2a2420|mottled
난파가오리|ray|#6a7078|#c8c0b0|spots
구리빛돔|bass|#c8783a|#ffd0a0|plain
이끼판자고기|slim|#6a8a5a|#3a5a30|mottled
등잔볼락|round|#b89040|#fff0a0|plain
화약복어|puffer|#3a3a40|#e8502a|spots
뱃머리돔|carp|#8a98a8|#4a5a68|plain
쥐구멍망둑|round|#a89880|#5a4a38|freckles
녹물장어|ribbon|#b8602a|#6a3018|mottled
선원고기|slim|#3a6a98|#f0f0f0|bands
유리병고기|round|#7ac8b0|#e8fff8|plain
쇠사슬멸치|slim|#9aa0a8|#5a6068|plain
망원경고기|slim|#c8a040|#6a4a18|bands
헌그물쥐치|round|#9a9080|#5a5448|stripes`,
    r: `닻꼬리고기|bass|#2a4a68|#8a98a8|plain|anchor
해적안대돔|carp|#c8a070|#2a2a30|plain|patch
쇠사슬장어|ribbon|#6a7078|#3a4048|bands|chain
나무통복어|puffer|#9a5a2a|#3a3a40|bands|bands:#4a4a50
대포알복|puffer|#2a2a30|#e8502a|plain|fuse
해골무늬가오리|ray|#3a3a48|#f0f0f0|plain|skull
돛지느러미고기|slim|#8a98a8|#e8dcc0|plain|sail:#e8dcc0
따개비등볼락|round|#7a5a48|#e8e0d0|mottled|barnacles
갈고리주둥이고기|slim|#5a6a78|#c8c8d0|sidestripe|hook
나침반가자미|flat|#c8a868|#e8402a|plain|compass`,
    v: `해적안대상어|shark|#5a6a78|#2a2a30|plain|patch fangs
보물지도가오리|ray|#e0c890|#c8402a|mottled|map
유령등불아귀|round|#3a4a58|#5ae8ff|mottled|lantern:#5ae8ff fangs
검날황새치|slim|#5a6a88|#d8e0e8|plain|saber
조타륜문어|octopus|#8a5a3a|#ffd060|freckles|wheel
녹슨갑옷곰치|ribbon|#a8502a|#5a3a2a|mottled|plates:#8a4a2a fangs`,
    l: `유령선장곰치|ribbon|#e8f4ff|#5ae8ff|plain|hat fangs glassy
대포기뢰복|puffer|#3a3e48|#ff7a3a|spots
검은돛상어|shark|#3a4048|#f0f0f0|plain|sail:#1a1a20 patch`,
    m: `침몰선 크라켄|octopus|#3a2a4a|#5affd0|mottled|wreck chain bigeye glow`,
  },
  { // 3 보물 동굴: 보석, 수정, 금
    c: `수정비늘고기|round|#a8e0f8|#ffffff|freckles
동굴장님고기|slim|#f8d0d0|#e8a0a8|plain
자갈망둑|round|#9a9aa0|#5a5a60|freckles
호박돔|carp|#f0a030|#ffe0a0|plain
석영볼락|round|#f0f0f8|#c8c8e0|mottled
금맥전갱이|slim|#5a5a68|#ffd040|sidestripe
옥돌쥐치|round|#6ac8a0|#e8fff0|mottled
박쥐가오리|ray|#4a4058|#8a80a0|plain
은모래가자미|flat|#d8dce4|#a0a8b8|freckles
동굴새우고기|slim|#ffb8a8|#ffffff|bands
이끼돌메기|catfish|#6a8a6a|#3a5a40|mottled
흑요석돔|bass|#2a2a38|#8a80c8|plain
터키석복|puffer|#3ac8c8|#2a2a30|spots
황수정고기|round|#ffe070|#ffffff|plain
석순고기|slim|#c8c0b0|#8a8478|bands
장미석돔|carp|#ffa8b8|#ffffff|mottled
어둠장어|ribbon|#3a3848|#8a88a8|plain
동전망둑|round|#d8a840|#8a6820|spots
석류고기|round|#c8284a|#ff9ab0|freckles
청옥놀래기|slim|#3a68d8|#a8d0ff|stripes
은괴농어|bass|#c8ccd8|#8890a0|plain
동굴오징어|squid|#e8d8e8|#b090c8|freckles
구리맥메기|catfish|#b8703a|#5a3a20|stripes
달돌볼락|round|#e8ecf8|#a8b8e8|spots
감람석돔|bass|#9ac848|#e8f8b0|plain
창백한문어|octopus|#f0e0e0|#d8a8b8|freckles
보석가루멸치|slim|#e8c8f0|#ffffff|freckles
횃불고기|round|#ff8a2a|#ffe04a|plain
석고복어|puffer|#f0ece4|#b8b0a8|spots
유리돌고기|slim|#b8e8e0|#ffffff|plain`,
    r: `루비볼락|round|#c8203a|#ff6a8a|plain|gems:#ff2a4a
사파이어돔|carp|#1a3ac8|#6a9aff|plain|gems:#3a6aff
에메랄드가자미|flat|#1aa860|#8affc0|plain|gems:#2ae880
자수정해마|seahorse|#8a4ac8|#d8a8ff|plain|crystals:#b070ff
금가루멸치|slim|#ffd040|#fff0a0|freckles|coins
종유석장어|ribbon|#c8c0b0|#8a8478|bands|spikes:#d8d0c0
동굴장님메기|catfish|#f8d8d8|#e8a8b0|plain|whisk
오팔복어|puffer|#e8f0ff|#ff9ad8|rainbow
수정가시고기|round|#a8d8f0|#ffffff|plain|crystals:#c8f0ff
열쇠꼬리고기|slim|#c8a040|#8a6818|plain|key`,
    v: `금괴메기|catfish|#ffc830|#fff0a0|plain|ingot whisk
다이아몬드가오리|ray|#e8f8ff|#a8e0ff|freckles|gems:#ffffff glow
보석상자거북복|puffer|#8a5a2a|#ffd040|bands|lid gems:#ff2a4a
왕관해파리|jelly|#ffd870|#ffb030|plain|crown
수정동굴상어|shark|#8ab8d8|#c8f0ff|plain|crystals:#c8f0ff
금목걸이곰치|ribbon|#5a3a6a|#ffd040|mottled|necklace`,
    l: `진주왕관해마|seahorse|#fff0f6|#ffd040|plain
황금잉어대왕|carp|#ffc020|#ff8a20|plain|whisk bigtail coins
수정날개날치|slim|#c8f0ff|#b08aff|plain`,
    m: `보물지기 미믹|puffer|#8a5a2a|#ffd040|bands`,
  },
  { // 4 심해 협곡: 어둠, 스스로 내는 빛
    c: `점등멸치|slim|#1a2a48|#4ac8ff|plain|dots:#4ac8ff
먹빛볼락|round|#2a2a38|#6a6a88|plain
검은쥐치|round|#1a1a28|#8a4ac8|mottled
심해새우고기|slim|#c83a3a|#ff9a8a|bands
붉은심해돔|carp|#a82a2a|#ff7a5a|plain
그림자장어|ribbon|#1a1a30|#5a5a98|plain
야광전갱이|slim|#2a3a58|#7affc8|sidestripe|dots:#7affc8
어둠가자미|flat|#2a2a3a|#4a4a68|mottled
보라등불고기|round|#3a2a68|#c88aff|spots|dots:#c88aff
심해복어|puffer|#3a3a58|#ff7ad8|spots
먹물오징어|squid|#3a2a48|#8a6ac8|freckles
창백한심해돔|bass|#c8c8d8|#8a8aa8|plain
청광멸치|slim|#1a3a5a|#5ae8ff|plain|dots:#5ae8ff
칠흑메기|catfish|#18181f|#4a4a5a|plain
심해망둑|round|#4a3a48|#a88ab8|freckles
녹광고등어|slim|#1a3a38|#5aff9a|mackerel|dots:#5aff9a
자주장어|ribbon|#4a1a48|#c85ac8|bands
해저가오리|ray|#2a2a40|#6a6aa8|spots
밤빛돔|carp|#1a2a58|#8ab0ff|freckles
붉은눈볼락|round|#3a1a28|#ff4a5a|plain
은도끼새끼고기|round|#b8c0d0|#5a6a88|plain
심연문어|octopus|#4a1a38|#ff6a9a|freckles
유령멸치|slim|#d8e0f0|#a8b8e8|plain
먹구름복|puffer|#2a2a30|#8a8a98|mottled
별가루고기|round|#1a1a38|#ffffff|freckles
남빛농어|bass|#1a2a68|#5a8aff|sidestripe
심해실고기|ribbon|#3a3a58|#ffe84a|plain|dots:#ffe84a
검붉은쥐돔|round|#4a1a1a|#ff7a3a|bands
해구메기|catfish|#2a3048|#7a88b8|mottled
안개오징어|squid|#8a98b8|#d8e8ff|freckles`,
    r: `초롱아귀|round|#5a3a2a|#ffe84a|mottled|lantern:#ffe84a fangs
유리오징어|squid|#c8e8f8|#ff8ac8|plain|glassy dots:#ff8ac8
도끼고기|round|#c8d0e0|#5a6a88|plain|dots:#8ad0ff
풍선장어|ribbon|#1a1a28|#ff5a8a|plain|fangs dots:#ff5a8a
독니고기|slim|#1a2a38|#7affc8|plain|fangs dots:#7affc8
통안물고기|round|#b8d8e8|#4aff9a|plain|glassy bigeye
흡혈오징어|squid|#8a1a2a|#ff5a5a|plain|bigeye
세다리고기|slim|#8a8a98|#d8d8e8|plain|tripod
등불해파리|jelly|#ff4a3a|#ffb080|plain
은갈치유령|ribbon|#e0e8f4|#ff4a4a|plain|mane:#ff4a4a`,
    v: `별무늬심해상어|shark|#141428|#ffffff|plain|stars
대왕산갈치|ribbon|#dce4ee|#ff4a4a|plain|mane:#ff4a4a dots:#ff8a8a
고블린상어|shark|#e8a8b8|#c86a8a|plain|spear fangs
심해등대아귀|round|#2a2a3a|#fff0a0|mottled|lantern:#fff0a0 fangs halo:#fff0a0
덤보문어|octopus|#ff9a7a|#ffe0d0|freckles|wings
수정오징어대왕|squid|#b8e0f8|#ffffff|plain|bigeye glassy dots:#8ad8ff`,
    l: `대왕유령해파리|jelly|#b08aff|#ffffff|plain|tentacles:#c8a0ff
심연대왕오징어|squid|#3a1030|#4ac8ff|plain
별하늘개복치|round|#10143a|#ffffff|plain`,
    m: `심연의 눈|octopus|#1a1038|#b05aff|plain|cyclops tentacles:#b05aff stars glow`,
  },
  { // 5 거북이 만: 따뜻한 모래, 해초, 거북
    c: `모래무늬가자미|flat|#e8d0a0|#b8986a|spots
해초꼬리고기|slim|#6ac870|#2a8a4a|plain|leaftail
조개무늬볼락|round|#f0c8a0|#c8845a|spots
햇살전갱이|slim|#ffe070|#ff9a30|sidestripe
모래망둑|round|#e0c890|#a88a5a|freckles
연두돔|carp|#a8e070|#e8ffc0|plain
산들놀래기|slim|#5ad0c0|#fff0a0|stripes
잔물결고등어|slim|#5ab0d8|#2a6a98|mackerel
아기거북복|puffer|#8ac870|#ffe04a|spots
해초장어|ribbon|#4a9a50|#a8e070|plain
모래성돔|bass|#e8c880|#fff0c0|bands
조약돌쥐치|round|#b8b0a0|#7a7468|mottled
바닷말고기|slim|#3a8a5a|#c8e890|bands
살구돔|carp|#ffb880|#fff0d8|plain
물빛가오리|ray|#8ad8f0|#ffffff|spots
파래복어|puffer|#5ab850|#fff0a0|spots
은모래멸치|slim|#e8e4d8|#c8b890|plain
노을볼락|round|#ff9a6a|#ffd0a0|plain
야자돔|bass|#8a6a3a|#a8e070|stripes
해변오징어|squid|#ffd8c0|#ff9a8a|freckles
갯바위메기|catfish|#8a8070|#5a5448|mottled
하늘놀래기|slim|#7ac8ff|#ffffff|sidestripe
모래시계고기|round|#f0d890|#c8783a|bands
분홍새우고기|slim|#ffa8a0|#ffffff|bands
잔디가자미|flat|#8ac860|#4a8a3a|mottled
바나나고기|slim|#ffe050|#c8a020|plain
수박복|puffer|#4aa850|#ff5a6a|stripes
조가비돔|carp|#f8e0e8|#e8a0c0|freckles
만조문어|octopus|#ffa070|#fff0d0|freckles
민들레고기|round|#fff070|#ffffff|plain`,
    r: `아기등껍질고기|round|#8ac870|#5a8a3a|patches|shell
해초꼬리해룡|seahorse|#5ab860|#c8e890|plain|leaves leaftail
모래성복어|puffer|#e8cc88|#b8945a|freckles|tower
불가사리가자미|flat|#e8d0a0|#ff7a4a|plain|starmark
야자잎고기|slim|#3a9a5a|#a8e070|stripes|leaves
소라집고기|round|#ffb890|#fff0d8|plain|conch
햇살돔|carp|#ffe050|#ff9a30|stripes|petalcrest:#ffb030
물결무늬가오리|ray|#7ad0f0|#ffffff|stripes
조약돌망둑|round|#a8a098|#e8e0d8|spots
해파리우산고기|round|#8ad8f0|#ffffff|plain|umbrella`,
    v: `꽃등거북|turtle|#6ab870|#ff9ac8|patches|garden
무지개비늘거북|turtle|#6ad0c0|#ff8ac0|rainbow
해마기사|seahorse|#5a7ab8|#c8d0e0|plain|plates:#c8d0e0 helmet
장수거북할아버지|turtle|#5a7a5a|#e8f0e0|mottled|whisk leaves
듀공아기|whale|#c8c0b8|#f0ece8|plain
산호뿔바다소|whale|#a8b0b8|#ff7a8a|plain|unicorn:#ff7a8a`,
    l: `해돋이돌고래|slim|#ff8a3a|#ff6aa8|plain
황금투구게|flat|#c89a30|#ffe060|plain
흰수염바다소|whale|#f4f4f8|#c8d8e8|plain|whisk`,
    m: `섬거북|turtle|#5a8a5a|#e8d8a0|mottled|island`,
  },
];

const SIZE: Record<Rarity, [number, number]> = { common: [20, 45], rare: [45, 90], veryRare: [100, 200], legendary: [220, 380], mythic: [450, 700] };
const SPEED: Record<Rarity, number> = { common: 2.8, rare: 3.0, veryRare: 3.6, legendary: 3.2, mythic: 3.6 };
const SKIT: Record<Rarity, number> = { common: 8, rare: 12, veryRare: 16, legendary: 20, mythic: 24 };
// 도감·가방의 2D 그림(아직 못 잡은 그림자)에 쓰는 체형: 그림이 없는 체형은 비슷한 것으로 바꾼다
const ICON_BODY: Record<string, string> = { ribbon: "eel", octopus: "squid", jelly: "squid", turtle: "puffer", seahorse: "eel", snakehead: "catfish" };

// 일반 물고기에도 구역마다 정해진 특색 부품을 하나씩 돌려 가며 붙인다(직접 정한 부품이 없을 때). 납작하거나 다리가 많은 체형에는 어디에 붙여도 어울리는 것만 쓴다
const THEME: string[][] = [
  ["petalcrest", "coral", "dots:#ffffff", "mane", "petals", "coral"],
  ["bands:#ffd060", "wreath", "runes", "plates:#f0e8d8", "coins", "helmet"],
  ["barnacles", "patch", "plates:#8a4a2a", "sail:#d8c8a0", "chain", "hook"],
  ["gems", "crystals", "coins", "spikes:#d8d0f0", "gems", "crystals"],
  ["dots", "lantern", "fangs dots", "bigeye", "glassy dots", "dots"],
  ["leaftail", "leaves", "starmark", "shell", "petalcrest:#ffe050", "leaves"],
];
const ANY_BODY = ["coral", "dots", "dots:#ffffff", "gems", "crystals", "barnacles", "runes", "coins", "leaves", "starmark", "glassy dots"];
const ODD = ["flat", "ray", "squid", "octopus", "ribbon"];

export const ZONE_SPECIES: Record<number, UwSpecies[]> = {};
ZONES.forEach((tiers, zone) => {
  let n = 0;
  ZONE_SPECIES[zone] = (Object.keys(RARITY) as Tier[]).flatMap((tier) => tiers[tier].trim().split("\n").map((line) => {
    const [name, body, base, accent, pattern, feats] = line.trim().split("|");
    const theme = ODD.includes(body) ? THEME[zone].filter((f) => ANY_BODY.includes(f)) : THEME[zone];
    const rarity = RARITY[tier], features = (feats ?? (tier === "c" ? theme[n % theme.length] : "")).split(" ").filter(Boolean);
    return {
      id: `uw-${zone}-${String(++n).padStart(2, "0")}`, name, body: ICON_BODY[body] ?? body, rarity, sizeCm: SIZE[rarity], speed: SPEED[rarity] * (body === "turtle" || body === "jelly" || body === "seahorse" ? 0.7 : 1), skittish: SKIT[rarity],
      look: { base, accent, pattern, body, features, glow: features.includes("glow") },
    };
  }));
  registerUwSpecies(ZONE_SPECIES[zone]);
});
