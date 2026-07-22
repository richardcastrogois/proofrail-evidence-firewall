import { JsonStore } from "./store";

const store = new JsonStore();
await store.init();
const database = await store.read();
const serialized = JSON.stringify(database);

if (database.schemaVersion !== 4 || serialized.includes("BEGIN PRIVATE KEY")) {
  throw new Error("Store migration did not produce a public schema v4 state");
}

console.log("Proofrail store is on schema v4 and contains no private signing keys");
