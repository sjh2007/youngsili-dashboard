export function recordingWavFixture() {
  const frames = 160;
  const buffer = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buffer);
  const word = (at: number, value: string) => Array.from(value).forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  word(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
  word(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 96000, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, frames * 4, true);
  for (let frame = 0; frame < frames; frame++) {
    view.setInt16(44 + frame * 4, frame < frames / 2 ? 1200 : 0, true);
    view.setInt16(46 + frame * 4, frame >= frames / 2 ? -2400 : 0, true);
  }
  const blob = new Blob([buffer], { type: 'audio/wav' });
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => buffer });
  return blob;
}
