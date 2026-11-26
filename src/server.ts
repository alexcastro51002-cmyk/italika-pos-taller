import { createApp } from "./app.js";
import { createDatabase, seedDatabase } from "./shared/db.js";

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.SVAS_DB_PATH ?? "data/svas.db";

const db = createDatabase(dbPath);
seedDatabase(db);

const app = createApp(db);
app.listen(port, () => {
  console.log(`SVAS API escuchando en http://localhost:${port}`);
});
