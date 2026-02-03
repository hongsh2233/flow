/**
 * 루트(jurin-i) .env.local 로드 후 인자로 받은 명령 실행.
 * Prisma 등이 DATABASE_URL을 루트 .env.local에서 읽도록 함.
 */
const path = require("path");
const { execSync } = require("child_process");

const rootEnvLocal = path.resolve(__dirname, "../../.env.local");
require("dotenv").config({ path: rootEnvLocal });

const [,, ...args] = process.argv;
if (args.length === 0) process.exit(1);
execSync("npx", ["prisma", ...args], { stdio: "inherit", env: process.env });
