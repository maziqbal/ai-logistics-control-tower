export async function expectPostgresError(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation;
  } catch (error: unknown) {
    // Drizzle may wrap the original PostgreSQL error.
    let current: unknown = error;

    while (current && typeof current === 'object') {
      if ('code' in current && current.code === expectedCode) {
        return;
      }

      if ('cause' in current) {
        current = current.cause;
      } else {
        break;
      }
    }

    throw new Error(
      `Expected PostgreSQL error ${expectedCode}, but received a different error`,
      { cause: error },
    );
  }

  throw new Error(
    `Expected PostgreSQL error ${expectedCode}, but the operation succeeded`,
  );
}
