import { useCallback, useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import type { PlayerProfile } from "@fishing/shared";
import { initAudio, sfx } from "./audio";
import { api, auth, colyseus, roomFromUrl } from "./net";
import { Lobby } from "./ui/Lobby";
import { RoomScreen } from "./ui/RoomScreen";
import { kakaoConfigured, kakaoLogin, kakaoSession } from "./kakao";

export interface Joined {
  room: Room<any>;
  mapId: string;
}

// Lobby가 캐릭터 만들기 화면을 여는 조건과 같다
const isNewbie = (p: PlayerProfile) => p.nickname === "낚시꾼" && p.titles.length === 0 && p.claimedRewards.length === 0;

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [pendingRoom, setPendingRoom] = useState<string | null>(roomFromUrl());

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await api<PlayerProfile>("/api/me"));
    } catch (e) {
      auth.token = null;
      setProfile(null);
      setError(e instanceof Error ? e.message : "");
    }
  }, []);

  // 처음 열면: 카카오 로그인에서 돌아온 경우와 이미 로그인한 경우를 처리한다
  useEffect(() => {
    (async () => {
      const token = await kakaoSession();
      if (token) auth.token = token;
      if (auth.token) await loadProfile();
      setBusy(false);
    })();
  }, [loadProfile]);

  const enter = async (make: () => Promise<Room<any>>, mapId: string) => {
    initAudio();
    setError("");
    try {
      const room = await make();
      setJoined({ room, mapId: mapId || (room.state as any)?.mapId || "lake" });
      setPendingRoom(null);
      history.replaceState(null, "", location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방에 들어가지 못했어요");
      setPendingRoom(null);
      history.replaceState(null, "", location.pathname);
    }
  };

  const createRoom = (map: string) => enter(() => colyseus.create("fishing", { map, token: auth.token }), map);
  const joinRoom = (code: string) =>
    enter(async () => {
      const room = await colyseus.joinById(code.trim().toUpperCase(), { token: auth.token });
      // 들어온 방의 맵은 방 상태에 들어 있다(첫 상태가 오기 전이면 기다린다). 비워 두면 호수 맵으로 그려져 버린다
      if (!(room.state as any)?.mapId) await new Promise<void>((ok) => room.onStateChange.once(() => ok()));
      return room;
    }, "");

  // 초대 링크로 들어왔고 이미 로그인되어 있으면 바로 입장
  useEffect(() => {
    // 처음 가입한 사람은 로비에서 닉네임·꾸미기를 마친 뒤(닉네임이 바뀐 뒤)에 들어간다
    if (profile && pendingRoom && !joined && !isNewbie(profile)) void joinRoom(pendingRoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pendingRoom]);

  if (busy) return <div className="login"><div className="logo">퐁당</div></div>;

  if (!profile) return <Login onDone={loadProfile} invite={pendingRoom} error={error} />;

  if (joined) {
    return (
      <RoomScreen
        joined={joined}
        profile={profile}
        reload={loadProfile}
        onLeave={async () => {
          setJoined(null);
          await loadProfile();
        }}
        onRejoin={(room) => setJoined({ room, mapId: joined.mapId })}
      />
    );
  }

  return (
    <Lobby
      profile={profile}
      reload={loadProfile}
      onCreate={createRoom}
      onJoin={joinRoom}
      error={error}
      onLogout={() => {
        auth.token = null;
        setProfile(null);
      }}
    />
  );
}

function Login({ onDone, invite, error }: { onDone: () => Promise<void>; invite: string | null; error: string }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState(error);

  return (
    <div className="login">
      <div className="card panel">
        <h1 className="logo">
          퐁당
          <small>친구들과 함께 떠나는 3D 낚시 여행</small>
        </h1>
        {invite && <p className="hint">초대받았어요! 로그인 후 캐릭터를 꾸미면 <b>{invite}</b> 방으로 들어가요.</p>}
        <div className="stack">
          <button
            className="btn kakao"
            onClick={() => {
              sfx.click();
              if (!kakaoConfigured) setMsg("카카오 로그인 키가 아직 설정되지 않았어요. 아래 개발용 로그인을 써 주세요.");
              else void kakaoLogin();
            }}
          >
            카카오로 시작하기
          </button>
          {/* 개발용 로그인: 카카오가 연결된 배포 화면에서는 숨긴다(내 컴퓨터에서 개발할 때와 카카오 키가 없을 때만 보인다) */}
          {(import.meta.env.DEV || !kakaoConfigured) && (
            <>
            <div className="hint">개발용 로그인 (카카오 연결 전 임시)</div>
            <input
              className="field"
              placeholder="아이디를 입력해요"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && go()}
            />
            <button className="btn mint" disabled={!name.trim()} onClick={go}>
              들어가기
            </button>
            </>
          )}
          <div className="err">{msg}</div>
        </div>
      </div>
    </div>
  );

  function go() {
    auth.token = `dev:${name.trim()}`;
    void onDone();
  }
}
