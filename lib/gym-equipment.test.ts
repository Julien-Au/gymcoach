import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  MAX_GYM_EQUIPMENT_IMAGE_BYTES,
  decodeGymEquipmentImage,
} from './gym-equipment';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('decodeGymEquipmentImage', () => {
  it('rejects bytes whose magic signature does not match the declared MIME type', () => {
    expect(() =>
      decodeGymEquipmentImage(Buffer.from('not a png').toString('base64'), 'image/png'),
    ).toThrow('Uploaded bytes do not match the declared image type.');
  });

  it('rejects an over-cap payload before decoding it', () => {
    const tooLarge = 'A'.repeat(Math.ceil((MAX_GYM_EQUIPMENT_IMAGE_BYTES * 4) / 3) + 17);
    expect(() => decodeGymEquipmentImage(tooLarge, 'image/png')).toThrow(
      'Uploaded equipment image is larger than 5 MB.',
    );
  });

  it('rejects a declared MIME type that disagrees with the data URL', () => {
    const dataUrl = `data:image/png;base64,${PNG.toString('base64')}`;
    expect(() => decodeGymEquipmentImage(dataUrl, 'image/jpeg')).toThrow(
      'The declared image MIME type does not match the data URL.',
    );
  });

  it('rejects invalid base64', () => {
    expect(() => decodeGymEquipmentImage('%%%not-base64%%%', 'image/png')).toThrow(
      'Invalid base64 image data.',
    );
  });
});
