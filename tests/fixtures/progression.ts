export function isolatedTestDatabase() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) return undefined;
  const url = new URL(value);
  if (
    !/^\/[a-z0-9_]*test[a-z0-9_]*$/i.test(url.pathname) ||
    !/^m5_test_[a-z0-9_]+$/.test(url.searchParams.get("schema") ?? "")
  )
    throw new Error(
      "TEST_DATABASE_URL must select a test-named database and an m5_test_ schema.",
    );
  return value;
}
