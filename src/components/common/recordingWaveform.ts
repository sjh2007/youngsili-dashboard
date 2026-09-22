/** Sample the canonical 24 kHz stereo WAV. Peaks represent real audio, not a decorative pattern. */
export function recordingWaveform(buffer: ArrayBuffer, bars = 120): [number, number][] | null {
  const view = new DataView(buffer);
  if (buffer.byteLength < 48 ||
      String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'RIFF' ||
      String.fromCharCode(...new Uint8Array(buffer, 8, 4)) !== 'WAVE' ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 2 ||
      view.getUint32(24, true) !== 24000 || view.getUint16(34, true) !== 16 ||
      String.fromCharCode(...new Uint8Array(buffer, 36, 4)) !== 'data' ||
      view.getUint32(40, true) !== buffer.byteLength - 44) return null;
  const frames = (buffer.byteLength - 44) / 4;
  if (!Number.isInteger(frames) || frames < 1) return null;
  const size = Math.ceil(frames / bars);
  const peaks: [number, number][] = [];
  const trackMaximum = [0, 0];
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * size;
    const end = Math.min(frames, start + size);
    const sampleStep = Math.max(1, Math.floor((end - start) / 64));
    const pair: [number, number] = [0, 0];
    for (let frame = start; frame < end; frame += sampleStep) {
      const offset = 44 + frame * 4;
      pair[0] = Math.max(pair[0], Math.abs(view.getInt16(offset, true)));
      pair[1] = Math.max(pair[1], Math.abs(view.getInt16(offset + 2, true)));
    }
    trackMaximum[0] = Math.max(trackMaximum[0], pair[0]);
    trackMaximum[1] = Math.max(trackMaximum[1], pair[1]);
    peaks.push(pair);
  }
  return peaks.map(([elder, ai]) => [elder / (trackMaximum[0] || 1), ai / (trackMaximum[1] || 1)]);
}
