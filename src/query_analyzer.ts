// Kullanıcı sorgusundan tablo isimlerini çıkaran basit analizör

export interface QueryAnalysisResult {
  tables: string[];
  columns: string[];
  relatedTables: string[];
}

function getSingular(word: string): string {
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  } else if (word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

function getPlural(word: string): string {
  if (word.endsWith('y')) {
    return word.slice(0, -1) + 'ies';
  } else {
    return word + 's';
  }
}

/**
 * Kullanıcı sorgusundan tablo, sütun ve ilişkili tablo isimlerini çıkarır.
 * @param question Kullanıcıdan gelen doğal dilde sorgu
 * @param tableNames Şemadaki tüm tablo isimleri
 * @param tableColumns Tablo adı -> sütun adları haritası
 * @param tableRelationships Tablo adı -> ilişkili tablo adları haritası
 * @returns Tespit edilen tablo, sütun ve ilişkili tablo isimleri
 */
export function analyzeQuery(
  question: string,
  tableNames: string[],
  tableColumns: Record<string, string[]>,
  tableRelationships: Record<string, string[]>
): QueryAnalysisResult {
  const lowerQuestion = question.toLowerCase();
  const words = lowerQuestion.split(/\W+/);

  // Tablo bulma
  const foundTables: string[] = [];
  tableNames.forEach(table => {
    const tableLower = table.toLowerCase();
    const singular = getSingular(tableLower);
    const plural = getPlural(singular);
    if (
      words.includes(tableLower) ||
      words.includes(singular) ||
      words.includes(plural)
    ) {
      foundTables.push(table);
    }
  });

  // Sütun bulma (tekrarsız)
  const foundColumnsSet = new Set<string>();
  for (const columns of Object.values(tableColumns)) {
    columns.forEach(col => {
      const colLower = col.toLowerCase();
      const singular = getSingular(colLower);
      const plural = getPlural(singular);
      if (
        words.includes(colLower) ||
        words.includes(singular) ||
        words.includes(plural)
      ) {
        foundColumnsSet.add(col);
      }
    });
  }

  // İlişkili tablolar (bulunan tabloların ilişkili olduğu diğer tablolar, ana tablolar hariç, tekrarsız)
  const relatedTablesSet = new Set<string>();
  foundTables.forEach(table => {
    const related = tableRelationships[table];
    if (related) {
      related.forEach(rt => {
        if (!foundTables.includes(rt)) {
          relatedTablesSet.add(rt);
        }
      });
    }
  });

  return {
    tables: foundTables,
    columns: Array.from(foundColumnsSet),
    relatedTables: Array.from(relatedTablesSet)
  };
} 