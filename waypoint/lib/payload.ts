import { z } from "zod";

export const EVENT_NAME_RE = /^[a-zA-Z0-9_.:\- ]{1,64}$/;
export const MAX_PROPS = 30;

const propValue = z.union([z.string().max(512), z.number().finite(), z.boolean()]);

export const propsSchema = z
  .record(z.string().min(1).max(64), propValue)
  .refine((p) => Object.keys(p).length <= MAX_PROPS, { message: `at most ${MAX_PROPS} props` });

/** Compact payload sent by the browser tracker to POST /e. */
export const browserPayloadSchema = z.object({
  s: z.string().min(1).max(64), // site public id
  t: z.enum(["pageview", "event", "ping"]),
  n: z.string().regex(EVENT_NAME_RE).optional(), // event name (t=event)
  u: z.string().url().max(2048), // page url
  r: z.string().max(2048).optional().default(""), // referrer
  ti: z.string().max(512).optional().default(""), // title
  w: z.number().int().min(0).max(20000).optional(), // screen width
  l: z.string().max(35).optional().default(""), // language
  vid: z.string().max(64).nullish(), // visitor id (product mode)
  sid: z.string().max(64).nullish(), // session id (product mode)
  uid: z.string().max(256).nullish(), // identified user id
  p: propsSchema.optional(), // props
  et: z.number().int().min(0).max(24 * 3600 * 1000).optional(), // engaged ms (ping)
  rev: z.object({ a: z.number().int(), c: z.string().length(3) }).optional(), // client revenue (minor units)
});
export type BrowserPayload = z.infer<typeof browserPayloadSchema>;
