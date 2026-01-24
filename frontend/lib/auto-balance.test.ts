/**
 * Unit tests for auto-balance utility functions
 * Feature: 004-journal-auto-balance
 */

import {
  isEmptyAmount,
  groupBy,
  validateBalance,
  calculateAutoBalance,
} from "../src/lib/auto-balance";
import type { JournalLineFormState } from "../src/types/auto-balance";

describe("isEmptyAmount", () => {
  it("returns true for null", () => {
    expect(isEmptyAmount(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isEmptyAmount(undefined)).toBe(true);
  });

  it("returns true for zero", () => {
    expect(isEmptyAmount(0)).toBe(true);
  });

  it("returns false for positive numbers", () => {
    expect(isEmptyAmount(100)).toBe(false);
    expect(isEmptyAmount(0.01)).toBe(false);
  });

  it("returns false for negative numbers (they have accounting meaning)", () => {
    expect(isEmptyAmount(-100)).toBe(false);
    expect(isEmptyAmount(-0.01)).toBe(false);
  });
});

describe("groupBy", () => {
  it("groups items by string key", () => {
    const items = [
      { name: "a", category: "fruit" },
      { name: "b", category: "vegetable" },
      { name: "c", category: "fruit" },
    ];

    const result = groupBy(items, (item) => item.category);

    expect(result.fruit).toHaveLength(2);
    expect(result.vegetable).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = groupBy<{ id: number }>([], (item) => String(item.id));
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles single item", () => {
    const items = [{ id: 1, category: "test" }];
    const result = groupBy(items, (item) => item.category);
    expect(result.test).toHaveLength(1);
  });
});

describe("validateBalance", () => {
  it("returns empty array for balanced single currency", () => {
    const lines: JournalLineFormState[] = [
      { account_id: "1", amount: 1000, currency: "USD", tags: [] },
      { account_id: "2", amount: -1000, currency: "USD", tags: [] },
    ];

    expect(validateBalance(lines)).toHaveLength(0);
  });

  it("returns error for unbalanced single currency", () => {
    const lines: JournalLineFormState[] = [
      { account_id: "1", amount: 1000, currency: "USD", tags: [] },
      { account_id: "2", amount: -500, currency: "USD", tags: [] },
    ];

    const errors = validateBalance(lines);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("USD");
    expect(errors[0]).toContain("500");
  });

  it("validates each currency group separately", () => {
    const lines: JournalLineFormState[] = [
      { account_id: "1", amount: 1000, currency: "USD", tags: [] },
      { account_id: "2", amount: -1000, currency: "USD", tags: [] },
      { account_id: "3", amount: 600, currency: "CNY", tags: [] },
      { account_id: "4", amount: -500, currency: "CNY", tags: [] },
    ];

    const errors = validateBalance(lines);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("CNY");
  });

  it("handles empty lines array", () => {
    const errors = validateBalance([]);
    expect(errors).toHaveLength(0);
  });

  it("handles lines with null/undefined amounts", () => {
    const lines: JournalLineFormState[] = [
      { account_id: "1", amount: 1000, currency: "USD", tags: [] },
      { account_id: "2", amount: null, currency: "USD", tags: [] },
    ];

    // null amounts are treated as 0 in validation
    const errors = validateBalance(lines);
    expect(errors).toHaveLength(1);
  });
});

describe("calculateAutoBalance", () => {
  describe("precondition validation", () => {
    it("returns error for less than 2 lines", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("At least 2 lines required for auto-balance");
    });

    it("returns error when no lines are empty", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
        { account_id: "2", amount: -1000, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Exactly one line must have an empty amount");
    });

    it("returns error when multiple lines are empty", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
        { account_id: "2", amount: null, currency: "USD", tags: [] },
        { account_id: "3", amount: undefined, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(false);
      expect(result.errors).toContain("Exactly one line must have an empty amount");
    });
  });

  describe("single currency auto-balance", () => {
    it("fills empty line with negative sum (3 lines)", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
        { account_id: "2", amount: 1000, currency: "USD", tags: [] },
        { account_id: "3", amount: null, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[2].amount).toBe(-2000);
    });

    it("fills empty line with negative sum (2 lines)", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 500, currency: "USD", tags: [] },
        { account_id: "2", amount: undefined, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[1].amount).toBe(-500);
    });

    it("fills empty line with negative sum (zero amount treated as empty)", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 100, currency: "USD", tags: [] },
        { account_id: "2", amount: 200, currency: "USD", tags: [] },
        { account_id: "3", amount: 50, currency: "USD", tags: [] },
        { account_id: "4", amount: null, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[3].amount).toBe(-350);
    });

    it("preserves all other line attributes", () => {
      const lines: JournalLineFormState[] = [
        {
          account_id: "1",
          amount: 1000,
          currency: "USD",
          tags: ["tag1", "tag2"],
          remarks: "Test remark",
        },
        {
          account_id: "2",
          amount: null,
          currency: "USD",
          tags: ["tag3"],
          remarks: "Another remark",
        },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[0].tags).toEqual(["tag1", "tag2"]);
      expect(result.lines[0].remarks).toBe("Test remark");
      expect(result.lines[1].tags).toEqual(["tag3"]);
      expect(result.lines[1].remarks).toBe("Another remark");
    });
  });

  describe("multi-currency auto-balance", () => {
    it("fills empty line and creates new line for other currency", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
        { account_id: "2", amount: null, currency: "USD", tags: [] },
        { account_id: "3", amount: -600, currency: "CNY", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      // Empty USD line filled
      expect(result.lines[1].amount).toBe(-1000);
      // New CNY line created
      const newCnyLine = result.lines.find(
        (line) => line.currency === "CNY" && line.isNew
      );
      expect(newCnyLine).toBeDefined();
      expect(newCnyLine?.amount).toBe(600);
      expect(newCnyLine?.account_id).toBe("2"); // Same as empty line
    });

    it("creates one new line per additional currency", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 1000, currency: "USD", tags: [] },
        { account_id: "2", amount: null, currency: "USD", tags: [] },
        { account_id: "3", amount: -500, currency: "CNY", tags: [] },
        { account_id: "4", amount: -300, currency: "EUR", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);

      // Check all currency groups balance
      const usdSum = result.lines
        .filter((l) => l.currency === "USD")
        .reduce((sum, l) => sum + (l.amount || 0), 0);
      const cnySum = result.lines
        .filter((l) => l.currency === "CNY")
        .reduce((sum, l) => sum + (l.amount || 0), 0);
      const eurSum = result.lines
        .filter((l) => l.currency === "EUR")
        .reduce((sum, l) => sum + (l.amount || 0), 0);

      expect(Math.abs(usdSum)).toBeLessThan(0.0001);
      expect(Math.abs(cnySum)).toBeLessThan(0.0001);
      expect(Math.abs(eurSum)).toBeLessThan(0.0001);
    });
  });

  describe("edge cases", () => {
    it("handles negative amounts correctly", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: -500, currency: "USD", tags: [] },
        { account_id: "2", amount: null, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[1].amount).toBe(500);
    });

    it("handles decimal amounts correctly", () => {
      const lines: JournalLineFormState[] = [
        { account_id: "1", amount: 123.45, currency: "USD", tags: [] },
        { account_id: "2", amount: 67.89, currency: "USD", tags: [] },
        { account_id: "3", amount: null, currency: "USD", tags: [] },
      ];

      const result = calculateAutoBalance(lines);
      expect(result.success).toBe(true);
      expect(result.lines[2].amount).toBe(-191.34);
    });
  });
});
