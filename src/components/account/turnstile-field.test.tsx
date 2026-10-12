import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TurnstileField } from "./turnstile-field";

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ siteKey }: { siteKey: string }) => <div data-testid="turnstile">{siteKey}</div>,
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TurnstileField", () => {
  it("renders nothing without a site key", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const { container } = render(<TurnstileField onToken={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the widget when a site key is set", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { getByTestId } = render(<TurnstileField onToken={() => {}} />);
    expect(getByTestId("turnstile")).toHaveTextContent("1x00000000000000000000AA");
  });
});
