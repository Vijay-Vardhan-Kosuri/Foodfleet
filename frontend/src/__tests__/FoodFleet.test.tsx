import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { OrderTracker } from "../components/orders/OrderTracker";
import { LandingPage } from "../pages/public/LandingPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { RegisterPage } from "../pages/auth/RegisterPage";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  extractApiError: (_e: unknown, f = "Error") => f,
  WS_BASE_URL: "ws://localhost:8000",
}));

describe("FoodFleet Frontend Components & Pages", () => {
  it("renders landing page headline and 5-step workflow", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Good Food\./i)).toBeInTheDocument();
    expect(screen.getByText(/How FoodFleet Works/i)).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("05")).toBeInTheDocument();
  });

  it("renders login and register forms with role selectors", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Sign in to FoodFleet/i)).toBeInTheDocument();

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Create Your Account/i)).toBeInTheDocument();
    expect(screen.getByText("Delivery Fleet")).toBeInTheDocument();
  });

  it("renders 7-step OrderTracker and terminal states", () => {
    const { rerender } = render(<OrderTracker status="PREPARING" />);
    expect(screen.getByText("Preparing")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();

    rerender(<OrderTracker status="CANCELLED" />);
    expect(screen.getByText(/CANCELLED/i)).toBeInTheDocument();
  });
});
