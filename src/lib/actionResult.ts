export type ActionResult<Data extends object = object> =
  | ({ ok: true } & Data)
  | { ok: false; error: string };
