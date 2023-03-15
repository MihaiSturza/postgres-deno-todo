import { load } from "https://deno.land/std@0.178.0/dotenv/mod.ts";
import { Application, Context, FlashServer, hasFlash, Router, Status } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import * as postgres from "https://deno.land/x/postgres@v0.14.0/mod.ts";
import { EnvironmentVars } from "./types.ts";

export const env = (await load()) as EnvironmentVars;

const flashServer = hasFlash() ? { serverConstructor: FlashServer } : undefined;
const app = new Application(flashServer);

/** enable cors */
app.use(oakCors());

const router = new Router()
    .get("/", ({ response }: Context) => {
        response.body = { status: Status.OK, body: "Hello deno postgres" };
    })
    .post("/todos", async ({ request, response }: Context) => {
        const { title } = await request.body().value;
        // Insert the new todo into the database
        await db.queryObject`
          INSERT INTO todos (title) VALUES (${title})
        `;
        response.body = { status: Status.Created, message: "Todo created" };
    });

app.use(router.routes());
app.use(router.allowedMethods());

// Create a database pool with 4 connections
const pool = new postgres.Pool(
    `postgresql://postgres:${encodeURIComponent(env.DATABASE_PASS)}@${env.DB}:5${env.DB_PORT}/postgres?sslmode=disable`,
    4,
    true,
);

// Connect to the database
const db = await pool.connect();

try {
    // Create the table
    await db.queryObject`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL
      )
    `;
} finally {
    // Release the connection back into the pool
    db.release();
}

app.addEventListener("error", (evt) => {
    /** Will log the thrown error to the console. */
    console.log(evt.error);
});

await app.listen({ port: 8000 });
