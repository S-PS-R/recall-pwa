import type { CardInput } from '../domain/types';
export function setText(cards: CardInput[]) {
  if (cards.some(card => /[\r\n\t]/.test(card.front) || /[\r\n]/.test(card.back))) throw new Error('This set contains tabs in terms or line breaks. TXT cannot preserve these cards. Export a library backup instead.');
  return cards.map(card => `${card.front}\t${card.back}`).join('\n');
}
export function downloadFile(content: string, name: string, type: string) {
  const file = new File([content], name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_'), { type });
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
