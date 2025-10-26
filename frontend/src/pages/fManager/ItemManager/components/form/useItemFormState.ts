import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { itemFormSchema, type ItemFormValues } from "@/api/items"

export type Errors = Partial<
  Record<
    | "category"
    | "type"
    | "variety"
    | "imageUrl"
    | "caloriesPer100g"
    | "price.a"
    | "price.b"
    | "price.c"
    | "season"
    | "tolerance",
    string
  >
>

export const normalizeFormDefaults = (defs?: Partial<ItemFormValues>): ItemFormValues => ({
  category: "fruit",
  type: "",
  variety: "",
  imageUrl: "",
  caloriesPer100g: undefined,
  season: "",
  tolerance: "",
  qualityStandards: undefined,
  ...defs,
  price: {
    a: defs?.price?.a ?? null,
    b: defs?.price?.b ?? null,
    c: defs?.price?.c ?? null,
  },
})

export function useItemFormState(defaultValues?: Partial<ItemFormValues>) {
  const initial = useMemo(() => normalizeFormDefaults(defaultValues), [defaultValues])

  const [values, setValues] = useState<ItemFormValues>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const next = normalizeFormDefaults(defaultValues)
    setValues(next)
    setErrors({})
    setTouched({})
  }, [defaultValues])

  const markTouched = (name: string) =>
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }))

  const validate = (next?: ItemFormValues): Errors => {
    const data = next ?? values
    const res = itemFormSchema.safeParse(data)
    if (res.success) {
      setErrors({})
      return {}
    } else {
      const out: Errors = {}
      for (const issue of res.error.issues) {
        const path = issue.path.join(".")
        out[path as keyof Errors] = issue.message
      }
      setErrors(out)
      return out
    }
  }

  const isDirty = JSON.stringify(values) !== JSON.stringify(initial)
  const isValid = useMemo(() => itemFormSchema.safeParse(values).success, [values])

  return {
    values,
    setValues,
    errors,
    touched,
    markTouched,
    validate,
    isDirty,
    isValid,
    initial,
  }
}
