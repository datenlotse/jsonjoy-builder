import { useEffect, useState } from "react";
import { Input } from "../../../components/ui/input.tsx";
import { Label } from "../../../components/ui/label.tsx";
import { useTranslation } from "../../../hooks/use-translation.ts";
import type { ObjectJSONSchema } from "../../../types/jsonSchema.ts";
import { isWzmSchema, withObjectSchema } from "../../../types/jsonSchema.ts";
import type { TypeEditorProps } from "../TypeEditor.tsx";

const WzmEditor: React.FC<TypeEditorProps> = ({
  schema,
  onChange,
  readOnly = false,
}) => {
  const t = useTranslation();
  const examples = withObjectSchema(
    schema,
    (s) => s.examples as unknown[] | undefined,
    undefined,
  );
  const exampleStr =
    Array.isArray(examples) && examples.length > 0
      ? typeof examples[0] === "string"
        ? examples[0]
        : JSON.stringify(examples[0])
      : "";

  const [tempExample, setTempExample] = useState(exampleStr);

  useEffect(() => {
    setTempExample(exampleStr);
  }, [exampleStr]);

  const handleExampleBlur = () => {
    const trimmed = tempExample.trim();
    if (!isWzmSchema(schema)) return;

    const baseSchema: ObjectJSONSchema & { "x-schemaType": string } = {
      type: "array",
      items: { type: "string", format: "uuid" },
      "x-schemaType": "wzm",
      ...(schema.description && { description: schema.description }),
    };

    if (trimmed === "") {
      const { examples: _, ...rest } = schema as ObjectJSONSchema & {
        examples?: unknown[];
      };
      onChange({
        ...rest,
        type: "array",
        items: { type: "string", format: "uuid" },
        "x-schemaType": "wzm",
      } as ObjectJSONSchema);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      onChange({
        ...baseSchema,
        examples: [parsed],
      });
    } catch {
      onChange({
        ...baseSchema,
        examples: [trimmed],
      });
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="space-y-2">
          <Label>{t.wzmExampleLabel}</Label>
          <Input
            value={tempExample}
            onChange={(e) => setTempExample(e.target.value)}
            onBlur={handleExampleBlur}
            onKeyDown={(e) => e.key === "Enter" && handleExampleBlur()}
            placeholder={t.wzmExamplePlaceholder}
            className="font-mono text-sm"
          />
        </div>
      )}
      {readOnly && exampleStr && (
        <p className="text-sm text-muted-foreground font-mono">{exampleStr}</p>
      )}
      {readOnly && !exampleStr && (
        <p className="text-sm text-muted-foreground italic">
          {t.wzmExamplePlaceholder}
        </p>
      )}
    </div>
  );
};

export default WzmEditor;
