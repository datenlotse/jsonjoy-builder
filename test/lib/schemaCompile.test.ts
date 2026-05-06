import assert from "node:assert";
import { describe, test } from "node:test";
import Ajv from "ajv";
import { compileDependentEnums } from "../../src/lib/schemaCompile.ts";

describe("compileDependentEnums", () => {
  test("compiles dependent enum chains", () => {
    const schema = {
      type: "object" as const,
      properties: {
        category: { type: "string" as const, enum: ["a", "b"] },
        subtype: {
          type: "string" as const,
          $dependentEnum: {
            property: "category",
            values: {
              a: ["x", "y"],
              b: ["z"],
            },
          },
        },
        variant: {
          type: "number" as const,
          $dependentEnum: {
            property: "subtype",
            values: {
              x: [1],
              y: [2],
              z: [3],
            },
          },
        },
      },
      required: ["category", "subtype", "variant"],
    };

    const compiled = compileDependentEnums(schema);
    const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    const validate = ajv.compile(compiled);

    assert.equal(validate({ category: "a", subtype: "x", variant: 1 }), true);
    assert.equal(validate({ category: "a", subtype: "x", variant: 2 }), false);
    assert.equal(validate({ category: "b", subtype: "z", variant: 3 }), true);
    assert.equal(validate({ category: "b", subtype: "x", variant: 1 }), false);
  });

  test("compiles multiple dependent enums on same controller", () => {
    const schema = {
      type: "object" as const,
      properties: {
        category: { type: "string" as const, enum: ["A", "B"] },
        size: {
          type: "string" as const,
          $dependentEnum: {
            property: "category",
            values: {
              A: ["S"],
              B: ["L"],
            },
          },
        },
        color: {
          type: "string" as const,
          $dependentEnum: {
            property: "category",
            values: {
              A: ["red"],
              B: ["blue"],
            },
          },
        },
      },
      required: ["category", "size", "color"],
    };

    const compiled = compileDependentEnums(schema);
    const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    const validate = ajv.compile(compiled);

    assert.equal(validate({ category: "A", size: "S", color: "red" }), true);
    assert.equal(validate({ category: "A", size: "S", color: "blue" }), false);
    assert.equal(validate({ category: "B", size: "L", color: "blue" }), true);
    assert.equal(validate({ category: "B", size: "S", color: "blue" }), false);
  });
});
