// Safe formula evaluator for the RLGF renderer (RENDERER_SPEC §4).
// Supports:
//   - SUM(C11:C27)                      -> sum of a cell range on the same page
//   - cell-ref arithmetic: ((B35+C35)-D35), with + - * / and parentheses
//   - an optional leading "="
// Rules: blanks count as 0; dependent formulas (totals-of-totals) resolve via
// memoized recursion with cycle detection; NO eval(); unknown shapes are surfaced
// (returned as { unhandled: true }) so the UI can flag them, never silently 0.

// ---- cell / range helpers -------------------------------------------------
function parseCell(ref) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
  if (!m) return null
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) }
}

function colToNum(col) {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function numToCol(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function expandRange(a, b) {
  const ca = parseCell(a), cb = parseCell(b)
  if (!ca || !cb) return null
  const c1 = Math.min(colToNum(ca.col), colToNum(cb.col))
  const c2 = Math.max(colToNum(ca.col), colToNum(cb.col))
  const r1 = Math.min(ca.row, cb.row)
  const r2 = Math.max(ca.row, cb.row)
  const cells = []
  for (let c = c1; c <= c2; c++)
    for (let r = r1; r <= r2; r++) cells.push(numToCol(c) + r)
  return cells
}

// ---- tiny safe arithmetic parser (recursive descent, no eval) -------------
function tokenize(expr) {
  const re = /\s*([A-Za-z]+\d+|\d+\.?\d*|\.\d+|[+\-*/()])/g
  const out = []
  let m
  let consumed = 0
  while ((m = re.exec(expr))) {
    out.push(m[1])
    consumed = re.lastIndex
  }
  // if anything non-whitespace was left unconsumed, the expression is not
  // pure cell-ref arithmetic -> signal failure to the caller
  if (expr.slice(consumed).trim() !== '') throw new Error('unrecognized token')
  return out
}

function evalArith(expr, getCell) {
  const tokens = tokenize(expr)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function parseExpr() {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = next()
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  function parseTerm() {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = next()
      const r = parseFactor()
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  function parseFactor() {
    const t = peek()
    if (t === undefined) throw new Error('unexpected end')
    if (t === '(') {
      next()
      const v = parseExpr()
      if (next() !== ')') throw new Error('missing )')
      return v
    }
    if (t === '-') { next(); return -parseFactor() }
    if (t === '+') { next(); return parseFactor() }
    next()
    if (/^[A-Za-z]+\d+$/.test(t)) return getCell(t.toUpperCase())
    const n = Number(t)
    if (Number.isNaN(n)) throw new Error('bad token ' + t)
    return n
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('trailing tokens')
  return result
}

// ---- per-page evaluator ---------------------------------------------------
// page: { fields: [...] }   valuesById: { [id]: string }
// Returns { valueForField(f), unhandledIds:Set }
export function makeEvaluator(page, valuesById) {
  const cellMap = {}
  for (const f of page.fields) cellMap[f.cell] = f

  const memo = new Map()       // field id -> computed number (or null if unhandled)
  const unhandledIds = new Set()
  const visiting = new Set()

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return 0
    const n = Number(v)
    return Number.isNaN(n) ? 0 : n
  }

  function getCell(cell) {
    const f = cellMap[cell]
    if (!f) return 0                       // blank / off-page cell -> 0
    if (!f.is_derived) return toNum(valuesById[f.id])
    return valueForField(f)                // derived -> recurse
  }

  function evalFormula(formula, id) {
    let s = String(formula || '').trim()
    if (s.startsWith('=')) s = s.slice(1).trim()

    // 1) SUM(...) — supports a range (C11:C27), comma-separated args, and
    //    arithmetic inside (SUM(J34+J54)). Cross-page refs ('Page 1'!F80) fall
    //    through to "unhandled" since the resolver is same-page only (§2).
    const sm = /^SUM\((.*)\)$/is.exec(s)
    if (sm && !sm[1].includes('!')) {
      try {
        let sum = 0
        for (const part of sm[1].split(',')) {
          const rng = /^\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*$/.exec(part)
          if (rng) {
            const cells = expandRange(rng[1], rng[2])
            if (!cells) throw new Error('bad range')
            sum += cells.reduce((a, c) => a + getCell(c), 0)
          } else {
            sum += evalArith(part, getCell) // e.g. J34+J54, or a single cell
          }
        }
        return { value: sum }
      } catch (_) { /* fall through to unhandled */ }
    }
    // 2) cell-ref arithmetic (must contain at least one cell ref)
    if (/[A-Za-z]+\d+/.test(s) && !/[A-Za-z]{2,}\(/.test(s)) {
      try { return { value: evalArith(s, getCell) } } catch (_) { /* fall through */ }
    }
    // 3) pure numeric expression
    if (/^[0-9.+\-*/()\s]+$/.test(s)) {
      try { return { value: evalArith(s, getCell) } } catch (_) { /* fall through */ }
    }
    // unknown shape -> surface it
    console.warn('⚠ unhandled formula:', id, JSON.stringify(formula))
    return { unhandled: true }
  }

  function valueForField(f) {
    if (memo.has(f.id)) return memo.get(f.id)
    if (visiting.has(f.id)) {
      console.warn('⚠ circular formula reference at', f.id)
      return 0
    }
    visiting.add(f.id)
    const r = evalFormula(f.formula, f.id)
    visiting.delete(f.id)
    if (r.unhandled) {
      unhandledIds.add(f.id)
      memo.set(f.id, null)
      return null
    }
    memo.set(f.id, r.value)
    return r.value
  }

  return { valueForField, unhandledIds }
}
