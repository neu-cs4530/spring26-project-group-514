import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotificationBadge from "../../src/components/NotificationBadge.tsx";

describe("NotificationBadge component", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the count when greater than 0", () => {
    render(<NotificationBadge count={5} />);
    expect(screen.getByText("5")).not.toBeNull();
  });

  it("renders exactly '99' when the count is 99", () => {
    // edge case mayeb idkfs?
    render(<NotificationBadge count={99} />);
    expect(screen.getByText("99")).not.toBeNull();
  });

  it("renders '99+' when the count exceeds 99", () => {
    render(<NotificationBadge count={100} />);
    expect(screen.getByText("99+")).not.toBeNull();
  });
});
