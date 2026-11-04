# 카카오 로그인과 기록 저장 설정 (한 번만 하면 돼요)

게임에서 카카오로 로그인하고, 도감, 인벤토리, 돈을 저장하려면 **Supabase**와 **카카오 개발자** 설정이 필요해요.
이 단계는 계정과 키를 직접 만들어야 해서, 사람이 해야 해요. 코드는 이미 준비되어 있어요.

> 이 저장소는 공개(public)예요. **키와 비밀번호는 절대 GitHub에 올리지 마세요.** `.env` 파일은 이미 올라가지 않게 막혀 있어요.

## 1. Supabase 프로젝트 만들기 (무료)

1. https://supabase.com 에 가입하고 **New project**를 만들어요. (이름: `fishing-gogo`, 지역: 서울이 있으면 서울)
2. 왼쪽 **SQL Editor**를 열고 `server/supabase/schema.sql` 파일의 내용을 전부 붙여 넣어 **Run** 해요. (표 4개가 만들어져요)
3. 왼쪽 **Project Settings → API**에서 아래 세 값을 확인해요.
   - **Project URL** (예: `https://abcd.supabase.co`)
   - **anon public key** (공개되어도 되는 키)
   - **service_role key** (비밀 키. 서버에만 넣어요)

## 2. 카카오 개발자에서 앱 만들기

1. https://developers.kakao.com 에 로그인하고 **내 애플리케이션 → 애플리케이션 추가하기**를 해요.
2. 만든 앱의 **앱 키**에서 **REST API 키**를 복사해요.
3. **제품 설정 → 카카오 로그인**을 **활성화**해요.
4. **Redirect URI**에 Supabase가 알려 주는 주소를 넣어요.
   - Supabase 대시보드 **Authentication → Providers → Kakao**에 보면 `https://<프로젝트>.supabase.co/auth/v1/callback` 같은 **Callback URL**이 있어요. 그걸 그대로 복사해서 카카오의 Redirect URI에 등록해요.
5. **동의항목**에서 **닉네임, 프로필 사진, 이메일은 "사용 안 함"**으로 두세요. (게임은 사용자 고유 번호만 써요.)
6. **보안 → Client Secret**을 만들어서 코드를 복사해요. (활성화 상태로 두세요.)

## 3. Supabase에 카카오 연결하기

Supabase 대시보드 **Authentication → Providers → Kakao**에서
- **Kakao enabled**를 켜고
- **Client ID**에 카카오 **REST API 키**를,
- **Client Secret**에 위에서 만든 **Client Secret 코드**를 붙여 넣고 저장해요.

그리고 **Authentication → URL Configuration**에서
- **Site URL**: 게임 주소 (개발 중에는 `http://localhost:5173`)
- **Redirect URLs**에 `http://localhost:5173` 을 추가해요. (배포하면 배포 주소도 추가)

> 카카오가 이메일 동의를 못 받으면 Supabase가 오류를 낼 수 있어요. 그럴 때는 Supabase 카카오 설정에 이메일이 필수가 아니라는 안내가 있는지 확인하고, 안 되면 알려 주세요.

## 4. 키를 파일에 넣기

`server/.env.example`을 복사해서 **`server/.env`** 를 만들고 채워요.

```
SUPABASE_URL=https://abcd.supabase.co
SUPABASE_ANON_KEY=(anon public key)
SUPABASE_SERVICE_KEY=(service_role key)
ALLOW_DEV_LOGIN=true
```

`client/.env.example`을 복사해서 **`client/.env`** 를 만들고 채워요.

```
VITE_SERVER_URL=http://localhost:2567
VITE_SUPABASE_URL=https://abcd.supabase.co
VITE_SUPABASE_ANON_KEY=(anon public key)
```

서버와 클라이언트를 다시 켜면 **"카카오로 시작하기"** 버튼이 동작해요.

## 5. 카카오톡으로 친구 초대 (선택)

지금은 **초대 링크를 복사**해서 카카오톡에 붙여 넣는 방식이에요.
카카오톡 "공유하기" 창을 바로 띄우려면 카카오 개발자 **JavaScript 키**와 **웹 도메인 등록**이 더 필요해요. 필요해지면 말씀해 주세요.

## 배포할 때 바꿀 것

- 서버의 `ALLOW_DEV_LOGIN=false` 로 바꿔서 개발용 로그인을 꺼요. (안 끄면 누구나 `dev:아무이름`으로 들어올 수 있어요.)
- 카카오와 Supabase의 Redirect URL에 배포 주소를 추가해요.
- 화면은 Vercel, 게임 서버는 Render 같은 곳에 올리고 `VITE_SERVER_URL`을 서버 주소로 바꿔요.
