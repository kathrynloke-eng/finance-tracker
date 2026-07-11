import { getDefaultUser, ensureDefaultData } from "../lib/user";

async function main() {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);
  console.log(`Seeded default data for user: ${user.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
