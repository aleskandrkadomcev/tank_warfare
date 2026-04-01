import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
const contentTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};
export function handleHttpRequest(req, res) {
    const urlPath = req.url?.split('?')[0] || '/';
    if (urlPath.startsWith('/assets/')) {
        // urlPath имеет ведущий "/", поэтому path.join(staticRoot, urlPath) "обнуляет" staticRoot.
        // Убираем ведущий слэш, чтобы файл искался внутри STATIC_ROOT.
        const filePath = path.join(config.staticRoot, urlPath.slice(1));
        serveFile(res, filePath, {
            req,
            // После замены PNG/MP3 без смены URL браузер иначе долго держит старый кэш.
            cacheControl: 'public, max-age=0, must-revalidate',
        });
        return;
    }
    if (urlPath === '/' || urlPath === '/index.html') {
        const indexPath = path.join(config.staticRoot, 'index.html');
        serveFile(res, indexPath, {
            req,
            cacheControl: 'no-cache, must-revalidate',
        });
        return;
    }
    res.writeHead(404);
    res.end('Not found');
}
function etagFromStat(stat) {
    return `W/"${stat.mtimeMs}-${stat.size}"`;
}
function ifNoneMatchSatisfied(ifNoneMatch, etag) {
    if (!ifNoneMatch || ifNoneMatch === '*')
        return false;
    return ifNoneMatch
        .split(',')
        .map((s) => s.trim())
        .some((v) => v === etag);
}
function serveFile(res, filePath, options) {
    const req = options?.req;
    const cacheControl = options?.cacheControl ?? 'no-cache, must-revalidate';
    fs.stat(filePath, (statErr, stat) => {
        if (statErr || !stat.isFile()) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        const etag = etagFromStat(stat);
        if (ifNoneMatchSatisfied(req?.headers['if-none-match'], etag)) {
            res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
            res.end();
            return;
        }
        fs.readFile(filePath, (readErr, data) => {
            if (readErr) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            const ext = path.extname(filePath);
            res.writeHead(200, {
                'Content-Type': contentTypes[ext] || 'application/octet-stream',
                ETag: etag,
                'Cache-Control': cacheControl,
            });
            res.end(data);
        });
    });
}
//# sourceMappingURL=staticHandler.js.map