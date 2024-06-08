import { Primitive, JsonObject } from 'type-fest'
import errorConstructors from './error-constructors.js'

export { default as errorConstructors } from './error-constructors.js'

export type ToJSONLike = { toJSON(): string }

export type ErrorLike = {
  [key: string]: unknown
  name: string
  message: string
  stack: string
  cause?: unknown
  code?: string
}

export type ErrorObject = {
  name?: string
  message?: string
  stack?: string
  cause?: unknown
  code?: string
} & JsonObject

export type CircularOptions = {
  from: ErrorObject | ToJSONLike | unknown
  seen: (ErrorObject | ToJSONLike | unknown)[]
  to?: any
  forceEnumerable?: boolean
  maxDepth: number
  depth: number
  useToJSON?: boolean
  serialize: boolean
}

export interface Options {
  /**
	The maximum depth of properties to preserve when serializing/deserializing.

	@default Number.POSITIVE_INFINITY

	@example
	```
	import {serializeError} from 'serialize-error';

	const error = new Error('🦄');
	error.one = {two: {three: {}}};

	console.log(serializeError(error, {maxDepth: 1}));
	//=> {name: 'Error', message: '…', one: {}}

	console.log(serializeError(error, {maxDepth: 2}));
	//=> {name: 'Error', message: '…', one: { two: {}}}
	```
	*/
  readonly maxDepth?: number

  /**
	Indicate whether to use a `.toJSON()` method if encountered in the object. This is useful when a custom error implements its own serialization logic via `.toJSON()` but you prefer to not use it.

	@default true
	*/
  readonly useToJSON?: boolean
}

const commonProperties = [
  {
    property: 'name',
    enumerable: false,
  },
  {
    property: 'message',
    enumerable: false,
  },
  {
    property: 'stack',
    enumerable: false,
  },
  {
    property: 'code',
    enumerable: true,
  },
  {
    property: 'cause',
    enumerable: false,
  },
]

const toJsonWasCalled = new WeakSet<ToJSONLike>()

const toJSON = (from: ToJSONLike) => {
  toJsonWasCalled.add(from)
  const json = from.toJSON()
  toJsonWasCalled.delete(from)
  return json
}

const getErrorConstructor = (name: string) => errorConstructors.get(name) ?? Error

export class NonError extends Error {
  override name = 'NonError'

  constructor(message: object) {
    super(NonError._prepareSuperMessage(message))
  }

  static _prepareSuperMessage(message: object) {
    try {
      return JSON.stringify(message)
    } catch {
      return String(message)
    }
  }
}

export function isErrorLike(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && 'name' in value && 'message' in value && 'stack' in value
}

function isMinimumViableSerializedError(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && 'message' in value && !Array.isArray(value)
}

const destroyCircular = ({
  from,
  seen,
  to,
  forceEnumerable,
  maxDepth,
  depth,
  useToJSON,
  serialize,
}: CircularOptions) => {
  if (!to) {
    if (Array.isArray(from)) {
      to = []
    } else if (!serialize && isErrorLike(from)) {
      const Error = getErrorConstructor((from as ErrorLike).name)
      to = new Error()
    } else {
      to = {}
    }
  }

  seen.push(from)

  if (depth >= maxDepth) {
    return to
  }

  if (useToJSON && typeof (from as ToJSONLike).toJSON === 'function' && !toJsonWasCalled.has(from as ToJSONLike)) {
    return toJSON(from as ToJSONLike)
  }

  const continueDestroyCircular = (value: CircularOptions['from']) =>
    destroyCircular({
      from: value,
      seen: [...seen],
      forceEnumerable,
      maxDepth,
      depth,
      useToJSON,
      serialize,
    })

  for (const [key, value] of Object.entries(from)) {
    if (value && value instanceof Uint8Array && value.constructor.name === 'Buffer') {
      to[key] = '[object Buffer]'
      continue
    }

    // TODO: Use `stream.isReadable()` when targeting Node.js 18.
    if (value !== null && typeof value === 'object' && typeof value.pipe === 'function') {
      to[key] = '[object Stream]'
      continue
    }

    if (typeof value === 'function') {
      continue
    }

    if (!value || typeof value !== 'object') {
      // Gracefully handle non-configurable errors like `DOMException`.
      try {
        to[key] = value
        // eslint-disable-next-line no-empty
      } catch {}

      continue
    }

    if (!seen.includes((from as any)[key])) {
      depth++
      to[key] = continueDestroyCircular((from as any)[key])

      continue
    }

    to[key] = '[Circular]'
  }

  for (const { property, enumerable } of commonProperties) {
    if (typeof (from as any)[property] !== 'undefined' && (from as any)[property] !== null) {
      Object.defineProperty(to, property, {
        value: isErrorLike((from as any)[property])
          ? continueDestroyCircular((from as any)[property])
          : (from as any)[property],
        enumerable: forceEnumerable ? true : enumerable,
        configurable: true,
        writable: true,
      })
    }
  }

  return to
}

type FunctionLike = (...args: unknown[]) => unknown

export function serializeError<T>(
  value: T,
  options: Options = {}
): T extends Primitive ? T : T extends FunctionLike ? string : ErrorObject {
  const { maxDepth = Number.POSITIVE_INFINITY, useToJSON = true } = options

  if (typeof value === 'object' && value !== null) {
    return destroyCircular({
      from: value,
      seen: [],
      forceEnumerable: true,
      maxDepth,
      depth: 0,
      useToJSON,
      serialize: true,
    })
  }

  // People sometimes throw things besides Error objects…
  if (typeof value === 'function') {
    // `JSON.stringify()` discards functions. We do too, unless a function is thrown directly.
    // We intentionally use `||` because `.name` is an empty string for anonymous functions.
    return `[Function: ${value.name || 'anonymous'}]` as any
  }

  return value as any
}

export function deserializeError(value: ErrorObject | unknown, options: Options = {}): Error {
  const { maxDepth = Number.POSITIVE_INFINITY } = options

  if (value instanceof Error) {
    return value
  }

  if (isMinimumViableSerializedError(value)) {
    const Error = getErrorConstructor((value as ErrorObject).name)
    return destroyCircular({
      from: value,
      seen: [],
      to: new Error(),
      maxDepth,
      depth: 0,
      serialize: false,
    })
  }

  return new NonError(value as ErrorObject)
}
