import { ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "../../components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx";
import { useTranslation } from "../../hooks/use-translation.ts";
import { cn } from "../../lib/utils.ts";
import type {
  DisplaySchemaType,
  JSONSchema,
  ObjectJSONSchema,
} from "../../types/jsonSchema.ts";
import {
  asObjectSchema,
  getDisplayType,
  getSchemaDescription,
  isBooleanSchema,
  isHerstellerArtikelnummerSchema,
  isHerstellerSchema,
  isWzmSchema,
} from "../../types/jsonSchema.ts";
import type { ValidationTreeNode } from "../../types/validation.ts";
import { Badge } from "../ui/badge.tsx";
import TypeDropdown from "./TypeDropdown.tsx";
import TypeEditor from "./TypeEditor.tsx";

export interface SchemaPropertyEditorProps {
  name: string;
  schema: JSONSchema;
  required: boolean;
  readOnly: boolean;
  parentSchema?: ObjectJSONSchema;
  validationNode?: ValidationTreeNode;
  onDelete: () => void;
  onNameChange: (newName: string) => void;
  onRequiredChange: (required: boolean) => void;
  onSchemaChange: (schema: ObjectJSONSchema) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  depth?: number;
}

export const SchemaPropertyEditor: React.FC<SchemaPropertyEditorProps> = ({
  name,
  schema,
  required,
  readOnly = false,
  parentSchema,
  validationNode,
  onDelete,
  onNameChange,
  onRequiredChange,
  onSchemaChange,
  onMoveUp,
  onMoveDown,
  depth = 0,
}) => {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(name);
  const [tempDesc, setTempDesc] = useState(getSchemaDescription(schema));
  const type = getDisplayType(schema) as DisplaySchemaType;

  const defaultValue = useMemo(() => {
    const objSchema = asObjectSchema(schema);
    return objSchema.default !== undefined ? String(objSchema.default) : "";
  }, [schema]);

  const [tempDefault, setTempDefault] = useState(defaultValue);

  // Determine if we should use Select for default value (enum or dependent enum)
  const defaultValueOptions = useMemo(() => {
    if (type === "wzm") return null;
    if (type !== "string" && type !== "number" && type !== "integer") {
      return null;
    }

    const objSchema = asObjectSchema(schema);
    const enumValues = objSchema.enum;
    const dependentEnum = objSchema.$dependentEnum;

    // Static enum
    if (Array.isArray(enumValues) && enumValues.length > 0) {
      return enumValues.map((v) => String(v));
    }

    // Dependent enum - only show options if controlling property has a default
    if (dependentEnum && parentSchema) {
      const controllingPropertyName = dependentEnum.property;
      const controllingPropertySchema = parentSchema.properties?.[
        controllingPropertyName
      ];
      if (
        controllingPropertySchema &&
        typeof controllingPropertySchema === "object" &&
        !isBooleanSchema(controllingPropertySchema)
      ) {
        const controllingDefault = (
          controllingPropertySchema as ObjectJSONSchema
        ).default;
        if (controllingDefault !== undefined) {
          const ctrlDefaultStr = String(controllingDefault);
          const allowedValues = dependentEnum.values[ctrlDefaultStr];
          if (Array.isArray(allowedValues) && allowedValues.length > 0) {
            return allowedValues.map((v) => String(v));
          }
        }
      }
    }

    return null;
  }, [schema, type, parentSchema]);

  // Get default error from validation
  const defaultError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "default",
      )?.message,
    [validationNode],
  );

  // Update temp values when props change
  useEffect(() => {
    setTempName(name);
    setTempDesc(getSchemaDescription(schema));
    setTempDefault(defaultValue);
  }, [name, schema, defaultValue]);

  const handleNameSubmit = () => {
    const trimmedName = tempName.trim();
    if (trimmedName && trimmedName !== name) {
      onNameChange(trimmedName);
    } else {
      setTempName(name);
    }
    setIsEditingName(false);
  };

  const handleDescSubmit = () => {
    const trimmedDesc = tempDesc.trim();
    if (trimmedDesc !== getSchemaDescription(schema)) {
      onSchemaChange({
        ...asObjectSchema(schema),
        description: trimmedDesc || undefined,
      });
    } else {
      setTempDesc(getSchemaDescription(schema));
    }
    setIsEditingDesc(false);
  };

  // Handle schema changes, preserving description and default (not for WZM)
  const handleSchemaUpdate = (updatedSchema: ObjectJSONSchema) => {
    const description = getSchemaDescription(schema);
    if (isWzmSchema(schema)) {
      onSchemaChange({
        ...updatedSchema,
        description: description || undefined,
        type: "array",
        items: { type: "string", format: "uuid" },
        "x-schemaType": "wzm",
      } as ObjectJSONSchema & { "x-schemaType": string });
      return;
    }
    if (isHerstellerSchema(schema) || isHerstellerArtikelnummerSchema(schema)) {
      const xSchemaType = (
        schema as ObjectJSONSchema & { "x-schemaType"?: string }
      )["x-schemaType"];
      onSchemaChange({
        ...updatedSchema,
        description: description || undefined,
        type: "string",
        ...(xSchemaType ? { "x-schemaType": xSchemaType } : {}),
      } as ObjectJSONSchema);
      return;
    }
    const currentDefault = asObjectSchema(schema).default;
    onSchemaChange({
      ...updatedSchema,
      description: description || undefined,
      default: currentDefault,
    });
  };

  // Handle default value change (for Input)
  const handleDefaultSubmit = () => {
    const trimmedDefault = tempDefault.trim();
    const objSchema = asObjectSchema(schema);
    const currentDefault = objSchema.default;

    if (trimmedDefault === "") {
      // Remove default if empty
      if (currentDefault !== undefined) {
        const { default: _, ...rest } = objSchema;
        onSchemaChange(rest);
      }
    } else {
      // Try to parse based on type
      let parsedValue: unknown = trimmedDefault;
      if (type === "number" || type === "integer") {
        parsedValue = Number(trimmedDefault);
        if (Number.isNaN(parsedValue)) {
          parsedValue = trimmedDefault; // Keep as string if not a valid number
        }
      } else if (type === "boolean") {
        if (trimmedDefault.toLowerCase() === "true") {
          parsedValue = true;
        } else if (trimmedDefault.toLowerCase() === "false") {
          parsedValue = false;
        } else {
          parsedValue = trimmedDefault; // Keep as string if not valid boolean
        }
      } else if (type === "null") {
        parsedValue = null;
      }

      if (JSON.stringify(currentDefault) !== JSON.stringify(parsedValue)) {
        onSchemaChange({
          ...objSchema,
          default: parsedValue,
        });
      }
    }
  };

  // Handle default value change (for Select)
  const handleDefaultSelectChange = (value: string) => {
    const objSchema = asObjectSchema(schema);
    const currentDefault = objSchema.default;

    if (value === "__none__" || value === "") {
      // Remove default
      if (currentDefault !== undefined) {
        const { default: _, ...rest } = objSchema;
        onSchemaChange(rest);
      }
    } else {
      // Parse based on type
      let parsedValue: unknown = value;
      if (type === "number" || type === "integer") {
        parsedValue = Number(value);
        if (Number.isNaN(parsedValue)) {
          parsedValue = value; // Keep as string if not a valid number
        }
      }

      if (JSON.stringify(currentDefault) !== JSON.stringify(parsedValue)) {
        onSchemaChange({
          ...objSchema,
          default: parsedValue,
        });
      }
    }
  };

  return (
    <div
      className={cn(
        "mb-2 animate-in rounded-lg border transition-all duration-200",
        depth > 0 && "ml-0 sm:ml-4 border-l border-l-border/40",
      )}
    >
      <div className="relative json-field-row justify-between group">
        <div className="flex items-center gap-2 grow min-w-0">
          {/* Expand/collapse button */}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? t.collapse : t.expand}
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>

          {/* Property name */}
          <div className="flex items-center gap-2 grow min-w-0 overflow-visible">
            <div className="flex items-center gap-2 min-w-0 grow overflow-visible">
              {!readOnly && isEditingName ? (
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                  className="h-8 text-sm font-medium min-w-[120px] max-w-full z-10"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingName(true)}
                  className="json-field-label font-medium cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all text-left truncate min-w-[80px] max-w-[50%]"
                >
                  {name}
                </button>
              )}

              {/* Description */}
              {!readOnly && isEditingDesc ? (
                <Input
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  onBlur={handleDescSubmit}
                  onKeyDown={(e) => e.key === "Enter" && handleDescSubmit()}
                  placeholder={t.propertyDescriptionPlaceholder}
                  className="h-8 text-xs text-muted-foreground italic flex-1 min-w-[150px] z-10"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              ) : tempDesc ? (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingDesc(true)}
                  className="text-xs text-muted-foreground italic cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all text-left truncate flex-1 max-w-[40%] mr-2"
                >
                  {tempDesc}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingDesc(true)}
                  className="text-xs text-muted-foreground/50 italic cursor-text px-2 py-0.5 -mx-0.5 rounded-sm hover:bg-secondary/30 hover:shadow-xs hover:ring-1 hover:ring-ring/20 transition-all opacity-0 group-hover:opacity-100 text-left truncate flex-1 max-w-[40%] mr-2"
                >
                  {t.propertyDescriptionButton}
                </button>
              )}
            </div>

            {/* Type display */}
            <div className="flex items-center gap-2 justify-end shrink-0">
              <TypeDropdown
                value={type}
                readOnly={readOnly}
                onChange={(newType) => {
                  const currentObjSchema = asObjectSchema(schema) as ObjectJSONSchema & {
                    "x-schemaType"?: string;
                  };
                  const { ["x-schemaType"]: _xSchemaType, ...schemaWithoutX } =
                    currentObjSchema;
                  if (newType === "wzm") {
                    onSchemaChange({
                      type: "array",
                      items: { type: "string", format: "uuid" },
                      "x-schemaType": "wzm",
                      description: getSchemaDescription(schema) || undefined,
                    } as ObjectJSONSchema & { "x-schemaType": string });
                    return;
                  }
                  if (
                    newType === "hersteller" ||
                    newType === "herstellerArtikelnummer"
                  ) {
                    onSchemaChange({
                      ...schemaWithoutX,
                      type: "string",
                      "x-schemaType": newType,
                      description: getSchemaDescription(schema) || undefined,
                    } as ObjectJSONSchema & { "x-schemaType": string });
                    return;
                  }
                  onSchemaChange({
                    ...schemaWithoutX,
                    type: newType,
                  });
                }}
              />

              {/* Required toggle */}
              <button
                type="button"
                onClick={() => !readOnly && onRequiredChange(!required)}
                className={cn(
                  "text-xs px-2 py-1 rounded-md font-medium min-w-[80px] text-center cursor-pointer hover:shadow-xs hover:ring-2 hover:ring-ring/30 active:scale-95 transition-all whitespace-nowrap",
                  required
                    ? "bg-red-50 text-red-500"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {required ? t.propertyRequired : t.propertyOptional}
              </button>
            </div>
          </div>
        </div>

        {/* Error badge */}
        {validationNode?.cumulativeChildrenErrors > 0 && (
          <Badge
            className="h-5 min-w-5 rounded-full px-1 font-mono tabular-nums justify-center"
            variant="destructive"
          >
            {validationNode.cumulativeChildrenErrors}
          </Badge>
        )}

        {/* Action buttons */}
        {!readOnly && (
          <div className="flex items-center gap-1 text-muted-foreground">
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                className="p-1 rounded-md hover:bg-secondary hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                aria-label={t.propertyMoveUp}
              >
                <ChevronUp size={16} />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                className="p-1 rounded-md hover:bg-secondary hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                aria-label={t.propertyMoveDown}
              >
                <ChevronDown size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded-md hover:bg-secondary hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              aria-label={t.propertyDelete}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Type-specific editor */}
      {expanded && (
        <div className="pt-1 pb-2 px-2 sm:px-3 animate-in space-y-3">
          {readOnly && tempDesc && <p className="pb-2">{tempDesc}</p>}
          
          {/* Default value editor - not shown for object or WZM */}
          {!readOnly && type !== "object" && type !== "wzm" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t.propertyDefaultLabel}
              </label>
              {defaultValueOptions && defaultValueOptions.length > 0 ? (
                <Select
                  value={
                    defaultValue !== "" &&
                    defaultValueOptions.includes(defaultValue)
                      ? defaultValue
                      : "__none__"
                  }
                  onValueChange={handleDefaultSelectChange}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t.propertyDefaultPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t.propertyDefaultNone}
                    </SelectItem>
                    {defaultValueOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={tempDefault}
                  onChange={(e) => setTempDefault(e.target.value)}
                  onBlur={handleDefaultSubmit}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleDefaultSubmit()
                  }
                  placeholder={t.propertyDefaultPlaceholder}
                  className="h-8 text-sm"
                />
              )}
              {defaultError && (
                <div className="text-xs text-destructive italic">
                  {defaultError}
                </div>
              )}
            </div>
          )}

          <TypeEditor
            schema={schema}
            readOnly={readOnly}
            parentSchema={parentSchema}
            propertyName={name}
            validationNode={validationNode}
            onChange={handleSchemaUpdate}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
};

export default SchemaPropertyEditor;
