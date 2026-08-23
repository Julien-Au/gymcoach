import { NextResponse } from 'next/server';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { getOwnedGymEquipmentImage, setOwnedGymEquipmentImage } from '@/lib/gym-equipment';
import { gymEquipmentImageSchema } from '@/lib/schemas/gym-equipment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const image = await getOwnedGymEquipmentImage(userId, id);
    if (image.kind === 'external') return NextResponse.redirect(image.url);
    return new Response(image.bytes, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.bytes.byteLength),
        'Cache-Control': 'private, max-age=3600',
        'Last-Modified': image.updatedAt.toUTCString(),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const input = await parseJsonBody(req, gymEquipmentImageSchema, { maxBytes: 7_110_000 });
    const equipment = await setOwnedGymEquipmentImage(userId, id, input);
    return NextResponse.json({ equipment });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const equipment = await setOwnedGymEquipmentImage(userId, id, { clear: true });
    return NextResponse.json({ equipment });
  } catch (err) {
    return handleApiError(err);
  }
}
