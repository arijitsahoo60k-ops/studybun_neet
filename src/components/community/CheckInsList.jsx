import React from "react";
import { ListChecks } from "lucide-react";
import { Card, SectionTitle, EmptyState } from "../ui";
import Mascot from "../Mascot";

const STATUS_LABEL = { planned: "Planned", studying: "Studying", completed: "Completed", partial: "Partial", missed: "Missed" };

export default function CheckInsList({ goals, mascot }) {
  return (
    <Card>
      <SectionTitle icon={ListChecks}>Today's check-ins</SectionTitle>
      {goals.length === 0 ? (
        <EmptyState mascot={mascot} mood="idle" text="You're early." sub="Set your first accountability goal and start studying alongside the community." />
      ) : (
        <div className="sb-checkins-list">
          {goals.map((person) => (
            <div key={person.user_id} className="sb-checkins-row">
              <Mascot species={person.profiles?.mascot || "bunny"} mood="happy" size={30} ambient={false} />
              <div className="sb-checkins-body">
                <div className="sb-checkins-name">{person.profiles?.name || "Study Buddy"}</div>
                <div className="sb-checkins-goals">
                  {person.goals.map((g) => (
                    <div key={g.id} className="sb-checkins-goal-line">
                      <span className="sb-checkins-goal">
                        {g.subject && <strong>{g.subject}{g.chapter ? ` — ${g.chapter}` : ""}</strong>}
                        {g.subject ? " · " : ""}{g.goal_text}
                      </span>
                      <span className={`sb-checkins-status status-${g.status}`}>{STATUS_LABEL[g.status] || g.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
