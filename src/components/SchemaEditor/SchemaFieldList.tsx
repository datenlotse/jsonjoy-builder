import { type FC, useMemo } from "react";
import { useTranslation } from "../../hooks/use-translation.ts";
import { getSchemaProperties } from "../../lib/schemaEditor.ts";
import type {
  JSONSchema as JSONSchemaType,
  NewField,
  ObjectJSONSchema,
  SchemaType,
} from "../../types/jsonSchema.ts";
import { buildValidationTree } from "../../types/validation.ts";
import SchemaPropertyEditor from "./SchemaPropertyEditor.tsx";

interface SchemaFieldListProps {
  schema: JSONSchemaType;
  readOnly: boolean;
  onAddField: (newField: NewField) => void;
  onEditField: (name: string, updatedField: NewField) => void;
  onDeleteField: (name: string) => void;
  onReorderField?: (name: string, direction: "up" | "down") => void;
}

const SchemaFieldList: FC<SchemaFieldListProps> = ({
  schema,
  onEditField,
  onDeleteField,
  onReorderField,
  readOnly = false,
}) => {
  const t = useTranslation();

  // Get the properties from the schema
  const properties = getSchemaProperties(schema);

  // Get schema type as a valid SchemaType
  const getValidSchemaType = (propSchema: JSONSchemaType): SchemaType => {
    if (typeof propSchema === "boolean") return "object";

    // Handle array of types by picking the first one
    const type = propSchema.type;
    if (Array.isArray(type)) {
      return type[0] || "object";
    }

    return type || "object";
  };

  // Handle field name change (generates an edit event)
  const handleNameChange = (oldName: string, newName: string) => {
    const property = properties.find((prop) => prop.name === oldName);
    if (!property) return;

    const propSchemaObj =
      typeof property.schema === "boolean"
        ? { type: "object" as SchemaType }
        : property.schema;

    onEditField(oldName, {
      name: newName,
      type: getValidSchemaType(property.schema),
      description: propSchemaObj.description || "",
      required: property.required,
      default: propSchemaObj.default,
      validation: propSchemaObj,
    });
  };

  // Handle required status change
  const handleRequiredChange = (name: string, required: boolean) => {
    const property = properties.find((prop) => prop.name === name);
    if (!property) return;

    const propSchemaObj =
      typeof property.schema === "boolean"
        ? { type: "object" as SchemaType }
        : property.schema;

    onEditField(name, {
      name,
      type: getValidSchemaType(property.schema),
      description: propSchemaObj.description || "",
      required,
      default: propSchemaObj.default,
      validation: propSchemaObj,
    });
  };

  // Handle schema change
  const handleSchemaChange = (
    name: string,
    updatedSchema: ObjectJSONSchema,
  ) => {
    const property = properties.find((prop) => prop.name === name);
    if (!property) return;

    const type = updatedSchema.type || "object";
    // Ensure we're using a single type, not an array of types
    const validType = Array.isArray(type) ? type[0] || "object" : type;

    onEditField(name, {
      name,
      type: validType,
      description: updatedSchema.description || "",
      required: property.required,
      default: updatedSchema.default,
      validation: updatedSchema,
    });
  };

  const validationTree = useMemo(
    () => buildValidationTree(schema, t),
    [schema, t],
  );

  return (
    <div className="space-y-2 animate-in">
      {properties.map((property, index) => (
        <SchemaPropertyEditor
          key={property.name}
          name={property.name}
          schema={property.schema}
          required={property.required}
          validationNode={validationTree.children[property.name] ?? undefined}
          onDelete={() => onDeleteField(property.name)}
          onNameChange={(newName) => handleNameChange(property.name, newName)}
          onRequiredChange={(required) =>
            handleRequiredChange(property.name, required)
          }
          onSchemaChange={(schema) => handleSchemaChange(property.name, schema)}
          onMoveUp={
            onReorderField && index > 0
              ? () => onReorderField(property.name, "up")
              : undefined
          }
          onMoveDown={
            onReorderField && index < properties.length - 1
              ? () => onReorderField(property.name, "down")
              : undefined
          }
          readOnly={readOnly}
        />
      ))}
    </div>
  );
};

export default SchemaFieldList;
