"use strict";
// Kullanıcı sorgusundan tablo isimlerini çıkaran basit analizör
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeQuery = analyzeQuery;
function getSingular(word) {
    if (word.endsWith('ies')) {
        return word.slice(0, -3) + 'y';
    }
    else if (word.endsWith('s')) {
        return word.slice(0, -1);
    }
    return word;
}
function getPlural(word) {
    if (word.endsWith('y')) {
        return word.slice(0, -1) + 'ies';
    }
    else {
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
function analyzeQuery(question, tableNames, tableColumns, tableRelationships) {
    var lowerQuestion = question.toLowerCase();
    var words = lowerQuestion.split(/\W+/);
    // Tablo bulma
    var foundTables = [];
    tableNames.forEach(function (table) {
        var tableLower = table.toLowerCase();
        var singular = getSingular(tableLower);
        var plural = getPlural(singular);
        if (words.includes(tableLower) ||
            words.includes(singular) ||
            words.includes(plural)) {
            foundTables.push(table);
        }
    });
    // Sütun bulma (tekrarsız)
    var foundColumnsSet = new Set();
    for (var _i = 0, _a = Object.values(tableColumns); _i < _a.length; _i++) {
        var columns = _a[_i];
        columns.forEach(function (col) {
            var colLower = col.toLowerCase();
            var singular = getSingular(colLower);
            var plural = getPlural(singular);
            if (words.includes(colLower) ||
                words.includes(singular) ||
                words.includes(plural)) {
                foundColumnsSet.add(col);
            }
        });
    }
    // İlişkili tablolar (bulunan tabloların ilişkili olduğu diğer tablolar, ana tablolar hariç, tekrarsız)
    var relatedTablesSet = new Set();
    foundTables.forEach(function (table) {
        var related = tableRelationships[table];
        if (related) {
            related.forEach(function (rt) {
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
