import { createApp } from "./app.js";
import { createDatabase, seedDatabase } from "./shared/db.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const dbPath = process.env.SVAS_DB_PATH ?? "data/svas.db";

const db = createDatabase(dbPath);
seedDatabase(db);

const app = createApp(db);
app.listen(port, host, () => {
  console.log(`SVAS API escuchando en http://${host}:${port}`);
});
