import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommunityPost from "../components/community/CommunityPost";

const moderation = { canDelete: () => false, report: vi.fn(), blockUser: vi.fn() };
const post = { id: "p1", user_id: "u2", type: "TIP", content: "Great notes: www.example.com/jee.", created_at: new Date().toISOString(), profiles: { name: "Sam", mascot: "bunny" } };

describe("<CommunityPost> links", () => {
  it("linkifies post content and replies", () => {
    render(
      <CommunityPost
        post={post}
        currentUserId="me"
        myProfile={{ name: "Me", mascot: "bunny" }}
        moderation={moderation}
        onToggleReaction={vi.fn()}
        replies={[{ id: "r1", user_id: "u3", content: "thanks https://example.org/x!", created_at: new Date().toISOString(), profiles: { name: "Ann", mascot: "bunny" } }]}
        onLoadReplies={vi.fn()}
        onAddReply={vi.fn()}
        onDelete={vi.fn()}
        onDeleteReply={vi.fn()}
      />
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://www.example.com/jee");
    fireEvent.click(screen.getByText(/\d* ?repl/i));
    const all = screen.getAllByRole("link");
    expect(all).toHaveLength(2);
    expect(all[1]).toHaveAttribute("href", "https://example.org/x");
    expect(all[1].textContent).toBe("https://example.org/x");
  });
});
