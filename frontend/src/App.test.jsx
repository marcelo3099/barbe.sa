import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { renderWithProviders } from "./test/renderWithProviders";

describe("App", () => {
  it("mostra o logo como link", () => {
    renderWithProviders(<App />);
    expect(screen.getByRole("link", { name: "Barber Time" })).toBeInTheDocument();
  });
});
