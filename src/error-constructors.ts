const list: [string, ErrorConstructor][] = [
  // Native ES errors https://262.ecma-international.org/12.0/#sec-well-known-intrinsic-objects
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,

  // Built-in errors
  globalThis.DOMException,

  // Node-specific errors
  // https://nodejs.org/api/errors.html
  (globalThis as any).AssertionError,
  (globalThis as any).SystemError,
]
  // Non-native Errors are used with `globalThis` because they might be missing. This filter drops them when undefined.
  .filter(Boolean)
  .map(constructor => [constructor.name, constructor])

const errorConstructors = new Map(list)

export default errorConstructors
