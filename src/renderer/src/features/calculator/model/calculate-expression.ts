const TOKEN = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([()+\-*/]))/y

export function calculateExpression(expression: string): number {
  const source = expression.trim()
  const tokens: string[] = []
  let offset = 0
  while (offset < source.length) {
    TOKEN.lastIndex = offset
    const match = TOKEN.exec(source)
    if (!match) throw new Error("수식을 확인해 주세요.")
    tokens.push(match[1] ?? match[2])
    offset = TOKEN.lastIndex
  }
  if (!tokens.length) throw new Error("수식을 입력해 주세요.")

  let index = 0
  const factor = (): number => {
    const token = tokens[index++]
    if (token === "+") return factor()
    if (token === "-") return -factor()
    if (token === "(") {
      const value = sum()
      if (tokens[index++] !== ")") throw new Error("괄호를 확인해 주세요.")
      return value
    }
    const value = Number(token)
    if (!token || !Number.isFinite(value))
      throw new Error("숫자를 확인해 주세요.")
    return value
  }
  const product = (): number => {
    let value = factor()
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++]
      const next = factor()
      if (operator === "/" && next === 0)
        throw new Error("0으로 나눌 수 없습니다.")
      value = operator === "*" ? value * next : value / next
    }
    return value
  }
  const sum = (): number => {
    let value = product()
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++]
      const next = product()
      value = operator === "+" ? value + next : value - next
    }
    return value
  }
  const result = sum()
  if (index !== tokens.length || !Number.isFinite(result))
    throw new Error("수식을 확인해 주세요.")
  return result
}
