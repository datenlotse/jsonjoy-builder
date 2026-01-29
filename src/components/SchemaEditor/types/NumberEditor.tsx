import { X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Input } from "../../../components/ui/input.tsx";
import { Label } from "../../../components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx";
import { useTranslation } from "../../../hooks/use-translation.ts";
import { getEligibleEnumControllingProperties } from "../../../lib/schemaEditor.ts";
import { cn } from "../../../lib/utils.ts";
import type { ObjectJSONSchema } from "../../../types/jsonSchema.ts";
import {
  isBooleanSchema,
  withObjectSchema,
} from "../../../types/jsonSchema.ts";
import type { TypeEditorProps } from "../TypeEditor.tsx";

interface NumberEditorProps extends TypeEditorProps {
  integer?: boolean;
}

type Property =
  | "minimum"
  | "maximum"
  | "exclusiveMinimum"
  | "exclusiveMaximum"
  | "multipleOf"
  | "enum"
  | "$dependentEnum";

const NumberEditor: React.FC<NumberEditorProps> = ({
  schema,
  validationNode,
  onChange,
  integer = false,
  readOnly = false,
  parentSchema,
  propertyName,
}) => {
  const [enumValue, setEnumValue] = useState("");
  const [dependentEnumValue, setDependentEnumValue] = useState<
    Record<string, string>
  >({});
  const [selectedControllingValue, setSelectedControllingValue] = useState("");
  const t = useTranslation();

  const eligibleControllers = useMemo(
    () =>
      parentSchema && propertyName
        ? getEligibleEnumControllingProperties(parentSchema, propertyName)
        : [],
    [parentSchema, propertyName],
  );

  const dependentEnum = withObjectSchema(
    schema,
    (s) => s.$dependentEnum,
    undefined,
  );
  const enumMode =
    dependentEnum != null ? ("depends" as const) : ("static" as const);
  const controllingProperty = dependentEnum?.property;
  const dependentValuesMap = dependentEnum?.values ?? {};

  const currentController = useMemo(
    () => eligibleControllers.find((c) => c.name === controllingProperty),
    [eligibleControllers, controllingProperty],
  );
  const controllingValues = currentController?.values ?? [];
  const activeKey = useMemo(() => {
    if (controllingValues.length === 0) return "";
    const first = String(controllingValues[0]);
    if (
      selectedControllingValue &&
      controllingValues.some((v) => String(v) === selectedControllingValue)
    ) {
      return selectedControllingValue;
    }
    return first;
  }, [controllingValues, selectedControllingValue]);

  useEffect(() => {
    if (enumMode === "depends" && controllingValues.length > 0) {
      const valid =
        selectedControllingValue &&
        controllingValues.some((v) => String(v) === selectedControllingValue);
      if (!valid) {
        setSelectedControllingValue(String(controllingValues[0]));
      }
    }
  }, [enumMode, controllingProperty, controllingValues, selectedControllingValue]);

  const maximumId = useId();
  const minimumId = useId();
  const exclusiveMinimumId = useId();
  const exclusiveMaximumId = useId();
  const multipleOfId = useId();

  // Extract number-specific validations
  const minimum = withObjectSchema(schema, (s) => s.minimum, undefined);
  const maximum = withObjectSchema(schema, (s) => s.maximum, undefined);
  const exclusiveMinimum = withObjectSchema(
    schema,
    (s) => s.exclusiveMinimum,
    undefined,
  );
  const exclusiveMaximum = withObjectSchema(
    schema,
    (s) => s.exclusiveMaximum,
    undefined,
  );
  const multipleOf = withObjectSchema(schema, (s) => s.multipleOf, undefined);
  const enumValues = withObjectSchema(
    schema,
    (s) => (s.enum as number[]) || [],
    [],
  );

  const basePropertiesForValidation = useMemo(() => {
    const base: Partial<ObjectJSONSchema> = {
      type: integer ? "integer" : "number",
    };
    if (!isBooleanSchema(schema)) {
      if (schema.minimum !== undefined) base.minimum = schema.minimum;
      if (schema.maximum !== undefined) base.maximum = schema.maximum;
      if (schema.exclusiveMinimum !== undefined)
        base.exclusiveMinimum = schema.exclusiveMinimum;
      if (schema.exclusiveMaximum !== undefined)
        base.exclusiveMaximum = schema.exclusiveMaximum;
      if (schema.multipleOf !== undefined) base.multipleOf = schema.multipleOf;
      if (schema.enum !== undefined) base.enum = schema.enum;
      if (schema.$dependentEnum !== undefined)
        (base as ObjectJSONSchema & { $dependentEnum?: unknown }).$dependentEnum =
          schema.$dependentEnum;
    }
    return base;
  }, [schema, integer]);

  const handleValidationChange = (property: Property, value: unknown) => {
    const baseProperties = { ...basePropertiesForValidation };

    if (property === "$dependentEnum") {
      if (value != null) {
        (baseProperties as ObjectJSONSchema & { $dependentEnum?: { property: string; values: Record<string, unknown[]> } }).$dependentEnum = value as { property: string; values: Record<string, unknown[]> };
        delete (baseProperties as { enum?: unknown }).enum;
      } else {
        delete (baseProperties as { $dependentEnum?: unknown }).$dependentEnum;
      }
      onChange(baseProperties as ObjectJSONSchema);
      return;
    }

    if (property === "enum") {
      delete (baseProperties as { $dependentEnum?: unknown }).$dependentEnum;
    }

    if (value !== undefined) {
      if (property === "minimum") baseProperties.minimum = value as number;
      else if (property === "maximum") baseProperties.maximum = value as number;
      else if (property === "exclusiveMinimum")
        baseProperties.exclusiveMinimum = value as number;
      else if (property === "exclusiveMaximum")
        baseProperties.exclusiveMaximum = value as number;
      else if (property === "multipleOf")
        baseProperties.multipleOf = value as number;
      else if (property === "enum") baseProperties.enum = value as unknown[];
      onChange(baseProperties as ObjectJSONSchema);
      return;
    }

    if (property === "minimum") {
      const { minimum: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }
    if (property === "maximum") {
      const { maximum: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }
    if (property === "exclusiveMinimum") {
      const { exclusiveMinimum: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }
    if (property === "exclusiveMaximum") {
      const { exclusiveMaximum: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }
    if (property === "multipleOf") {
      const { multipleOf: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }
    if (property === "enum") {
      const { enum: _, ...rest } = baseProperties;
      onChange(rest as ObjectJSONSchema);
      return;
    }

    onChange(baseProperties as ObjectJSONSchema);
  };

  const handleSetEnumMode = (mode: "static" | "depends", controllerName?: string) => {
    if (mode === "static") {
      const { $dependentEnum: _, ...rest } = basePropertiesForValidation;
      onChange({ ...rest, type: integer ? "integer" : "number" } as ObjectJSONSchema);
    } else if (controllerName && eligibleControllers.some((c) => c.name === controllerName)) {
      const controller = eligibleControllers.find((c) => c.name === controllerName)!;
      const values: Record<string, number[]> = {};
      for (const v of controller.values) {
        const key = String(v);
        values[key] = ((dependentValuesMap[key] as number[]) ?? []).slice();
      }
      handleValidationChange("$dependentEnum", {
        property: controllerName,
        values,
      });
    }
  };

  const handleDependentEnumValuesChange = (
    controllingValue: string,
    newList: number[],
  ) => {
    const prop = dependentEnum?.property;
    if (!prop) return;
    const next = { ...dependentValuesMap, [controllingValue]: newList };
    if (newList.length === 0) {
      const { [controllingValue]: _, ...rest } = next;
      if (Object.keys(rest).length === 0) {
        handleValidationChange("$dependentEnum", undefined);
        return;
      }
      handleValidationChange("$dependentEnum", { property: prop, values: rest });
    } else {
      handleValidationChange("$dependentEnum", { property: prop, values: next });
    }
  };

  // Handle adding enum value
  const handleAddEnumValue = () => {
    if (!enumValue.trim()) return;

    const numValue = Number(enumValue);
    if (Number.isNaN(numValue)) return;

    // For integer type, ensure the value is an integer
    const validValue = integer ? Math.floor(numValue) : numValue;

    if (!enumValues.includes(validValue)) {
      handleValidationChange("enum", [...enumValues, validValue]);
    }

    setEnumValue("");
  };

  // Handle removing enum value
  const handleRemoveEnumValue = (index: number) => {
    const newEnumValues = [...enumValues];
    newEnumValues.splice(index, 1);

    if (newEnumValues.length === 0) {
      // If empty, remove the enum property entirely by setting it to undefined
      handleValidationChange("enum", undefined);
    } else {
      handleValidationChange("enum", newEnumValues);
    }
  };

  const minMaxError = useMemo(
    () =>
      validationNode?.validation.errors?.find((err) => err.path[0] === "minMax")
        ?.message,
    [validationNode],
  );

  const redundantMinError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "redundantMinimum",
      )?.message,
    [validationNode],
  );

  const redundantMaxError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "redundantMaximum",
      )?.message,
    [validationNode],
  );

  const enumError = useMemo(
    () =>
      validationNode?.validation.errors?.find((err) => err.path[0] === "enum")
        ?.message,
    [validationNode],
  );

  const multipleOfError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "multipleOf",
      )?.message,
    [validationNode],
  );

  const hasConstraint =
    !!minimum ||
    !!maximum ||
    !!exclusiveMinimum ||
    !!exclusiveMaximum ||
    !!multipleOf ||
    enumValues.length > 0 ||
    (dependentEnum != null && Object.keys(dependentValuesMap).length > 0);

  return (
    <div className="space-y-4">
      {readOnly && !hasConstraint && (
        <p className="text-sm text-muted-foreground italic">
          {t.numberNoConstraint}
        </p>
      )}

      {(!readOnly || hasConstraint) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-0 md:col-span-2">
            {!!minMaxError && (
              <div className="text-xs text-destructive italic">
                {minMaxError}
              </div>
            )}
            {!!redundantMinError && (
              <div className="text-xs text-destructive italic">
                {redundantMinError}
              </div>
            )}
            {!!redundantMaxError && (
              <div className="text-xs text-destructive italic">
                {redundantMaxError}
              </div>
            )}
            {!!enumError && (
              <div className="text-xs text-destructive italic">{enumError}</div>
            )}
          </div>

          {(!readOnly || !!minimum) && (
            <div className="space-y-2">
              <Label
                htmlFor={minimumId}
                className={
                  minimum !== undefined &&
                  (!!minMaxError || !!redundantMinError) &&
                  "text-destructive"
                }
              >
                {t.numberMinimumLabel}
              </Label>
              <Input
                id={minimumId}
                type="number"
                value={minimum !== undefined ? minimum : ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? Number(e.target.value)
                    : undefined;
                  handleValidationChange("minimum", value);
                }}
                placeholder={t.numberMinimumPlaceholder}
                className={cn(
                  "h-8",
                  minimum !== undefined &&
                    (!!minMaxError || !!redundantMinError) &&
                    "border-destructive",
                )}
                step={integer ? 1 : "any"}
              />
            </div>
          )}

          {(!readOnly || !!maximum) && (
            <div className="space-y-2">
              <Label
                htmlFor={maximumId}
                className={
                  maximum !== undefined &&
                  (!!minMaxError || !!redundantMaxError) &&
                  "text-destructive"
                }
              >
                {t.numberMaximumLabel}
              </Label>
              <Input
                id={maximumId}
                type="number"
                value={maximum ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? Number(e.target.value)
                    : undefined;
                  handleValidationChange("maximum", value);
                }}
                placeholder={t.numberMaximumPlaceholder}
                className={cn(
                  "h-8",
                  maximum !== undefined &&
                    (!!minMaxError || !!redundantMaxError) &&
                    "border-destructive",
                )}
                step={integer ? 1 : "any"}
              />
            </div>
          )}
        </div>
      )}

      {(!readOnly || !!exclusiveMaximum || !!exclusiveMinimum) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(!readOnly || !!exclusiveMinimum) && (
            <div className="space-y-2">
              <Label
                htmlFor={exclusiveMinimumId}
                className={
                  exclusiveMinimum !== undefined &&
                  (!!minMaxError || !!redundantMinError) &&
                  "text-destructive"
                }
              >
                {t.numberExclusiveMinimumLabel}
              </Label>
              <Input
                id={exclusiveMinimumId}
                type="number"
                value={exclusiveMinimum ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? Number(e.target.value)
                    : undefined;
                  handleValidationChange("exclusiveMinimum", value);
                }}
                placeholder={t.numberExclusiveMinimumPlaceholder}
                className={cn(
                  "h-8",
                  exclusiveMinimum !== undefined &&
                    (!!minMaxError || !!redundantMinError) &&
                    "border-destructive",
                )}
                step={integer ? 1 : "any"}
              />
            </div>
          )}

          {(!readOnly || !!exclusiveMaximum) && (
            <div className="space-y-2">
              <Label
                htmlFor={exclusiveMaximumId}
                className={
                  exclusiveMaximum !== undefined &&
                  (!!minMaxError || !!redundantMaxError) &&
                  "text-destructive"
                }
              >
                {t.numberExclusiveMaximumLabel}
              </Label>
              <Input
                id={exclusiveMaximumId}
                type="number"
                value={exclusiveMaximum ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? Number(e.target.value)
                    : undefined;
                  handleValidationChange("exclusiveMaximum", value);
                }}
                placeholder={t.numberExclusiveMaximumPlaceholder}
                className={cn(
                  "h-8",
                  exclusiveMaximum !== undefined &&
                    (!!minMaxError || !!redundantMaxError) &&
                    "border-destructive",
                )}
                step={integer ? 1 : "any"}
              />
            </div>
          )}
        </div>
      )}

      {(!readOnly || !!multipleOf) && (
        <div className="space-y-2">
          <Label
            htmlFor={multipleOfId}
            className={!!multipleOfError && "text-destructive"}
          >
            {t.numberMultipleOfLabel}
          </Label>
          <Input
            id={multipleOfId}
            type="number"
            value={multipleOf ?? ""}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : undefined;
              handleValidationChange("multipleOf", value);
            }}
            placeholder={t.numberMultipleOfPlaceholder}
            className={cn("h-8", !!multipleOfError && "border-destructive")}
            min={0}
            step={integer ? 1 : "any"}
          />
          {!!multipleOfError && (
            <div className="text-xs text-destructive italic whitespace-pre-line">
              {multipleOfError}
            </div>
          )}
        </div>
      )}

      {(!readOnly || enumValues.length > 0 || dependentEnum != null) && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label className={!!enumError && "text-destructive"}>
            {t.numberAllowedValuesEnumLabel}
          </Label>

          {eligibleControllers.length > 0 && !readOnly && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Label className="text-xs text-muted-foreground">
                {t.enumModeDependsOn}:
              </Label>
              <Select
                value={
                  enumMode === "depends"
                    ? controllingProperty ?? ""
                    : "__static__"
                }
                onValueChange={(v) => {
                  if (v === "__static__") handleSetEnumMode("static");
                  else handleSetEnumMode("depends", v);
                }}
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder={t.enumDependsOnPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__static__">{t.enumModeStatic}</SelectItem>
                  {eligibleControllers.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {enumMode === "static" && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {enumValues.length > 0 ? (
                  enumValues.map((value, index) => (
                    <div
                      key={`enum-number-${value}`}
                      className="flex items-center bg-muted/40 border rounded-md px-2 py-1 text-xs"
                    >
                      <span className="mr-1">{value}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEnumValue(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t.numberAllowedValuesEnumNone}
                  </p>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={enumValue}
                    onChange={(e) => setEnumValue(e.target.value)}
                    placeholder={t.numberAllowedValuesEnumAddPlaceholder}
                    className="h-8 text-xs flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddEnumValue()}
                    step={integer ? 1 : "any"}
                  />
                  <button
                    type="button"
                    onClick={handleAddEnumValue}
                    className="px-3 py-1 h-8 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80"
                  >
                    {t.numberAllowedValuesEnumAddLabel}
                  </button>
                </div>
              )}
            </>
          )}

          {enumMode === "depends" &&
            controllingProperty &&
            currentController &&
            controllingValues.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {t.whenPropertyEquals
                      .replace("{property}", controllingProperty)
                      .replace("{value}", "")}
                  </Label>
                  <Select
                    value={activeKey || undefined}
                    onValueChange={(value) =>
                      setSelectedControllingValue(value ?? "")
                    }
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder={t.whenPropertyEquals.replace("{property}", controllingProperty).replace("{value}", "")} />
                    </SelectTrigger>
                    <SelectContent>
                      {controllingValues.map((v) => (
                        <SelectItem key={String(v)} value={String(v)}>
                          {String(v)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeKey && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t.whenPropertyEquals
                        .replace("{property}", controllingProperty)
                        .replace("{value}", activeKey)}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {((dependentValuesMap[activeKey] as number[]) ?? []).map(
                        (v) => (
                          <div
                            key={v}
                            className="flex items-center bg-muted/40 border rounded-md px-2 py-1 text-xs"
                          >
                            <span className="mr-1">{v}</span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => {
                                  const list =
                                    (dependentValuesMap[activeKey] as number[]) ??
                                    [];
                                  const next = list.filter((x) => x !== v);
                                  handleDependentEnumValuesChange(activeKey, next);
                                }}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ),
                      )}
                      {((dependentValuesMap[activeKey] as number[]) ?? [])
                        .length === 0 &&
                        readOnly && (
                          <p className="text-xs text-muted-foreground italic">
                            {t.numberAllowedValuesEnumNone}
                          </p>
                        )}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={dependentEnumValue[activeKey] ?? ""}
                          onChange={(e) =>
                            setDependentEnumValue((prev) => ({
                              ...prev,
                              [activeKey]: e.target.value,
                            }))
                          }
                          placeholder={t.numberAllowedValuesEnumAddPlaceholder}
                          className="h-8 text-xs flex-1"
                          step={integer ? 1 : "any"}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const list =
                                (dependentValuesMap[activeKey] as number[]) ??
                                [];
                              const raw = (
                                dependentEnumValue[activeKey] ?? ""
                              ).trim();
                              const num = Number(raw);
                              if (
                                raw !== "" &&
                                !Number.isNaN(num) &&
                                !list.includes(
                                  integer ? Math.floor(num) : num,
                                )
                              ) {
                                const valid = integer
                                  ? Math.floor(num)
                                  : num;
                                handleDependentEnumValuesChange(activeKey, [
                                  ...list,
                                  valid,
                                ]);
                                setDependentEnumValue((prev) => ({
                                  ...prev,
                                  [activeKey]: "",
                                }));
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list =
                              (dependentValuesMap[activeKey] as number[]) ?? [];
                            const raw = (
                              dependentEnumValue[activeKey] ?? ""
                            ).trim();
                            const num = Number(raw);
                            if (
                              raw !== "" &&
                              !Number.isNaN(num) &&
                              !list.includes(
                                integer ? Math.floor(num) : num,
                              )
                            ) {
                              const valid = integer
                                ? Math.floor(num)
                                : num;
                              handleDependentEnumValuesChange(activeKey, [
                                ...list,
                                valid,
                              ]);
                              setDependentEnumValue((prev) => ({
                                ...prev,
                                [activeKey]: "",
                              }));
                            }
                          }}
                          className="px-3 py-1 h-8 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80"
                        >
                          {t.numberAllowedValuesEnumAddLabel}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default NumberEditor;
