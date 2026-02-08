import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    console.log("Testing Connection...");
    console.log("URL:", url);
    console.log("Token Length:", authToken?.length);

    if (!url || !authToken) {
        console.error("Missing credentials!");
        process.exit(1);
    }

    try {
        const client = createClient({
            url,
            authToken,
        });

        const result = await client.execute("SELECT 1");
        console.log("✅ Connection Successful!", result);
    } catch (error) {
        console.error("❌ Connection Failed:", error);
    }
}

main();
