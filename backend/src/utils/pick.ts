export default function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      // @ts-expect-error dynamic assign
      out[k] = obj[k];
    }
  }
  return out;
}
