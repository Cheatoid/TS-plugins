import * as ts from "typescript";

function trySimplifyNode(node: ts.Expression): number | false {
  if (ts.isNumericLiteral(node)) {
    return parseFloat(node.text);
  }
  if (ts.isParenthesizedExpression(node)) {
    const { expression } = node;
    if (ts.isNumericLiteral(expression) || // (123)
      ts.isPrefixUnaryExpression(expression)) { // (-123) (~123)
      return trySimplifyNode(expression);
    }
  }
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    if (node.operator === ts.SyntaxKind.MinusToken) { // -123
      return -trySimplifyNode(node.operand);
    }
    if (node.operator === ts.SyntaxKind.TildeToken) { // ~123
      return ~trySimplifyNode(node.operand);
    }
    return trySimplifyNode(node.operand); // assume +123
  }
  if (ts.isBinaryExpression(node)) {
    const [lhs, rhs] = [trySimplifyNode(node.left), trySimplifyNode(node.right)];
    if (lhs !== false && rhs !== false) {
      switch (node.operatorToken.kind) {
        case ts.SyntaxKind.BarToken:
          return lhs | rhs;
        case ts.SyntaxKind.CaretToken:
          return lhs ^ rhs;
        case ts.SyntaxKind.AmpersandToken:
          return lhs & rhs;
        case ts.SyntaxKind.LessThanLessThanToken:
          return lhs << rhs;
        case ts.SyntaxKind.GreaterThanGreaterThanToken:
          return lhs >> rhs;
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
          return lhs >>> rhs;
        case ts.SyntaxKind.PlusToken:
          return lhs + rhs;
        case ts.SyntaxKind.MinusToken:
          return lhs - rhs;
        case ts.SyntaxKind.AsteriskToken:
          return lhs * rhs;
        case ts.SyntaxKind.SlashToken:
          return lhs / rhs;
        case ts.SyntaxKind.PercentToken:
          return lhs % rhs;
        case ts.SyntaxKind.AsteriskAsteriskToken:
          return lhs ** rhs;
      }
    }
  }
  return false; // Bail out... can't compute it at compile-time
}

const transformer = (): ts.TransformerFactory<ts.SourceFile> => (context: ts.TransformationContext) =>
  (file: ts.SourceFile) => {
    function makeLiteral(value: number) {
      // Special handling for NaN and negative/positive Infinity
      if (Number.isNaN(value)) {
        return context.factory.createIdentifier("NaN");
        /*return context.factory.createBinaryExpression(
          context.factory.createNumericLiteral(0),
          context.factory.createToken(ts.SyntaxKind.SlashToken),
          context.factory.createNumericLiteral(0)
        );*/
      }
      return Number.isFinite(value)
        ? context.factory.createNumericLiteral(value)
        : (value < 0 ?
          /*context.factory.createBinaryExpression(
            context.factory.createNumericLiteral(-1),
            context.factory.createToken(ts.SyntaxKind.SlashToken),
            context.factory.createNumericLiteral(0)
          )*/context.factory.createPrefixUnaryExpression(
          ts.SyntaxKind.MinusToken,
          context.factory.createIdentifier("Infinity")
        ) :
          /*context.factory.createBinaryExpression(
            context.factory.createNumericLiteral(1),
            context.factory.createToken(ts.SyntaxKind.SlashToken),
            context.factory.createNumericLiteral(0)
          )*/context.factory.createIdentifier("Infinity"));
    }
    function visit(node: ts.Node): ts.Node {
      node = ts.visitEachChild(node, visit, context); // Bottom-up recursive
      if (ts.isParenthesizedExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isBinaryExpression(node)) {
        const value = trySimplifyNode(node);
        if (value !== false) {
          return makeLiteral(value);
        }
      }
      return node;
    }
    return ts.visitNode(file, visit);
  };

export default transformer;
