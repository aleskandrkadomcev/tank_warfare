/** Осветление/затемнение hex-цвета для градаций корпуса/башни. */
export function shadeColor(col, amt) {
    let usePound = false;
    if (col[0] === '#') {
        col = col.slice(1);
        usePound = true;
    }
    const num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    let b = ((num >> 8) & 0x00ff) + amt;
    let g = (num & 0x0000ff) + amt;
    return (
        (usePound ? '#' : '') +
        (r > 255 ? 255 : r < 0 ? 0 : r).toString(16).padStart(2, '0') +
        (b > 255 ? 255 : b < 0 ? 0 : b).toString(16).padStart(2, '0') +
        (g > 255 ? 255 : g < 0 ? 0 : g).toString(16).padStart(2, '0')
    );
}
