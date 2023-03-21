import * as ts from "typescript";

interface PluginOptions {
  evaluateMath: boolean;
}

function trySimplifyNode(node: ts.Expression, options: PluginOptions): number | false {
  if (ts.isNumericLiteral(node)) {
    return parseFloat(node.text);
  }
  if (ts.isParenthesizedExpression(node)) {
    const { expression } = node;
    if (ts.isNumericLiteral(expression) || // (123)
      ts.isPrefixUnaryExpression(expression)) { // (-123) (~123)
      return trySimplifyNode(expression, options);
    }
    return false;
  }
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    if (node.operator === ts.SyntaxKind.MinusToken) { // -123
      return -trySimplifyNode(node.operand, options);
    }
    if (node.operator === ts.SyntaxKind.TildeToken) { // ~123
      return ~trySimplifyNode(node.operand, options);
    }
    return trySimplifyNode(node.operand, options); // assume +123
  }
  if (ts.isBinaryExpression(node)) {
    const lhs = trySimplifyNode(node.left, options);
    if (lhs === false) return false;
    const rhs = trySimplifyNode(node.right, options);
    if (rhs === false) return false;
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
      default:
        return false;
    }
  }
  if (options.evaluateMath) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Math" && ts.isIdentifier(node.name)) {
      switch (node.name.text) { // ADDED
        case "E":
          return Math.E;
        case "LN10":
          return Math.LN10;
        case "LN2":
          return Math.LN2;
        case "LOG10E":
          return Math.LOG10E;
        case "LOG2E":
          return Math.LOG2E;
        case "PI":
          return Math.PI;
        case "SQRT1_2":
          return Math.SQRT1_2;
        case "SQRT2":
          return Math.SQRT2;
        default:
          return false;
      }
    }
    if (ts.isCallExpression(node)) {
      const { expression } = node;
      if (ts.isPropertyAccessExpression(expression)) {
        if (
          expression.questionDotToken === undefined &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === "Math" &&
          ts.isIdentifier(expression.name)) {
          const callArgs: number[] = [];
          for (const argExpression of node.arguments) {
            const argValue = trySimplifyNode(argExpression, options);
            if (argValue === false) {
              return false;
            }
            callArgs.push(argValue);
          }
          const methodName = expression.getText();
          try {
            const evaluated = eval(`module.exports=${methodName}(${callArgs.join(",")});`);
            if (typeof evaluated === "number") {
              return evaluated;
            }
          } catch {
            return false;
          }
        }
      }
    }
  }
  return false; // Bail out... can't compute it at compile-time
}

function makeLiteral(value: number) {
  // Special handling for NaN and negative/positive Infinity
  if (Number.isNaN(value)) {
    return ts.factory.createIdentifier("NaN");
  }
  return Number.isFinite(value)
    ? ts.factory.createNumericLiteral(value)
    : (value < 0 ?
      ts.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.MinusToken,
        ts.factory.createIdentifier("Infinity")
      ) :
      ts.factory.createIdentifier("Infinity"));
}

export default function transformer(program: ts.Program, extraOptions: Partial<PluginOptions>): ts.TransformerFactory<ts.SourceFile> {
  const pluginOptions: PluginOptions = {
    evaluateMath: extraOptions.evaluateMath === true
  };
  function transform(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
    function visit(node: ts.Node): ts.Node {
      node = ts.visitEachChild(node, visit, context); // Bottom-up recursive
      if (ts.isParenthesizedExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isBinaryExpression(node) || (pluginOptions.evaluateMath && (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)))) {
        const value = trySimplifyNode(node, pluginOptions);
        if (value !== false) {
          return makeLiteral(value);
        }
      }
      return node;
    }
    function transformFile(sourceFile: ts.SourceFile): ts.SourceFile {
      return ts.visitEachChild(sourceFile, visit, context);
    }
    return transformFile;
  }
  return transform;
}
