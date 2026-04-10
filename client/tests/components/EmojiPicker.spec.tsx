import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmojiPicker from "../../src/components/EmojiPicker.tsx";

const onSelect = vi.fn();

describe("EmojiPicker component", () => {
  beforeEach(() => {
    onSelect.mockReset();
  });

  it("does not show the emoji panel by default", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    expect(screen.queryByRole("button", { name: "😂" })).toBeNull();
  });

  it("shows the emoji panel when the toggle button is clicked", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
    expect(screen.queryByRole("button", { name: "😂" })).not.toBeNull();
  });

  it("calls onSelect with the correct emoji when an emoji is clicked", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
    fireEvent.click(screen.getByRole("button", { name: "😂" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("😂");
  });

  it("closes the panel after an emoji is selected", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
    fireEvent.click(screen.getByRole("button", { name: "😂" }));
    expect(screen.queryByRole("button", { name: "😂" })).toBeNull();
  });

  it("closes the panel when clicking outside", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("button", { name: "😂" })).toBeNull();
  });

  it("switches the emoji grid when a category button is clicked", () => {
    render(<EmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
    fireEvent.click(screen.getByTitle(/Gestures/));
    // "👍" is in the Gestures grid but not a category tab icon
    expect(screen.queryByRole("button", { name: "👍" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "😂" })).toBeNull();
  });
});
