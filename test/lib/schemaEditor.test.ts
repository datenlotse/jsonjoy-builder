import assert from "node:assert";
import { describe, test } from "node:test";
import {
  getEligibleEnumControllingProperties,
  renameObjectProperty,
} from "../../src/lib/schemaEditor.ts";

describe("renameObjectProperty", () => {
  test("preserves property order when renaming", () => {
    const schema = {
      type: "object" as const,
      properties: {
        firstName: { type: "string" as const },
        lastName: { type: "string" as const },
        email: { type: "string" as const },
      },
      required: ["firstName", "lastName", "email"],
    };

    const result = renameObjectProperty(schema, "lastName", "surname");

    const keys = Object.keys(result.properties);
    assert.deepStrictEqual(keys, ["firstName", "surname", "email"]);
    assert.deepStrictEqual(result.required, ["firstName", "surname", "email"]);
  });
});

describe("getEligibleEnumControllingProperties", () => {
  test("includes enum and const controllers", () => {
    const parentSchema = {
      type: "object" as const,
      properties: {
        category: { type: "string" as const, enum: ["a", "b"] },
        fixed: { type: "string" as const, const: "only" },
        target: { type: "string" as const },
      },
    };

    const result = getEligibleEnumControllingProperties(parentSchema, "target");

    assert.deepStrictEqual(result, [
      { name: "category", values: ["a", "b"] },
      { name: "fixed", values: ["only"] },
    ]);
  });

  test("includes dependent enum controllers with deduplicated values", () => {
    const parentSchema = {
      type: "object" as const,
      properties: {
        subtype: {
          type: "string" as const,
          $dependentEnum: {
            property: "category",
            values: {
              a: ["x", "y"],
              b: ["y", "z"],
            },
          },
        },
        target: { type: "string" as const },
      },
    };

    const result = getEligibleEnumControllingProperties(parentSchema, "target");

    assert.deepStrictEqual(result, [{ name: "subtype", values: ["x", "y", "z"] }]);
  });

  test("prevents selecting controllers that create a cycle", () => {
    const parentSchema = {
      type: "object" as const,
      properties: {
        fieldA: {
          type: "string" as const,
          $dependentEnum: { property: "fieldB", values: { one: ["a"] } },
        },
        fieldB: {
          type: "string" as const,
          enum: ["one", "two"],
        },
      },
    };

    const result = getEligibleEnumControllingProperties(parentSchema, "fieldB");
    assert.deepStrictEqual(result, []);
  });
});
