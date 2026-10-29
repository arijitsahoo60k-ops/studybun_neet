import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { linkify } from "../lib/linkify";
import LinkifiedText from "../components/community/LinkifiedText";
import ChatMessage from "../components/community/ChatMessage";

const links = (s) => linkify(s).filter((p) => p.type === "link");
const roundTrip = (s) => linkify(s).map((p) => p.text).join("");

describe("linkify", () => {
  it("returns plain text untouched", () => {
    expect(linkify("hello world")).toEqual([{ type: "text", text: "hello world" }]);
    expect(linkify("")).toEqual([{ type: "text", text: "" }]);
    expect(linkify(null)).toEqual([{ type: "text", text: "" }]);
  });

  it("detects http, https and www links", () => {
    expect(links("see https://example.com/a?b=1#c ok")[0].href).toBe("https://example.com/a?b=1#c");
    expect(links("http://example.com")[0].href).toBe("http://example.com/");
    expect(links("go www.example.com/x")[0].href).toBe("https://www.example.com/x");
    expect(links("HTTPS://Example.com")[0].href).toBe("https://example.com/");
  });

  it("keeps sentence punctuation out of the link", () => {
    expect(links("check https://example.com.")[0].text).toBe("https://example.com");
    expect(links("is it https://example.com/a?")[0].text).toBe("https://example.com/a");
    expect(links("(https://example.com/a)")[0].text).toBe("https://example.com/a");
    expect(links("https://example.com/a, then")[0].text).toBe("https://example.com/a");
    expect(links("\"https://example.com\"")[0].text).toBe("https://example.com");
  });

  it("keeps balanced brackets that belong to the URL", () => {
    expect(links("https://en.wikipedia.org/wiki/Foo_(bar)")[0].text).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("handles several links and newlines, preserving every character", () => {
    const s = "a https://one.com\nb www.two.org/x, c\n\nhttp://three.net!";
    expect(links(s).map((l) => l.text)).toEqual(["https://one.com", "www.two.org/x", "http://three.net"]);
    expect(roundTrip(s)).toBe(s);
  });

  it("never links unsafe or non-URL text", () => {
    expect(links("javascript:alert(1)")).toHaveLength(0);
    expect(links("data:text/html,<b>x</b>")).toHaveLength(0);
    expect(links("example.com")).toHaveLength(0);
    expect(links("e.g. v2.0 or file.pdf")).toHaveLength(0);
    expect(links("https://")).toHaveLength(0);
    expect(links("https://localhost:3000")).toHaveLength(0);
    expect(links("foohttps://example.com")).toHaveLength(0);
    expect(links("a.www.example.com")).toHaveLength(0);
    expect(links("mail me@www.example.com")).toHaveLength(0);
  });

  it("handles Hindi/CJK punctuation, emoji and zero-width chars after a URL", () => {
    expect(links("देखो https://example.com/a\u0964")[0].text).toBe("https://example.com/a");
    expect(links("https://example.com/a\u3002")[0].text).toBe("https://example.com/a");
    expect(links("https://example.com/a\u{1F600}")[0].text).toBe("https://example.com/a");
    expect(links("https://example.com/a\u200Bmore")[0].text).toBe("https://example.com/a");
  });

  it("rejects spoofable credential URLs", () => {
    expect(links("https://google.com@evil.com/x")).toHaveLength(0);
    expect(links("https://user:pw@example.com")).toHaveLength(0);
  });

  it("links https right after an ellipsis or dash, but not mid-word", () => {
    expect(links("...https://example.com")).toHaveLength(1);
    expect(links("-https://example.com")).toHaveLength(1);
    expect(links("abchttps://example.com")).toHaveLength(0);
  });

  it("round-trips arbitrary text exactly", () => {
    for (const s of ["", " ", "x https://a.b ", "https://a.b\thttps://c.d", "😀 www.a.io 😀", "((https://a.b))", "https://a.com\u{1F600}x", "https://a.com\u200Bx"]) {
      expect(roundTrip(s)).toBe(s);
    }
  });
});

describe("<LinkifiedText>", () => {
  it("renders safe external anchors", () => {
    render(<div><LinkifiedText text={"hi https://example.com/x."} /></div>);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("href", "https://example.com/x");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.getAttribute("rel")).toContain("noreferrer");
    expect(a.parentElement.textContent).toBe("hi https://example.com/x.");
  });

  it("renders plain text with no wrapper element", () => {
    const { container } = render(<div><LinkifiedText text="just text" /></div>);
    expect(container.firstChild.innerHTML).toBe("just text");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not execute markup in text", () => {
    const { container } = render(<div><LinkifiedText text={"<img src=x onerror=alert(1)> https://a.io"} /></div>);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("<ChatMessage> links", () => {
  const base = { id: "m1", user_id: "u2", content: "read https://example.com/notes now", created_at: new Date().toISOString(), profiles: { name: "Sam", mascot: "bunny" } };

  it("renders a clickable link and clicking it does not toggle the action bar", () => {
    const { container } = render(<ChatMessage message={base} isOwn={false} onReply={vi.fn()} onDelete={vi.fn()} onJumpToReply={vi.fn()} />);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("href", "https://example.com/notes");
    fireEvent.click(a);
    expect(container.querySelector(".sb-chat-msg.active")).toBeNull();
    // clicking plain text still toggles as before
    fireEvent.click(container.querySelector(".sb-chat-msg-content"));
    expect(container.querySelector(".sb-chat-msg.active")).not.toBeNull();
  });

  it("plain messages render exactly as before", () => {
    const { container } = render(<ChatMessage message={{ ...base, content: "no links here" }} isOwn onReply={vi.fn()} onDelete={vi.fn()} onJumpToReply={vi.fn()} />);
    expect(container.querySelector(".sb-chat-msg-content").innerHTML).toBe("no links here");
  });
});
