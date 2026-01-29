import type { JSONSchema, ObjectJSONSchema } from "../types/jsonSchema.ts";
import { copySchema } from "./schemaEditor.ts";
import { isBooleanSchema } from "../types/jsonSchema.ts";

/**
 * Transforms a schema so that any object with a property using $dependentEnum
 * is replaced by a oneOf of object schemas (one branch per controlling value).
 * Result is standard JSON Schema that Ajv can validate.
 */
export function compileDependentEnums(schema: JSONSchema): JSONSchema {
  if (isBooleanSchema(schema)) return schema;

  const transformed = copySchema(schema) as ObjectJSONSchema;
  return transformObject(transformed) as JSONSchema;
}

function transformObject(obj: ObjectJSONSchema): ObjectJSONSchema {
  if (!obj.properties) return obj;

  const props = { ...obj.properties };
  for (const key of Object.keys(props)) {
    const child = props[key];
    if (typeof child === "object" && child !== null) {
      props[key] = transformSchema(child) as ObjectJSONSchema;
    }
  }

  const dependentProp = Object.entries(props).find(
    ([, s]) =>
      typeof s === "object" &&
      s !== null &&
      "$dependentEnum" in s &&
      (s as ObjectJSONSchema & { $dependentEnum?: unknown }).$dependentEnum != null,
  );

  if (!dependentProp) {
    return { ...obj, properties: props };
  }

  const [propName, propSchema] = dependentProp;
  const dep = (propSchema as ObjectJSONSchema & { $dependentEnum?: { property: string; values: Record<string, unknown[]> } }).$dependentEnum;
  if (!dep) return { ...obj, properties: props };

  const controllingName = dep.property;
  const valuesMap = dep.values;
  const controllingValues = Object.keys(valuesMap);

  const oneOfBranches: ObjectJSONSchema[] = controllingValues.map(
    (ctrlValue) => {
      const branchProps = { ...props };
      const controllingSchema = branchProps[controllingName];
      if (typeof controllingSchema === "object" && controllingSchema !== null) {
        branchProps[controllingName] = { ...controllingSchema, const: ctrlValue };
      } else {
        branchProps[controllingName] = { const: ctrlValue };
      }

      const dependentSchema = branchProps[propName];
      if (typeof dependentSchema === "object" && dependentSchema !== null) {
        const { $dependentEnum: _d, ...rest } = dependentSchema as ObjectJSONSchema & { $dependentEnum?: unknown };
        branchProps[propName] = { ...rest, enum: valuesMap[ctrlValue] ?? [] };
      }

      return {
        type: "object" as const,
        properties: branchProps,
        required: obj.required,
        $propertyOrder: obj.$propertyOrder,
      };
    },
  );

  return {
    ...(obj.$schema && { $schema: obj.$schema }),
    ...(obj.$id && { $id: obj.$id }),
    type: "object",
    oneOf: oneOfBranches,
  };
}

function transformSchema(schema: JSONSchema): JSONSchema {
  if (isBooleanSchema(schema)) return schema;
  const obj = schema as ObjectJSONSchema;

  if (obj.properties) {
    return transformObject(obj);
  }

  if (obj.items && typeof obj.items === "object") {
    return { ...obj, items: transformSchema(obj.items) };
  }
  if (obj.prefixItems && Array.isArray(obj.prefixItems)) {
    return {
      ...obj,
      prefixItems: obj.prefixItems.map((s) => transformSchema(s)),
    };
  }
  if (obj.additionalProperties && typeof obj.additionalProperties === "object") {
    return {
      ...obj,
      additionalProperties: transformSchema(obj.additionalProperties),
    };
  }
  if (obj.oneOf && Array.isArray(obj.oneOf)) {
    return { ...obj, oneOf: obj.oneOf.map(transformSchema) };
  }
  if (obj.anyOf && Array.isArray(obj.anyOf)) {
    return { ...obj, anyOf: obj.anyOf.map(transformSchema) };
  }
  if (obj.allOf && Array.isArray(obj.allOf)) {
    return { ...obj, allOf: obj.allOf.map(transformSchema) };
  }
  if (obj.if && typeof obj.if === "object") {
    return {
      ...obj,
      if: transformSchema(obj.if),
      then: obj.then ? transformSchema(obj.then) : undefined,
      else: obj.else ? transformSchema(obj.else) : undefined,
    };
  }
  if (obj.$defs) {
    const defs: Record<string, JSONSchema> = {};
    for (const k of Object.keys(obj.$defs)) {
      defs[k] = transformSchema(obj.$defs[k]);
    }
    return { ...obj, $defs: defs };
  }

  return obj;
}
