import { JsonStore } from "./store";

const store = new JsonStore();
await store.init();
const database = await store.read();
const serialized = JSON.stringify(database);

if (database.schemaVersion !== 6 || serialized.includes("BEGIN PRIVATE KEY")) {
  throw new Error("Store migration did not produce a public schema v6 state");
}

console.log("Proofrail store is on schema v6 and contains no private signing keys");
