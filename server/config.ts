import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** Локально без .env — 3033. На VPS задайте PORT=80 в .env. */
export const config = {
    port: Number(process.env.PORT || 3033),
    staticRoot: process.env.STATIC_ROOT
        ? path.resolve(process.env.STATIC_ROOT)
        : path.join(repoRoot, 'client', 'dist'),
    repoRoot,
    nodeEnv: process.env.NODE_ENV || 'development',
};
