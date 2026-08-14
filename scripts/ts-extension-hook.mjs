// Lets the smoke tests import the app's modules as written.
//
// Node's type stripping requires explicit file extensions, while the app uses
// the extensionless relative imports every TypeScript codebase uses. Rather
// than contort application code to suit the test runner, this hook resolves
// "./mileage" to "./mileage.ts" for the test process only.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // Fall through to the default resolver and let it report the real error.
    }
  }
  return next(specifier, context);
}
