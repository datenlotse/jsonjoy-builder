import { z } from "zod";

// Core definitions
const simpleTypes = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
] as const;

// Define base schema first - Zod is the source of truth
/** @public */
export const baseSchema = z.object({
  // Base schema properties
  $id: z.string().optional(),
  $schema: z.string().optional(),
  $ref: z.string().optional(),
  $anchor: z.string().optional(),
  $dynamicRef: z.string().optional(),
  $dynamicAnchor: z.string().optional(),
  $vocabulary: z.record(z.string(), z.boolean()).optional(),
  $comment: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  deprecated: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  writeOnly: z.boolean().optional(),
  examples: z.array(z.unknown()).optional(),
  type: z.union([z.enum(simpleTypes), z.array(z.enum(simpleTypes))]).optional(),

  // String validations
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(0).optional(),
  pattern: z.string().optional(),
  format: z.string().optional(),
  contentMediaType: z.string().optional(),
  contentEncoding: z.string().optional(),

  // Number validations
  multipleOf: z.number().positive().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  exclusiveMinimum: z.number().optional(),
  exclusiveMaximum: z.number().optional(),

  // Array validations
  minItems: z.number().int().min(0).optional(),
  maxItems: z.number().int().min(0).optional(),
  uniqueItems: z.boolean().optional(),
  minContains: z.number().int().min(0).optional(),
  maxContains: z.number().int().min(0).optional(),

  // Object validations
  required: z.array(z.string()).optional(),
  minProperties: z.number().int().min(0).optional(),
  maxProperties: z.number().int().min(0).optional(),
  dependentRequired: z.record(z.string(), z.array(z.string())).optional(),

  // Value validations
  const: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),

  // Custom extension: WZM (Werkzeugmaschine) multi-select discriminator
  "x-schemaType": z.string().optional(),
});

// Define recursive schema type
/** @public */
export type JSONSchema =
  | boolean
  | (z.infer<typeof baseSchema> & {
      // Recursive properties
      $defs?: Record<string, JSONSchema>;
      contentSchema?: JSONSchema;
      items?: JSONSchema;
      prefixItems?: JSONSchema[];
      contains?: JSONSchema;
      unevaluatedItems?: JSONSchema;
      properties?: Record<string, JSONSchema>;
      patternProperties?: Record<string, JSONSchema>;
      additionalProperties?: JSONSchema | boolean;
      propertyNames?: JSONSchema;
      dependentSchemas?: Record<string, JSONSchema>;
      unevaluatedProperties?: JSONSchema;
      allOf?: JSONSchema[];
      anyOf?: JSONSchema[];
      oneOf?: JSONSchema[];
      not?: JSONSchema;
      if?: JSONSchema;
      then?: JSONSchema;
      else?: JSONSchema;
      // Custom extension for explicit property ordering
      $propertyOrder?: string[];
      // Custom extension: enum values depend on another property's value
      $dependentEnum?: DependentEnumExtension;
    });

/** @public - Shape for $dependentEnum: enum of this property depends on sibling property value */
export interface DependentEnumExtension {
  property: string;
  values: Record<string, unknown[]>;
}

// Define Zod schema with recursive types
export const jsonSchemaType: z.ZodType<JSONSchema> = z.lazy(() =>
  z.union([
    baseSchema.extend({
      $defs: z.record(z.string(), jsonSchemaType).optional(),
      contentSchema: jsonSchemaType.optional(),
      items: jsonSchemaType.optional(),
      prefixItems: z.array(jsonSchemaType).optional(),
      contains: jsonSchemaType.optional(),
      unevaluatedItems: jsonSchemaType.optional(),
      properties: z.record(z.string(), jsonSchemaType).optional(),
      patternProperties: z.record(z.string(), jsonSchemaType).optional(),
      additionalProperties: z.union([jsonSchemaType, z.boolean()]).optional(),
      propertyNames: jsonSchemaType.optional(),
      dependentSchemas: z.record(z.string(), jsonSchemaType).optional(),
      unevaluatedProperties: jsonSchemaType.optional(),
      allOf: z.array(jsonSchemaType).optional(),
      anyOf: z.array(jsonSchemaType).optional(),
      oneOf: z.array(jsonSchemaType).optional(),
      not: jsonSchemaType.optional(),
      if: jsonSchemaType.optional(),
      // biome-ignore lint/suspicious/noThenProperty: This is a required property name in JSON Schema
      then: jsonSchemaType.optional(),
      else: jsonSchemaType.optional(),
    }),
    z.boolean(),
  ]),
);

// Derive our types from the schema
export type SchemaType = (typeof simpleTypes)[number];

/** Display type for UI; includes "wzm" which maps to array + x-schemaType */
export type DisplaySchemaType =
  | SchemaType
  | "wzm"
  | "hersteller"
  | "herstellerArtikelnummer";

export interface NewField {
  name: string;
  type: DisplaySchemaType;
  description: string;
  required: boolean;
  default?: unknown;
  validation?: ObjectJSONSchema;
}

export interface SchemaEditorState {
  schema: JSONSchema;
  fieldInfo: {
    type: DisplaySchemaType;
    properties: Array<{
      name: string;
      path: string[];
      schema: JSONSchema;
      required: boolean;
    }>;
  } | null;
  handleAddField: (newField: NewField, parentPath?: string[]) => void;
  handleEditField: (path: string[], updatedField: NewField) => void;
  handleDeleteField: (path: string[]) => void;
  handleSchemaEdit: (schema: JSONSchema) => void;
}

export type ObjectJSONSchema = Exclude<JSONSchema, boolean>;

export function isBooleanSchema(schema: JSONSchema): schema is boolean {
  return typeof schema === "boolean";
}

export function isObjectSchema(schema: JSONSchema): schema is ObjectJSONSchema {
  return !isBooleanSchema(schema);
}

export function asObjectSchema(schema: JSONSchema): ObjectJSONSchema {
  return isObjectSchema(schema) ? schema : { type: "null" };
}
export function getSchemaDescription(schema: JSONSchema): string {
  return isObjectSchema(schema) ? schema.description || "" : "";
}

export function withObjectSchema<T>(
  schema: JSONSchema,
  fn: (schema: ObjectJSONSchema) => T,
  defaultValue: T,
): T {
  return isObjectSchema(schema) ? fn(schema) : defaultValue;
}

/** Check if schema is a WZM (Werkzeugmaschine) multi-select field */
export function isWzmSchema(schema: JSONSchema): schema is ObjectJSONSchema {
  return (
    isObjectSchema(schema) &&
    schema.type === "array" &&
    (schema as ObjectJSONSchema & { "x-schemaType"?: string })["x-schemaType"] === "wzm"
  );
}

export function isHerstellerSchema(schema: JSONSchema): schema is ObjectJSONSchema {
  return (
    isObjectSchema(schema) &&
    schema.type === "string" &&
    (schema as ObjectJSONSchema & { "x-schemaType"?: string })["x-schemaType"] ===
      "hersteller"
  );
}

export function isHerstellerArtikelnummerSchema(
  schema: JSONSchema,
): schema is ObjectJSONSchema {
  return (
    isObjectSchema(schema) &&
    schema.type === "string" &&
    (schema as ObjectJSONSchema & { "x-schemaType"?: string })["x-schemaType"] ===
      "herstellerArtikelnummer"
  );
}

/** Get display type for UI; returns "wzm" when schema has x-schemaType: "wzm" */
export function getDisplayType(schema: JSONSchema): DisplaySchemaType {
  if (isWzmSchema(schema)) return "wzm";
  if (isHerstellerSchema(schema)) return "hersteller";
  if (isHerstellerArtikelnummerSchema(schema)) return "herstellerArtikelnummer";
  const t = isObjectSchema(schema) ? schema.type : undefined;
  const type = Array.isArray(t) ? t[0] : t;
  return (type || "object") as DisplaySchemaType;
}

export function getForcedPropertyNameForType(
  type: DisplaySchemaType,
): string | null {
  if (type === "hersteller") return "Hersteller";
  if (type === "herstellerArtikelnummer") return "Hersteller Artikelnummer";
  return null;
}
