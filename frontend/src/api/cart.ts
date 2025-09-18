export type ShiftKey = 'morning' | 'afternoon' | 'night'|'evening';
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';


export async function createHold(args: { productId: string; userId: string; qtyKg: number; lcId: string; shiftKey: ShiftKey; minutes?: number; }) {
const res = await fetch(`${API}/api/holds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
if (!res.ok) throw new Error(await res.text());
return res.json();
}


export async function extendHold(id: string, minutes = 3) {
const res = await fetch(`${API}/api/holds/${id}/extend`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) });
if (!res.ok) throw new Error(await res.text());
return res.json();
}


export async function releaseHoldById(id: string) {
const res = await fetch(`${API}/api/holds/${id}`, { method: 'DELETE' });
if (!res.ok) throw new Error(await res.text());
return res.json();
}