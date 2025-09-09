import { Fragment } from "react";
import {
  Box,
  Card,
  Checkbox,
  Field,
  Heading,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  createListCollection,
} from "@chakra-ui/react";
import type { RoleDef, RoleField } from "@/data/roles";
import { ScheduleGrid } from "@/components/feature/employmentApplication/ScheduleGrid";
import { LandList } from "@/components/feature/employmentApplication/LandList";

type GridCols = { base?: number; md?: number; lg?: number };

type Props = {
  role: RoleDef;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  columns?: GridCols; // default { base: 1, md: 2 }
  // composite sections
  scheduleMask?: number[] | undefined;
  onScheduleChange?: (m?: number[]) => void;
  lands?: any[];
  onLandsChange?: (next: any[]) => void;
  // errors from Zod
  errors?: Record<string, string | undefined>;
};

function toCamelCase(label: string) {
  return label
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}
function getName(f: RoleField) {
  return f.name ?? toCamelCase(f.label);
}

// sections from fields (ordered via stepsMeta)
function useSections(role: RoleDef) {
  const map = new Map<string, RoleField[]>();
  for (const f of role.fields) {
    const sec = (f.step ?? "general").trim();
    const arr = map.get(sec) ?? [];
    arr.push(f);
    map.set(sec, arr);
  }
  const sections = Array.from(map.entries()).map(([id, fields]) => {
    const meta = role.stepsMeta?.find((m) => m.id === id);
    return {
      id,
      title: meta?.title ?? id[0].toUpperCase() + id.slice(1),
      help: meta?.help,
      order: meta?.order ?? Number.MAX_SAFE_INTEGER,
      fields,
    };
  });
  sections.sort((a, b) =>
    a.order === b.order ? a.title.localeCompare(b.title) : a.order - b.order
  );
  return sections;
}

// ————— Dimensions compound field —————
function DimensionsInput({
  label,
  value,
  unit = "cm",
  help,
  onChange,
}: {
  label: string;
  unit?: "cm" | "m" | "in";
  help?: string;
  value?: {
    length?: number | string;
    width?: number | string;
    height?: number | string;
    unit?: "cm" | "m" | "in";
  };
  onChange: (next: any) => void;
}) {
  const v = value ?? {};
  const u = (v.unit ?? unit) as "cm" | "m" | "in";

  const toNum = (x: any) => (x === "" || x == null ? undefined : Number(x));
  const L = toNum(v.length);
  const W = toNum(v.width);
  const H = toNum(v.height);

  const toMeters = (n?: number) => {
    if (n == null || Number.isNaN(n)) return undefined;
    if (u === "m") return n;
    if (u === "cm") return n / 100;
    if (u === "in") return n * 0.0254;
    return n;
  };
  const vol =
    L != null && W != null && H != null
      ? (toMeters(L)! * toMeters(W)! * toMeters(H)!).toFixed(3)
      : null;

  const unitOptions = createListCollection({
    items: [
      { label: "cm", value: "cm" },
      { label: "m", value: "m" },
      { label: "in", value: "in" },
    ],
  });

  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      {help && (
        <Text mt={1} fontSize="sm" color="fg.muted">
          {help}
        </Text>
      )}

      <SimpleGrid mt={3} columns={{ base: 1, md: 4 }} gap={3}>
        {(["length", "width", "height"] as const).map((k) => (
          <Field.Root key={k}>
            <Field.Label htmlFor={k}>
              {k[0].toUpperCase() + k.slice(1)}
            </Field.Label>
            <Input
              id={k}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              placeholder="0"
              value={v[k] ?? ""}
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "+") e.preventDefault();
              }}
              onChange={(e) => onChange({ ...v, [k]: e.target.value })}
            />
          </Field.Root>
        ))}
        <Field.Root>
          <Field.Label htmlFor="unit">Unit</Field.Label>
          <Select.Root
            id="unit"
            name="unit"
            collection={unitOptions}
            value={[u]}
            onValueChange={(e) => {
              const nextUnit = e.value[0] ?? u;
              onChange({ ...v, unit: nextUnit });
            }}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="Select unit" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
                <Select.ClearTrigger />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {unitOptions.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </Field.Root>
      </SimpleGrid>

      <Text mt={2} fontSize="sm" color="fg.muted">
        {vol ? `≈ ${vol} m³` : "Enter all three to estimate volume."}
      </Text>
    </Field.Root>
  );
}

// ————— Field renderer —————
function RenderField({
  f,
  values,
  onChange,
  errors,
}: {
  f: RoleField;
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  errors?: Record<string, string | undefined>;
}) {
  const name = getName(f);
  const isCheckbox = f.type === "checkbox";
  const error = errors?.[name];

  if (f.type === "dimensions") {
    return (
      <Box gridColumn={spanToGrid(f.colSpan)}>
        <DimensionsInput
          label={f.label}
          help={f.help}
          unit={f.unit ?? "cm"}
          value={values[name]}
          onChange={(next) => onChange(name, next)}
        />
        {error && (
          <Text mt={1} fontSize="sm" color="red.500">
            {error}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box gridColumn={spanToGrid(f.colSpan)}>
      <Field.Root invalid={Boolean(error)}>
        {!isCheckbox && <Field.Label htmlFor={name}>{f.label}</Field.Label>}

        {isCheckbox ? (
          <Checkbox.Root
            checked={Boolean(values[name])}
            onCheckedChange={({ checked }) => onChange(name, checked === true)}
            id={name}
            name={name}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label>{f.label}</Checkbox.Label>
          </Checkbox.Root>
        ) : (
          <Input
            id={name}
            name={name}
            type={f.type}
            value={values[name] ?? ""}
            step={f.stepAttr}
            min={(f.min as any) ?? (f.type === "number" ? 0 : undefined)}
            pattern={f.pattern}
            placeholder={f.help}
            inputMode={f.type === "number" ? "decimal" : undefined}
            onKeyDown={(e) => {
              if (f.type === "number" && (e.key === "-" || e.key === "+"))
                e.preventDefault();
            }}
            onChange={(e) => onChange(name, e.target.value)}
          />
        )}

        {f.help && !isCheckbox && (
          <Text mt={1} fontSize="sm" color="fg.muted">
            {f.help}
          </Text>
        )}
        {error && (
          <Text mt={1} fontSize="sm" color="red.500">
            {error}
          </Text>
        )}
      </Field.Root>
    </Box>
  );
}

function spanToGrid(span?: { base?: number; md?: number; lg?: number }) {
  if (!span) return undefined;
  return {
    base: span.base ? `span ${span.base} / span ${span.base}` : undefined,
    md: span.md ? `span ${span.md} / span ${span.md}` : undefined,
    lg: span.lg ? `span ${span.lg} / span ${span.lg}` : undefined,
  } as any;
}

// ————— Main (sections-only) —————
export function RoleForm({
  role,
  values,
  onChange,
  columns = { base: 1, md: 2 },
  scheduleMask,
  onScheduleChange,
  lands,
  onLandsChange,
  errors,
}: Props) {
  const sections = useSections(role);

  return (
    <Stack gap={8}>
      {sections.map((sec) => (
        <Card.Root key={sec.id}>
          <Card.Body>
            <Heading size="sm" mb={1}>
              {sec.title}
            </Heading>
            {sec.help && (
              <Text mb={3} fontSize="sm" color="fg.muted">
                {sec.help}
              </Text>
            )}
            <SimpleGrid columns={columns} gap={4}>
              {sec.fields.map((f) => (
                <Fragment key={`${sec.id}-${getName(f)}`}>
                  <RenderField
                    f={f}
                    values={values}
                    onChange={onChange}
                    errors={errors}
                  />
                </Fragment>
              ))}
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      ))}

      {role.includeSchedule && (
        <Card.Root>
          <Card.Body>
            <Heading size="sm" mb={3}>
              Availability
            </Heading>
            <ScheduleGrid value={scheduleMask} onChange={onScheduleChange!} />
          </Card.Body>
        </Card.Root>
      )}

      {role.includeLand && (
        <Card.Root>
          <Card.Body>
            <Heading size="sm" mb={3}>
              Lands
            </Heading>
            <LandList value={lands ?? []} onChange={onLandsChange!} />
          </Card.Body>
        </Card.Root>
      )}

    </Stack>
  );
}
