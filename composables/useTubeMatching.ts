// Tüp kontrol formu eşleştirme (kaydetme ekranı ve Kontrol Formları): formdaki satıra Ekipmanlar'daki karşılığını seçmek için
// öneri listesi. Öneri yalnızca sıralamadır; hiçbir tüp kendiliğinden seçilmez (kesin eşleşme kuralı: yer + no + tip aynı).

export interface TubeCandidate { id: number; code?: string | null; place?: string | null; variant?: string | null; workplace?: string | null; last_control_date?: string | null }
export interface TubeLike { place?: string | null; code?: string | null; variant?: string | null }

// Karşılaştırma: küçük harf, boşluksuz.
export const compactText = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR').split(' ').join('')

export const tubeLabel = (item: TubeCandidate) => [item.place, item.code && `no ${item.code}`, item.variant, item.workplace].filter(Boolean).join(' · ')

// Yerin kelimeleri (noktalama boşluk sayılır; tek harfler sayılmaz).
const words = (value?: string | null) => {
  let text = (value || '').toLocaleLowerCase('tr-TR')
  for (const mark of ['-', '/', '(', ')', '.', ',', ':', ';', '_']) text = text.split(mark).join(' ')
  return new Set(text.split(' ').filter(word => word.length > 1))
}

// Benzerlik: aynı no ve tip, aynı yer, yerde ortak kelimeler, aynı tip.
export const tubeScore = (row: TubeLike, item: TubeCandidate) => {
  let score = 0
  if (compactText(row.code) && compactText(row.code) === compactText(item.code) && compactText(row.variant) === compactText(item.variant)) score += 4
  if (compactText(row.place) && compactText(row.place) === compactText(item.place)) score += 3
  const mine = words(row.place)
  for (const word of words(item.place)) if (mine.has(word)) score += 1
  if (compactText(row.variant) && compactText(row.variant) === compactText(item.variant)) score += 1
  return score
}

/**
 * Seçim listesi grupları (PrimeVue Listbox: label / items): önce verilen seçenekler, sonra en benzer birkaç tüp ("Önerilen"),
 * sonra kalan tüpler (yere göre). Değer: `e<id>`.
 */
export const tubeGroups = (row: TubeLike, candidates: TubeCandidate[], options: { label: string; value: string }[], restLabel: string) => {
  const scored = candidates.map(item => ({ item, score: tubeScore(row, item) }))
  const suggested = scored.filter(entry => entry.score >= 2).sort((a, b) => b.score - a.score).slice(0, 5).map(entry => entry.item)
  const picked = new Set(suggested.map(item => item.id))
  const rest = candidates.filter(item => !picked.has(item.id))
    .sort((a, b) => (a.place || '').localeCompare(b.place || '', 'tr') || (a.code || '').localeCompare(b.code || '', 'tr', { numeric: true }))
  const asOption = (item: TubeCandidate) => ({ label: tubeLabel(item), value: `e${item.id}` })

  return [
    { label: 'Seçenekler', items: options },
    { label: 'Önerilen', items: suggested.map(asOption) },
    { label: restLabel, items: rest.map(asOption) }
  ].filter(group => group.items.length)
}
