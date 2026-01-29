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

type Property =
  | "enum"
  | "minLength"
  | "maxLength"
  | "pattern"
  | "format"
  | "$dependentEnum";

const StringEditor: React.FC<TypeEditorProps> = ({
  schema,
  validationNode,
  onChange,
  readOnly = false,
  parentSchema,
  propertyName,
}) => {
  const t = useTranslation();
  const [enumValue, setEnumValue] = useState("");
  const [dependentEnumValue, setDependentEnumValue] = useState<
    Record<string, string>
  >({});
  const [selectedControllingValue, setSelectedControllingValue] = useState("");

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

  const minLengthId = useId();
  const maxLengthId = useId();
  const patternId = useId();
  const formatId = useId();

  // Extract string-specific validations
  const minLength = withObjectSchema(schema, (s) => s.minLength, undefined);
  const maxLength = withObjectSchema(schema, (s) => s.maxLength, undefined);
  const pattern = withObjectSchema(schema, (s) => s.pattern, undefined);
  const format = withObjectSchema(schema, (s) => s.format, undefined);
  const enumValues = withObjectSchema(
    schema,
    (s) => (s.enum as string[]) || [],
    [],
  );

  const baseSchemaForValidation = useMemo(
    () =>
      isBooleanSchema(schema)
        ? { type: "string" as const }
        : (() => {
            const { enum: _e, $dependentEnum: _d, ...rest } = schema;
            return { ...rest, type: "string" as const };
          })(),
    [schema],
  );

  const handleValidationChange = (property: Property, value: unknown) => {
    const updated: ObjectJSONSchema = { ...baseSchemaForValidation };
    if (property === "enum") {
      updated.enum = value as string[];
      if ("$dependentEnum" in updated) delete (updated as { $dependentEnum?: unknown }).$dependentEnum;
    } else if (property === "$dependentEnum") {
      if (value != null) {
        (updated as ObjectJSONSchema & { $dependentEnum?: { property: string; values: Record<string, unknown[]> } }).$dependentEnum = value as { property: string; values: Record<string, unknown[]> };
        if ("enum" in updated) delete (updated as { enum?: unknown }).enum;
      } else {
        delete (updated as { $dependentEnum?: unknown }).$dependentEnum;
      }
    } else {
      (updated as Record<string, unknown>)[property] = value;
    }
    onChange(updated);
  };

  const handleSetEnumMode = (mode: "static" | "depends", controllerName?: string) => {
    if (mode === "static") {
      const rest = { ...baseSchemaForValidation };
      delete (rest as { $dependentEnum?: unknown }).$dependentEnum;
      onChange({ ...rest, type: "string" } as ObjectJSONSchema);
    } else if (controllerName && eligibleControllers.some((c) => c.name === controllerName)) {
      const controller = eligibleControllers.find((c) => c.name === controllerName)!;
      const values: Record<string, string[]> = {};
      for (const v of controller.values) {
        const key = String(v);
        values[key] = (dependentValuesMap[key] as string[]) ?? [];
      }
      handleValidationChange("$dependentEnum", {
        property: controllerName,
        values,
      });
    }
  };

  const handleDependentEnumValuesChange = (
    controllingValue: string,
    newList: string[],
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

    if (!enumValues.includes(enumValue)) {
      handleValidationChange("enum", [...enumValues, enumValue]);
    }

    setEnumValue("");
  };

  // Handle removing enum value
  const handleRemoveEnumValue = (index: number) => {
    const newEnumValues = [...enumValues];
    newEnumValues.splice(index, 1);

    if (newEnumValues.length === 0) {
      // If empty, remove the enum property entirely
      const baseSchema = isBooleanSchema(schema)
        ? { type: "string" as const }
        : { ...schema };

      // Use a type safe approach
      if (!isBooleanSchema(baseSchema) && "enum" in baseSchema) {
        const { enum: _, ...rest } = baseSchema;
        onChange(rest as ObjectJSONSchema);
      } else {
        onChange(baseSchema as ObjectJSONSchema);
      }
    } else {
      handleValidationChange("enum", newEnumValues);
    }
  };

  const minMaxError = useMemo(
    () =>
      validationNode?.validation.errors?.find((err) => err.path[0] === "length")
        ?.message,
    [validationNode],
  );

  const minLengthError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "minLength",
      )?.message,
    [validationNode],
  );

  const maxLengthError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "maxLength",
      )?.message,
    [validationNode],
  );

  const patternError = useMemo(
    () =>
      validationNode?.validation.errors?.find(
        (err) => err.path[0] === "pattern",
      )?.message,
    [validationNode],
  );

  const formatError = useMemo(
    () =>
      validationNode?.validation.errors?.find((err) => err.path[0] === "format")
        ?.message,
    [validationNode],
  );

  const minLengthValue = minLength ?? "";
  const maxLengthValue = maxLength ?? "";
  const patternValue = pattern ?? "";
  const formatValue = format || "none";
  const needsDetail =
    !readOnly ||
    minLengthValue !== "" ||
    maxLengthValue !== "" ||
    patternValue !== "" ||
    formatValue !== "none" ||
    enumValues.length > 0 ||
    (dependentEnum != null && Object.keys(dependentValuesMap).length > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {readOnly && !needsDetail && (
          <p className="text-sm text-muted-foreground italic">
            {t.stringNoConstraint}
          </p>
        )}

        {(!readOnly || minLengthValue !== "") && (
          <div className="space-y-2">
            <Label
              htmlFor={minLengthId}
              className={
                (!!minMaxError || !!minLengthError) && "text-destructive"
              }
            >
              {t.stringMinimumLengthLabel}
            </Label>
            <Input
              id={minLengthId}
              type="number"
              min={0}
              value={minLengthValue}
              disabled={readOnly}
              onChange={(e) => {
                const value = e.target.value
                  ? Number(e.target.value)
                  : undefined;
                handleValidationChange("minLength", value);
              }}
              placeholder={t.stringMinimumLengthPlaceholder}
              className={cn(
                "h-8",
                (!!minMaxError || !!minLengthError) && "border-destructive",
              )}
            />
          </div>
        )}

        {(!readOnly || maxLengthValue !== "") && (
          <div className="space-y-2">
            <Label
              htmlFor={maxLengthId}
              className={
                (!!minMaxError || !!maxLengthError) && "text-destructive"
              }
            >
              {t.stringMaximumLengthLabel}
            </Label>
            <Input
              id={maxLengthId}
              type="number"
              min={0}
              disabled={readOnly}
              value={maxLengthValue}
              onChange={(e) => {
                const value = e.target.value
                  ? Number(e.target.value)
                  : undefined;
                handleValidationChange("maxLength", value);
              }}
              placeholder={t.stringMaximumLengthPlaceholder}
              className={cn(
                "h-8",
                (!!minMaxError || !!maxLengthError) && "border-destructive",
              )}
            />
          </div>
        )}
        {(!!minMaxError || !!minLengthError || !!maxLengthError) && (
          <div className="text-xs text-destructive italic md:col-span-2 whitespace-pre-line">
            {[minMaxError, minLengthError ?? maxLengthError]
              .filter(Boolean)
              .join("\n")}
          </div>
        )}
      </div>

      {(!readOnly || patternValue !== "") && (
        <div className="space-y-2">
          <Label
            htmlFor={patternId}
            className={!!patternError && "text-destructive"}
          >
            {t.stringPatternLabel}
          </Label>
          <Input
            id={patternId}
            type="text"
            value={patternValue}
            onChange={(e) => {
              const value = e.target.value || undefined;
              handleValidationChange("pattern", value);
            }}
            placeholder={t.stringPatternPlaceholder}
            className="h-8"
          />
        </div>
      )}

      {(!readOnly || formatValue !== "none") && (
        <div className="space-y-2">
          <Label
            htmlFor={formatId}
            className={!!formatError && "text-destructive"}
          >
            {t.stringFormatLabel}
          </Label>
          <Select
            value={formatValue}
            onValueChange={(value) => {
              handleValidationChange(
                "format",
                value === "none" ? undefined : value,
              );
            }}
          >
            <SelectTrigger id={formatId} className="h-8">
              <SelectValue placeholder={t.stringFormatSelectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t.stringFormatNone}</SelectItem>
              <SelectItem value="date-time">
                {t.stringFormatDateTime}
              </SelectItem>
              <SelectItem value="date">{t.stringFormatDate}</SelectItem>
              <SelectItem value="time">{t.stringFormatTime}</SelectItem>
              <SelectItem value="email">{t.stringFormatEmail}</SelectItem>
              <SelectItem value="uri">{t.stringFormatUri}</SelectItem>
              <SelectItem value="uuid">{t.stringFormatUuid}</SelectItem>
              <SelectItem value="hostname">{t.stringFormatHostname}</SelectItem>
              <SelectItem value="ipv4">{t.stringFormatIpv4}</SelectItem>
              <SelectItem value="ipv6">{t.stringFormatIpv6}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {(!readOnly || enumValues.length > 0 || dependentEnum != null) && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label>{t.stringAllowedValuesEnumLabel}</Label>

          {eligibleControllers.length > 0 && !readOnly && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Label className="text-xs text-muted-foreground">
                {t.enumModeDependsOn}:
              </Label>
              <Select
                value={
                  enumMode === "depends" ? controllingProperty ?? "" : "__static__"
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
                  enumValues.map((value) => (
                    <div
                      key={`enum-string-${value}`}
                      className="flex items-center bg-muted/40 border rounded-md px-2 py-1 text-xs"
                    >
                      <span className="mr-1">{value}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveEnumValue(enumValues.indexOf(value))
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t.stringAllowedValuesEnumNone}
                  </p>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={enumValue}
                    onChange={(e) => setEnumValue(e.target.value)}
                    placeholder={t.stringAllowedValuesEnumAddPlaceholder}
                    className="h-8 text-xs flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddEnumValue()}
                  />
                  <button
                    type="button"
                    onClick={handleAddEnumValue}
                    className="px-3 py-1 h-8 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80"
                  >
                    {t.stringAllowedValuesEnumAddLabel}
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
                      {((dependentValuesMap[activeKey] as string[]) ?? []).map(
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
                                    (dependentValuesMap[activeKey] as string[]) ??
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
                      {((dependentValuesMap[activeKey] as string[]) ?? [])
                        .length === 0 &&
                        readOnly && (
                          <p className="text-xs text-muted-foreground italic">
                            {t.stringAllowedValuesEnumNone}
                          </p>
                        )}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={dependentEnumValue[activeKey] ?? ""}
                          onChange={(e) =>
                            setDependentEnumValue((prev) => ({
                              ...prev,
                              [activeKey]: e.target.value,
                            }))
                          }
                          placeholder={t.stringAllowedValuesEnumAddPlaceholder}
                          className="h-8 text-xs flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const list =
                                (dependentValuesMap[activeKey] as string[]) ?? [];
                              const val = (
                                dependentEnumValue[activeKey] ?? ""
                              ).trim();
                              if (val && !list.includes(val)) {
                                handleDependentEnumValuesChange(activeKey, [
                                  ...list,
                                  val,
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
                              (dependentValuesMap[activeKey] as string[]) ?? [];
                            const val = (
                              dependentEnumValue[activeKey] ?? ""
                            ).trim();
                            if (val && !list.includes(val)) {
                              handleDependentEnumValuesChange(activeKey, [
                                ...list,
                                val,
                              ]);
                              setDependentEnumValue((prev) => ({
                                ...prev,
                                [activeKey]: "",
                              }));
                            }
                          }}
                          className="px-3 py-1 h-8 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80"
                        >
                          {t.stringAllowedValuesEnumAddLabel}
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

export default StringEditor;
