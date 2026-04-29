import { CirclePlus, HelpCircle, Info } from "lucide-react";
import { type FC, type FormEvent, useEffect, useId, useState } from "react";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx";
import { Input } from "../../components/ui/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip.tsx";
import { useTranslation } from "../../hooks/use-translation.ts";
import type {
  DisplaySchemaType,
  NewField,
  ObjectJSONSchema,
  SchemaType,
} from "../../types/jsonSchema.ts";
import SchemaTypeSelector from "./SchemaTypeSelector.tsx";
import TypeEditor from "./TypeEditor.tsx";

interface AddFieldButtonProps {
  parentSchema: ObjectJSONSchema;
  onAddField: (field: NewField) => void;
  variant?: "primary" | "secondary";
}

const ENUM_TYPES: SchemaType[] = ["string", "number", "integer"];

function asBaseSchemaType(type: DisplaySchemaType): SchemaType | null {
  if (type === "wzm") return null;
  if (type === "hersteller" || type === "herstellerArtikelnummer") return "string";
  return type;
}

function createEmptyDraftSchema(type: DisplaySchemaType): ObjectJSONSchema {
  if (type === "wzm") {
    return {
      type: "array",
      items: { type: "string", format: "uuid" },
      "x-schemaType": "wzm",
    } as ObjectJSONSchema & { "x-schemaType": string };
  }
  if (type === "hersteller" || type === "herstellerArtikelnummer") {
    return {
      type: "string",
      "x-schemaType": type,
    } as ObjectJSONSchema & { "x-schemaType": string };
  }
  return { type };
}

const AddFieldButton: FC<AddFieldButtonProps> = ({
  parentSchema,
  onAddField,
  variant = "primary",
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<DisplaySchemaType>("string");
  const [fieldDesc, setFieldDesc] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [draftSchema, setDraftSchema] = useState<ObjectJSONSchema>(() =>
    createEmptyDraftSchema("string"),
  );
  const fieldNameId = useId();
  const fieldDescId = useId();
  const fieldRequiredId = useId();
  const fieldTypeId = useId();

  const t = useTranslation();

  useEffect(() => {
    setDraftSchema((prev) => {
      const nextType = fieldType;
      const prevType = prev.type;
      if (prevType === nextType) return prev;
      return createEmptyDraftSchema(nextType);
    });
  }, [fieldType]);

  useEffect(() => {
    if (dialogOpen) {
      setDraftSchema(createEmptyDraftSchema(fieldType));
    }
  }, [dialogOpen, fieldType]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim()) return;

    const baseType = asBaseSchemaType(fieldType);
    const validation: ObjectJSONSchema | undefined =
      baseType !== null &&
      ENUM_TYPES.includes(baseType) &&
      Object.keys(draftSchema).length > 1
        ? { ...draftSchema, type: baseType }
        : undefined;

    onAddField({
      name: fieldName.trim(),
      type: fieldType,
      description: fieldDesc,
      required: fieldRequired,
      default: draftSchema.default,
      validation,
    });

    setFieldName("");
    setFieldType("string");
    setFieldDesc("");
    setFieldRequired(false);
    setDraftSchema(createEmptyDraftSchema("string"));
    setDialogOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setDialogOpen(true)}
        variant={variant === "primary" ? "default" : "outline"}
        size="sm"
        className="flex items-center gap-1.5 group"
      >
        <CirclePlus
          size={16}
          className="group-hover:scale-110 transition-transform"
        />
        <span>{t.fieldAddNewButton}</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="md:max-w-[1200px] max-h-[85vh] w-[95vw] p-4 sm:p-6 jsonjoy">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl flex flex-wrap items-center gap-2">
              {t.fieldAddNewLabel}
              <Badge variant="secondary" className="text-xs">
                {t.fieldAddNewBadge}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t.fieldAddNewDescription}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 min-w-[280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <label
                      htmlFor={fieldNameId}
                      className="text-sm font-medium"
                    >
                      {t.fieldNameLabel}
                    </label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[90vw]">
                          <p>{t.fieldNameTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id={fieldNameId}
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder={t.fieldNamePlaceholder}
                    className="font-mono text-sm w-full"
                    required
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <label
                      htmlFor={fieldDescId}
                      className="text-sm font-medium"
                    >
                      {t.fieldDescription}
                    </label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[90vw]">
                          <p>{t.fieldDescriptionTooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id={fieldDescId}
                    value={fieldDesc}
                    onChange={(e) => setFieldDesc(e.target.value)}
                    placeholder={t.fieldDescriptionPlaceholder}
                    className="text-sm w-full"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                  <input
                    type="checkbox"
                    id={fieldRequiredId}
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded border-gray-300 shrink-0"
                  />
                  <label htmlFor={fieldRequiredId} className="text-sm">
                    {t.fieldRequiredLabel}
                  </label>
                </div>
              </div>

              <div className="space-y-4 min-w-[280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <label
                      htmlFor={fieldTypeId}
                      className="text-sm font-medium"
                    >
                      {t.fieldType}
                    </label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent
                          side="left"
                          className="w-72 max-w-[90vw]"
                        >
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div>• {t.fieldTypeTooltipString}</div>
                            <div>• {t.fieldTypeTooltipNumber}</div>
                            <div>• {t.fieldTypeTooltipBoolean}</div>
                            <div>• {t.fieldTypeTooltipObject}</div>
                            <div>• {t.fieldTypeTooltipArray}</div>
                            <div>• {t.fieldTypeTooltipWzm}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <SchemaTypeSelector
                    id={fieldTypeId}
                    value={fieldType}
                    onChange={setFieldType}
                  />
                </div>

                <div className="rounded-lg border bg-muted/50 p-3 hidden md:block">
                  <p className="text-xs font-medium mb-2">
                    {t.fieldTypeExample}
                  </p>
                  <code className="text-sm bg-background/80 p-2 rounded block overflow-x-auto">
                    {fieldType === "string" && '"example"'}
                    {fieldType === "number" && "42"}
                    {fieldType === "boolean" && "true"}
                    {fieldType === "object" && '{ "key": "value" }'}
                    {fieldType === "array" && '["item1", "item2"]'}
                    {fieldType === "wzm" && '["uuid-1", "uuid-2"]'}
                  </code>
                </div>
              </div>
            </div>

            {fieldType !== "wzm" &&
              (() => {
                const baseType = asBaseSchemaType(fieldType);
                return baseType !== null && ENUM_TYPES.includes(baseType);
              })() && (
                <TypeEditor
                  schema={draftSchema}
                  readOnly={false}
                  parentSchema={parentSchema}
                  propertyName={fieldName.trim() || undefined}
                  validationNode={undefined}
                  onChange={setDraftSchema}
                  depth={1}
                />
              )}

            <DialogFooter className="mt-6 gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
              >
                {t.fieldAddNewCancel}
              </Button>
              <Button type="submit" size="sm">
                {t.fieldAddNewConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddFieldButton;
