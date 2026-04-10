import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewDirectMessage from "../../src/components/NewDirectMessage.tsx";

const handleMessageCreation = vi.fn();

describe("NewDirectMessage component", () => {
  beforeEach(() => {
    handleMessageCreation.mockReset();
  });

  it("triggers the handler when the form is submitted", () => {
    const { container } = render(
      <NewDirectMessage handleMessageCreation={handleMessageCreation} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello!" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(handleMessageCreation).toHaveBeenCalledExactlyOnceWith("Hello!");
  });

  it("triggers the handler when Enter is pressed", () => {
    render(<NewDirectMessage handleMessageCreation={handleMessageCreation} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello!" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", code: "Enter", charCode: 13 });
    expect(handleMessageCreation).toHaveBeenCalledExactlyOnceWith("Hello!");
  });

  it("does not trigger the handler when Enter is pressed with Shift held", () => {
    render(<NewDirectMessage handleMessageCreation={handleMessageCreation} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello!" } });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
      shiftKey: true,
    });
    expect(handleMessageCreation).not.toHaveBeenCalled();
  });

  it("does not trigger the handler when the message is empty or whitespace only", () => {
    const { container } = render(
      <NewDirectMessage handleMessageCreation={handleMessageCreation} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.submit(container.querySelector("form")!);
    expect(handleMessageCreation).not.toHaveBeenCalled();
  });
});

//emojis!
it("appends a selected emoji to the message text", () => {
  render(<NewDirectMessage handleMessageCreation={handleMessageCreation} />);
  fireEvent.click(screen.getByRole("button", { name: /open emoji picker/i }));
  fireEvent.click(screen.getByRole("button", { name: "😂" }));
  expect(screen.getByDisplayValue("😂")).not.toBeNull();
});
