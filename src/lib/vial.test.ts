import { describe, expect, it } from "bun:test";

import { Vial } from "./vial";

describe("Vial", () => {
  it("initializes with empty segments and specified capacity", () => {
    const vial = new Vial(4);
    expect(vial.segments).toEqual([]);
    expect(vial.capacity).toBe(4);
  });

  describe("isEmpty", () => {
    it("returns true for an empty vial", () => {
      const vial = new Vial(4);
      expect(vial.isEmpty()).toBe(true);
    });

    it("returns false for a vial with segments", () => {
      const vial = new Vial(4);
      vial.segments.push("red");
      expect(vial.isEmpty()).toBe(false);
    });
  });

  describe("isFull", () => {
    it("returns true when segments length equals capacity", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "blue", "green");
      expect(vial.isFull()).toBe(true);
    });

    it("returns false when segments length is less than capacity", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "blue");
      expect(vial.isFull()).toBe(false);
    });
  });

  describe("isComplete", () => {
    it("returns true for an empty vial", () => {
      const vial = new Vial(4);
      expect(vial.isComplete()).toBe(true);
    });

    it("returns true for a full vial with all segments of the same color", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "red", "red");
      expect(vial.isComplete()).toBe(true);
    });

    it("returns false for a partially filled vial", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "red");
      expect(vial.isComplete()).toBe(false);
    });

    it("returns false for a full vial with different colors", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "blue", "red");
      expect(vial.isComplete()).toBe(false);
    });
  });

  describe("getTopColor", () => {
    it("returns null for an empty vial", () => {
      const vial = new Vial(4);
      expect(vial.getTopColor()).toBeNull();
    });

    it("returns the top color for a vial with segments", () => {
      const vial = new Vial(4);
      vial.segments.push("red", "blue", "green");
      expect(vial.getTopColor()).toBe("green");
    });
  });

  describe("canReceive", () => {
    it("returns false if the vial is full", () => {
      const vial = new Vial(2);
      vial.segments.push("red", "blue");
      expect(vial.canReceive("red")).toBe(false);
    });

    it("returns true if the vial is empty", () => {
      const vial = new Vial(3);
      expect(vial.canReceive("red")).toBe(true);
    });

    it("returns true if the top color matches the color to receive", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "blue");
      expect(vial.canReceive("blue")).toBe(true);
    });

    it("returns false if the top color doesn't match the color to receive", () => {
      const vial = new Vial(3);
      vial.segments.push("red", "blue");
      expect(vial.canReceive("red")).toBe(false);
    });
  });

  describe("clone", () => {
    it("creates a copy with the same capacity and segments", () => {
      const vial = new Vial(4);
      vial.segments.push("red", "blue", "green");

      const clone = vial.clone();

      expect(clone.capacity).toBe(vial.capacity);
      expect(clone.segments).toEqual(vial.segments);
      expect(clone.segments).not.toBe(vial.segments); // Different arrays
    });

    it("changes to the clone don't affect the original", () => {
      const vial = new Vial(4);
      vial.segments.push("red", "blue");

      const clone = vial.clone();
      clone.segments.push("green");

      expect(vial.segments).toEqual(["red", "blue"]);
      expect(clone.segments).toEqual(["red", "blue", "green"]);
    });
  });
});
