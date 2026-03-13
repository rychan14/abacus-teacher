export type AbacusColumn = {
  heavenBead: boolean // 5
  earthBeads: number // 0–4
}

export type BeadStep = {
  column: number // 0 = ones (rightmost)
  delta: number // signed change in digit value (to - from)
}

export class Abacus {
  private columns: AbacusColumn[]
  private steps: BeadStep[] = []

  // Ten-complement of v: the amount to ADD to the current column when v cannot
  // fit directly, paired with a carry of 1 to the left column.
  readonly tenComplement: Record<number, { add: number; carry: number }> = {
    1: { add: 9, carry: 1 },
    2: { add: 8, carry: 1 },
    3: { add: 7, carry: 1 },
    4: { add: 6, carry: 1 },
    5: { add: 5, carry: 1 },
    6: { add: 4, carry: 1 },
    7: { add: 3, carry: 1 },
    8: { add: 2, carry: 1 },
    9: { add: 1, carry: 1 },
  }

  // Five-complement of v: the number of earth beads to REMOVE after activating
  // the heaven bead when adding v via the "use heaven, return change" technique.
  readonly fiveComplement: Record<number, number> = {
    1: 4,
    2: 3,
    3: 2,
    4: 1,
  }

  constructor(cols = 5) {
    this.columns = Array.from({ length: cols }, () => ({
      heavenBead: false,
      earthBeads: 0,
    }))
  }

  get columnCount() {
    return this.columns.length
  }

  private digitIndex(i: number) {
    return this.columns.length - 1 - i
  }

  colValue(i: number) {
    const c = this.columns[i]
    return (c.heavenBead ? 5 : 0) + c.earthBeads
  }

  getColumns(): AbacusColumn[] {
    return this.columns.map((c) => ({ ...c }))
  }

  private setCol(i: number, v: number) {
    if (v < 0 || v > 9) throw new Error('Invalid digit')
    const old = this.colValue(i)
    if (old !== v) {
      this.steps.push({ column: this.digitIndex(i), delta: v - old })
    }
    this.columns[i] = {
      heavenBead: v >= 5,
      earthBeads: v % 5,
    }
  }

  private addDigit(i: number, v: number): void {
    if (i < 0) throw new Error('Overflow')
    const cur = this.colValue(i)

    if (cur + v <= 9) {
      this.setCol(i, cur + v)
      return
    }

    const fc = this.fiveComplement[v]
    if (!this.columns[i].heavenBead && fc !== undefined && cur - fc >= 0) {
      this.setCol(i, cur + v)
      return
    }

    const tc = this.tenComplement[v]
    this.setCol(i, cur - tc.add)
    this.addDigit(i - 1, tc.carry)
  }

  private subtractDigit(i: number, v: number): void {
    if (i < 0) throw new Error('Underflow')
    const cur = this.colValue(i)

    if (cur >= v) {
      this.setCol(i, cur - v)
      return
    }

    const tc = this.tenComplement[v]
    this.subtractDigit(i - 1, tc.carry)
    this.setCol(i, cur + tc.add)
  }

  setValue(n: number) {
    this.steps = []
    const s = Math.abs(Math.round(n))
      .toString()
      .padStart(this.columns.length, '0')
    for (let i = 0; i < s.length; i++) {
      this.setCol(i, Number(s[i]))
    }
  }

  getValue(): number {
    return this.columns.reduce(
      (t, _, i) => t + this.colValue(i) * 10 ** (this.columns.length - 1 - i),
      0,
    )
  }

  add(n: number) {
    this.steps = []
    this.addInternal(n, 0)
  }

  private addInternal(n: number, shift: number) {
    const s = Math.abs(Math.round(n)).toString()
    for (let i = 0; i < s.length; i++) {
      const digit = Number(s[i])
      if (digit !== 0) {
        const colIndex = this.columns.length - 1 - shift - (s.length - 1 - i)
        this.addDigit(colIndex, digit)
      }
    }
  }

  subtract(n: number) {
    this.steps = []
    this.subtractInternal(n, 0)
  }

  private subtractInternal(n: number, shift: number) {
    const s = Math.abs(Math.round(n)).toString()
    for (let i = 0; i < s.length; i++) {
      const digit = Number(s[i])
      if (digit !== 0) {
        const colIndex = this.columns.length - 1 - shift - (s.length - 1 - i)
        this.subtractDigit(colIndex, digit)
      }
    }
  }

  multiply(n: number) {
    this.steps = []
    const base = this.getValue()
    this.setValue(0)
    const s = Math.abs(Math.round(n)).toString()
    for (let i = 0; i < s.length; i++) {
      const digit = Number(s[i])
      const shift = s.length - 1 - i
      if (digit !== 0) {
        this.addInternal(base * digit, shift)
      }
    }
  }

  divide(d: number): { quotient: number; remainder: number } {
    if (d === 0) throw new Error('Divide by zero')
    this.steps = []
    let remainder = this.getValue()
    let quotient = 0
    for (let shift = this.columns.length - 1; shift >= 0; shift--) {
      const scaled = d * 10 ** shift
      while (remainder >= scaled) {
        remainder -= scaled
        this.subtractInternal(scaled, 0)
        quotient += 10 ** shift
      }
    }

    // Set the abacus to show the quotient as the final result of the operation
    this.setResult(quotient)

    return { quotient, remainder }
  }

  private setResult(n: number) {
    const s = Math.abs(Math.round(n))
      .toString()
      .padStart(this.columns.length, '0')
    for (let i = 0; i < s.length; i++) {
      this.setCol(i, Number(s[i]))
    }
  }

  getSteps() {
    return [...this.steps]
  }

  setColumnState(i: number, heaven: boolean, earth: number) {
    if (i < 0 || i >= this.columns.length) return
    this.columns[i] = {
      heavenBead: heaven,
      earthBeads: earth,
    }
    this.steps = [] // Clear steps for manual interaction
  }

  reset() {
    this.steps = []
    this.columns = this.columns.map(() => ({
      heavenBead: false,
      earthBeads: 0,
    }))
  }
}
