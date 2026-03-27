/**
 * Никнеймы над танками и прицел (фаза 3.3).
 */

/** Один раз на проход никнеймов: шрифт и тень (меньше churn свойств canvas). */
export function beginNicknameDrawPass(ctx) {
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
}

export function endNicknameDrawPass(ctx) {
    ctx.shadowBlur = 0;
}

/**
 * Рисует ник над танком. Перед циклом вызвать `beginNicknameDrawPass`, после — `endNicknameDrawPass`.
 */
export function drawNickname(ctx, t, isMy, session) {
    const displayName = session.playerData[t.id]?.nick || (isMy ? session.myNickname : 'Враг');
    const isAlly = session.playerData[t.id]?.team === session.myTeam;
    ctx.fillStyle = isMy || isAlly ? '#4CAF50' : '#f44336';
    ctx.fillText(displayName, t.x, t.y - 40);
}

export function drawAimCrosshair(ctx, tank) {
    const dist = tank.aimDist || 200;
    const aimX = tank.x + Math.cos(tank.turretAngle) * dist;
    const aimY = tank.y + Math.sin(tank.turretAngle) * dist;
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 10, 0, Math.PI * 2);
    ctx.moveTo(aimX - 15, aimY);
    ctx.lineTo(aimX + 15, aimY);
    ctx.moveTo(aimX, aimY - 15);
    ctx.lineTo(aimX, aimY + 15);
    ctx.stroke();
}

/** Рисует индикатор перезарядки вокруг курсора (в экранных координатах). */
export function drawReloadIndicator(ctx, tank, screenX, screenY) {
    const total = tank._reloadTotal || 1;
    const current = tank.reload || 0;
    const progress = current > 0 ? 1 - current / total : 1; // 0→1
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    if (progress < 1) {
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + progress * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 18, startAngle, endAngle);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.arc(screenX, screenY, 18, 0, Math.PI * 2);
        ctx.stroke();
    }
}
