import type {
  JSONSchema,
  NewField,
  ObjectJSONSchema,
} from "../types/jsonSchema.ts";
import { isBooleanSchema, isObjectSchema } from "../types/jsonSchema.ts";

export type Property = {
  name: string;
  schema: JSONSchema;
  required: boolean;
};

export function copySchema<T extends JSONSchema>(schema: T): T {
  if (typeof structuredClone === "function") return structuredClone(schema);
  return JSON.parse(JSON.stringify(schema));
}

/**
 * Updates a property in an object schema
 */
export function updateObjectProperty(
  schema: ObjectJSONSchema,
  propertyName: string,
  propertySchema: JSONSchema,
): ObjectJSONSchema {
  if (!isObjectSchema(schema)) return schema;

  const newSchema = copySchema(schema);
  if (!newSchema.properties) {
    newSchema.properties = {};
  }

  const isNewProperty = !(propertyName in newSchema.properties);
  newSchema.properties[propertyName] = propertySchema;

  // Maintain $propertyOrder array
  if (!newSchema.$propertyOrder) {
    newSchema.$propertyOrder = Object.keys(newSchema.properties);
  } else if (isNewProperty && !newSchema.$propertyOrder.includes(propertyName)) {
    newSchema.$propertyOrder.push(propertyName);
  }

  return newSchema;
}

/**
 * Removes a property from an object schema
 */
export function removeObjectProperty(
  schema: ObjectJSONSchema,
  propertyName: string,
): ObjectJSONSchema {
  if (!isObjectSchema(schema) || !schema.properties) return schema;

  const newSchema = copySchema(schema);
  const { [propertyName]: _, ...remainingProps } = newSchema.properties;
  newSchema.properties = remainingProps;

  // Also remove from required array if present
  if (newSchema.required) {
    newSchema.required = newSchema.required.filter(
      (name) => name !== propertyName,
    );
  }

  // Remove from $propertyOrder array if present
  if (newSchema.$propertyOrder) {
    newSchema.$propertyOrder = newSchema.$propertyOrder.filter(
      (name) => name !== propertyName,
    );
  }

  return newSchema;
}

/**
 * Updates the 'required' status of a property
 */
export function updatePropertyRequired(
  schema: ObjectJSONSchema,
  propertyName: string,
  required: boolean,
): ObjectJSONSchema {
  if (!isObjectSchema(schema)) return schema;

  const newSchema = copySchema(schema);
  if (!newSchema.required) {
    newSchema.required = [];
  }

  if (required) {
    // Add to required array if not already there
    if (!newSchema.required.includes(propertyName)) {
      newSchema.required.push(propertyName);
    }
  } else {
    // Remove from required array
    newSchema.required = newSchema.required.filter(
      (name) => name !== propertyName,
    );
  }

  return newSchema;
}

/**
 * Updates an array schema's items
 */
export function updateArrayItems(
  schema: JSONSchema,
  itemsSchema: JSONSchema,
): JSONSchema {
  if (isObjectSchema(schema) && schema.type === "array") {
    return {
      ...schema,
      items: itemsSchema,
    };
  }
  return schema;
}

/**
 * Creates a schema for a new field
 */
export function createFieldSchema(field: NewField): JSONSchema {
  const { type, description, default: defaultValue, validation } = field;

  if (type === "wzm") {
    const schema: ObjectJSONSchema & { "x-schemaType": string } = {
      type: "array",
      items: { type: "string", format: "uuid" },
      "x-schemaType": "wzm",
      ...(description && { description }),
      ...(isObjectSchema(validation) &&
        Array.isArray(validation.examples) &&
        validation.examples.length > 0 && { examples: validation.examples }),
    };
    return schema;
  }

  if (isObjectSchema(validation)) {
    const schema: ObjectJSONSchema = {
      type,
      description,
      ...validation,
    };
    if (defaultValue !== undefined) {
      schema.default = defaultValue;
    }
    return schema;
  }
  const schema: ObjectJSONSchema = validation || { type };
  if (defaultValue !== undefined) {
    schema.default = defaultValue;
  }
  return schema;
}

/**
 * Validates a field name
 */
export function validateFieldName(name: string): boolean {
  if (!name || name.trim() === "") {
    return false;
  }

  // Check that the name doesn't contain invalid characters for property names
  const validNamePattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  return validNamePattern.test(name);
}

/**
 * Gets properties from an object schema, respecting $propertyOrder if present
 */
export function getSchemaProperties(schema: JSONSchema): Property[] {
  if (!isObjectSchema(schema) || !schema.properties) return [];

  const required = schema.required || [];
  const propertyOrder = schema.$propertyOrder || Object.keys(schema.properties);

  // Filter to only include properties that actually exist
  const orderedPropertyNames = propertyOrder.filter(
    (name) => name in schema.properties!,
  );

  // Add any properties that aren't in the order array (for backward compatibility)
  const allPropertyNames = Object.keys(schema.properties);
  const missingProperties = allPropertyNames.filter(
    (name) => !orderedPropertyNames.includes(name),
  );
  const finalOrder = [...orderedPropertyNames, ...missingProperties];

  return finalOrder.map((name) => ({
    name,
    schema: schema.properties![name],
    required: required.includes(name),
  }));
}

export interface EligibleEnumController {
  name: string;
  values: unknown[];
}

function hasPathTo(
  graph: Map<string, string>,
  from: string,
  to: string,
): boolean {
  const visited = new Set<string>();
  let current: string | undefined = from;
  while (current) {
    if (current === to) return true;
    if (visited.has(current)) break;
    visited.add(current);
    current = graph.get(current);
  }
  return false;
}

/**
 * Sibling properties that can control this property's enum (have enum/const).
 * Order-independent; excludes any choice that would create a dependency cycle.
 */
export function getEligibleEnumControllingProperties(
  parentSchema: ObjectJSONSchema,
  propertyName: string,
): EligibleEnumController[] {
  if (!parentSchema.properties) return [];

  const graph = new Map<string, string>();
  for (const k of Object.keys(parentSchema.properties)) {
    const prop = parentSchema.properties[k];
    if (typeof prop !== "object" || prop === null) continue;
    const dep = (prop as ObjectJSONSchema & { $dependentEnum?: { property: string } }).$dependentEnum?.property;
    if (dep) graph.set(k, dep);
  }

  const result: EligibleEnumController[] = [];
  const siblings = Object.keys(parentSchema.properties).filter(
    (n) => n !== propertyName,
  );
  for (const name of siblings) {
    if (hasPathTo(graph, name, propertyName)) continue;
    const prop = parentSchema.properties[name];
    if (typeof prop === "boolean") continue;
    if (!prop) continue;
    let values: unknown[] | undefined;
    if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      values = prop.enum;
    } else if (prop.const !== undefined) {
      values = [prop.const];
    }
    if (values !== undefined) result.push({ name, values });
  }
  return result;
}

/**
 * Gets the items schema from an array schema
 */
export function getArrayItemsSchema(schema: JSONSchema): JSONSchema | null {
  if (isBooleanSchema(schema)) return null;
  if (schema.type !== "array") return null;

  return schema.items || null;
}

/**
 * Renames a property while preserving order in the object schema
 */
export function renameObjectProperty(
  schema: ObjectJSONSchema,
  oldName: string,
  newName: string,
): ObjectJSONSchema {
  if (!isObjectSchema(schema) || !schema.properties) return schema;

  const newSchema = copySchema(schema);
  const newProperties: Record<string, JSONSchema> = {};

  // Get ordered property names
  const propertyOrder = newSchema.$propertyOrder || Object.keys(newSchema.properties);
  
  // Reconstruct properties in order, replacing old key with new key
  for (const key of propertyOrder) {
    if (key === oldName) {
      newProperties[newName] = newSchema.properties[oldName];
    } else if (key in newSchema.properties) {
      newProperties[key] = newSchema.properties[key];
    }
  }

  // Add any properties not in the order array (skip oldName since it was renamed)
  for (const [key, value] of Object.entries(newSchema.properties)) {
    if (key === oldName) continue;
    if (!(key in newProperties)) {
      newProperties[key] = value;
    }
  }

  newSchema.properties = newProperties;

  // Update required array if the field name changed
  if (newSchema.required) {
    newSchema.required = newSchema.required.map((field) =>
      field === oldName ? newName : field,
    );
  }

  // Update $propertyOrder array if present
  if (newSchema.$propertyOrder) {
    newSchema.$propertyOrder = newSchema.$propertyOrder.map((name) =>
      name === oldName ? newName : name,
    );
  }

  return newSchema;
}

/**
 * Reorders a property in an object schema by moving it up or down
 */
export function reorderObjectProperty(
  schema: ObjectJSONSchema,
  propertyName: string,
  direction: "up" | "down",
): ObjectJSONSchema {
  if (!isObjectSchema(schema) || !schema.properties) return schema;

  const newSchema = copySchema(schema);
  
  // Initialize $propertyOrder if not present
  if (!newSchema.$propertyOrder) {
    newSchema.$propertyOrder = Object.keys(newSchema.properties);
  }

  const propertyOrder = [...newSchema.$propertyOrder];
  const currentIndex = propertyOrder.indexOf(propertyName);

  // Check if reordering is possible
  if (currentIndex === -1) return schema;
  if (direction === "up" && currentIndex === 0) return schema;
  if (direction === "down" && currentIndex === propertyOrder.length - 1) return schema;

  // Swap with adjacent property
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  [propertyOrder[currentIndex], propertyOrder[targetIndex]] = [
    propertyOrder[targetIndex],
    propertyOrder[currentIndex],
  ];

  // Reconstruct properties object in new order
  const newProperties: Record<string, JSONSchema> = {};
  for (const name of propertyOrder) {
    if (name in newSchema.properties) {
      newProperties[name] = newSchema.properties[name];
    }
  }

  // Add any properties not in the order array (shouldn't happen, but for safety)
  for (const [key, value] of Object.entries(newSchema.properties)) {
    if (!(key in newProperties)) {
      newProperties[key] = value;
    }
  }

  newSchema.properties = newProperties;
  newSchema.$propertyOrder = propertyOrder;

  return newSchema;
}

/**
 * Checks if a schema has children
 */
export function hasChildren(schema: JSONSchema): boolean {
  if (!isObjectSchema(schema)) return false;

  if (schema.type === "object" && schema.properties) {
    return Object.keys(schema.properties).length > 0;
  }

  if (schema.type === "array" && schema.items && isObjectSchema(schema.items)) {
    return schema.items.type === "object" && !!schema.items.properties;
  }

  return false;
}
