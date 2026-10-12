import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest globals are off, so Testing Library does not auto-clean between tests.
afterEach(cleanup);
