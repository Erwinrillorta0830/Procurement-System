// app/lib/uuid.ts
export function uuid(): string {
    // 1) modern browsers
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
        return (crypto as any).randomUUID();
    }
    // 2) older browsers with getRandomValues
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        // RFC4122 v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const bth = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${bth.slice(0,8)}-${bth.slice(8,12)}-${bth.slice(12,16)}-${bth.slice(16,20)}-${bth.slice(20)}`;
    }
    // 3) last-resort fallback
    return `id-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}
