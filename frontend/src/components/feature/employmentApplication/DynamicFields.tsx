import { Fragment } from "react";
import { Field, Input, Checkbox, SimpleGrid } from "@chakra-ui/react";
import type { RoleField } from "@/data/roles";

function toCamelCase(label: string) {
  return label
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

export type DynamicFieldsProps = {
  fields: RoleField[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
};

export function DynamicFields({ fields, values, onChange }: DynamicFieldsProps) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
      {fields.map((f) => {
        const name = toCamelCase(f.label);
        const common = { id: name, name };
        return (
          <Fragment key={name}>
            <Field.Root>
              <Field.Label htmlFor={name}>{f.label}</Field.Label>
              {f.type === "checkbox" ? (
                <Checkbox.Root
                  checked={!!values[name]}
                  onChange={(e) => onChange(name, e.target)}
                />
              ) : (
                <Input
                  type={f.type}
                  value={values[name] ?? ""}
                  step={f.step}
                  min={f.min}
                  pattern={f.pattern}
                  onChange={(e) => onChange(name, e.target.value)}
                  {...common}
                />
              )}
            </Field.Root>
          </Fragment>
        );
      })}
    </SimpleGrid>
  );
}
