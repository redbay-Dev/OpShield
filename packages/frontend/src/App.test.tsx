import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { App } from "./App.js";

describe("App", () => {
  it("renders OpShield heading", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByText("OpShield")).toBeInTheDocument();
  });
});
