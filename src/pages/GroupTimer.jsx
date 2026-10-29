import React, { useEffect, useState } from "react";
import Mascot from "../components/Mascot";
import GroupLobby from "../components/groupTimer/GroupLobby";
import GroupRoom from "../components/groupTimer/GroupRoom";
import GroupTimerStyle from "../styles/GroupTimerStyle";
import { useStudyGroups } from "../hooks/useStudyGroups";
import { useRoleIds } from "../hooks/useRoleIds";
import { loadGtSettings, saveGtSettings } from "../lib/groupTimer";

/**
 * Group Timer page. `groupRoom` (from useGroupTimerRoom, mounted in App.jsx)
 * owns which room I'm in + presence; `focusTimer` is the one normal Focus
 * Timer, so a "group" session is an individual session that the room can see
 * and that counts in study hours like any other.
 */
export default function GroupTimerPage(p) {
  const t = p.focusTimer;
  const g = p.groupRoom;
  const group = g.activeGroup;

  const groups = useStudyGroups({ userId: p.userId, enabled: !group && !g.restoring });
  const roles = useRoleIds();
  const isMod = !!(roles.founderIds?.has(p.userId) || roles.moderatorIds?.has(p.userId));

  const [settings, setSettings] = useState(loadGtSettings);
  const updateSettings = (next) => { setSettings(next); saveGtSettings(next); };

  // lobby <-> room is a sub-view swap, not a page nav, so reset scroll here.
  useEffect(() => {
    const main = document.querySelector(".sb-main");
    if (main) main.scrollTop = 0;
  }, [group?.id]);

  const back = () => {
    if (t.sessionActive && !t.askDone && group) {
      p.showToast?.(`Left ${group.name} — your timer keeps running on its own 🐰`);
    }
    g.leaveRoom();
  };

  const leaveGroup = async () => {
    const res = await groups.leaveGroup(group.id);
    if (res.error) return res;
    p.showToast?.(`You left ${group.name}`);
    g.leaveRoom();
    return res;
  };
  const deleteGroup = async () => {
    const res = await groups.deleteGroup(group.id);
    if (res.error) return res;
    p.showToast?.(`${group.name} was deleted`);
    g.leaveRoom();
    return res;
  };

  return (
    <div className="sb-page sb-gt-page">
      <GroupTimerStyle />
      {g.restoring ? (
        <div className="sb-gt-loading">
          <Mascot species={p.mascot} mood="studying" size={52} />
          <p>Joining your room…</p>
        </div>
      ) : group ? (
        <GroupRoom
          group={group}
          userId={p.userId}
          mascot={p.mascot}
          myName={p.profile?.name || "You"}
          canDelete={group.created_by === p.userId || isMod}
          isHost={group.created_by === p.userId || isMod}
          settings={settings}
          onSettingsChange={updateSettings}
          timer={t}
          room={g}
          addSession={p.addSession}
          onBack={back}
          onLeaveGroup={leaveGroup}
          onDeleteGroup={deleteGroup}
        />
      ) : (
        <GroupLobby
          groups={groups}
          canMakePublic={isMod}
          finishedSessionWaiting={t.askDone}
          onOpenFocusTimer={() => p.setPage("timer")}
          onEnter={g.enterRoom}
          notice={g.notice}
          onDismissNotice={g.clearNotice}
        />
      )}
    </div>
  );
}
